import 'reflect-metadata';
import { Client } from 'pg';
import { DataSource, type Logger } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';
import { buildDataSourceOptions } from '../src/database/data-source-options.js';
import { Spot } from '../src/spots/spot.entity.js';
import { SpotsService } from '../src/spots/spots.service.js';

/**
 * 半径検索の結合テスト。実際の PostGIS に対して SpotsService の SQL を実行する。
 * 手元のデータ（spots）を壊さないよう、別の DB（既定は spots_test）を使う。
 * 実行: docker compose up -d db && npm run test:int
 */
const TEST_DB = process.env.TEST_DB_NAME ?? 'spots_test';
const baseOptions = buildDataSourceOptions() as PostgresConnectionOptions;

// WGS84 楕円体で、緯度 lat における緯度1度・経度1度の長さ（m）。
// テストデータの位置を PostGIS とは独立に決めるために使う
const A = 6378137;
const E2 = 0.00669437999014;
function metersPerDegree(lat: number) {
  const rad = (lat * Math.PI) / 180;
  const w = 1 - E2 * Math.sin(rad) ** 2;
  return {
    lat: ((Math.PI / 180) * A * (1 - E2)) / w ** 1.5,
    lng: ((Math.PI / 180) * A * Math.cos(rad)) / Math.sqrt(w),
  };
}
function north(c: { lat: number; lng: number }, m: number) {
  return { lat: c.lat + m / metersPerDegree(c.lat).lat, lng: c.lng };
}
function east(c: { lat: number; lng: number }, m: number) {
  return { lat: c.lat, lng: c.lng + m / metersPerDegree(c.lat).lng };
}

const TOKYO = { lat: 35.681236, lng: 139.767125 };
const SAPPORO = { lat: 43.068661, lng: 141.350755 };

/** SpotsService が実行した SQL を記録し、実行計画の確認に使う */
class QueryRecorder implements Logger {
  queries: { query: string; parameters?: unknown[] }[] = [];
  logQuery(query: string, parameters?: unknown[]) {
    this.queries.push({ query, parameters });
  }
  logQueryError() {}
  logQuerySlow() {}
  logSchemaBuild() {}
  logMigration() {}
  log() {}
}

let dataSource: DataSource;
let service: SpotsService;
const recorder = new QueryRecorder();

async function ensureTestDatabase() {
  const client = new Client({
    host: baseOptions.host,
    port: baseOptions.port,
    user: baseOptions.username,
    password: baseOptions.password,
    database: 'postgres',
  });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]);
    if (!rowCount) await client.query(`CREATE DATABASE "${TEST_DB}"`);
  } finally {
    await client.end();
  }
}

async function insertSpot(name: string, p: { lat: number; lng: number }) {
  await dataSource.query(
    `INSERT INTO spots (source_id, name, location)
     VALUES ($1, $1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)`,
    [name, p.lng, p.lat],
  );
}

beforeAll(async () => {
  await ensureTestDatabase();
  dataSource = new DataSource({
    ...baseOptions,
    database: TEST_DB,
    logging: ['query'],
    logger: recorder,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  service = new SpotsService(dataSource.getRepository(Spot));
});

afterAll(async () => {
  await dataSource?.destroy();
});

beforeEach(async () => {
  await dataSource.query('TRUNCATE spots RESTART IDENTITY');
  recorder.queries = [];
});

describe('SpotsService.search（PostGIS）', () => {
  beforeEach(async () => {
    await insertSpot('北500m', north(TOKYO, 500));
    await insertSpot('北900m', north(TOKYO, 900));
    await insertSpot('北1100m', north(TOKYO, 1100));
    await insertSpot('北3000m', north(TOKYO, 3000));
  });

  it('半径内のスポットだけを返す', async () => {
    const result = await service.search({ ...TOKYO, radiusKm: 1, limit: 500 });

    expect(result.items.map((s) => s.name).sort()).toEqual(['北500m', '北900m']);
    expect(result.total).toBe(2);
  });

  it('近い順に並び、距離はメートルで返す', async () => {
    const result = await service.search({ ...TOKYO, radiusKm: 5, limit: 500 });

    expect(result.items.map((s) => s.name)).toEqual(['北500m', '北900m', '北1100m', '北3000m']);
    const expected = [500, 900, 1100, 3000];
    result.items.forEach((s, i) => expect(Math.abs(s.distanceM - expected[i])).toBeLessThanOrEqual(5));
  });

  it('limit で件数を絞っても、total は半径内の本来の件数を返す', async () => {
    const result = await service.search({ ...TOKYO, radiusKm: 5, limit: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('北500m');
    expect(result.total).toBe(4);
  });

  it('半径の境界：距離 d の点は、半径 d+1m なら含まれ、d−1m なら含まれない', async () => {
    const [{ d }] = await dataSource.query<{ d: number }[]>(
      `SELECT ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS d
       FROM spots WHERE name = '北900m'`,
      [TOKYO.lng, TOKYO.lat],
    );
    const names = async (radiusM: number) =>
      (await service.search({ ...TOKYO, radiusKm: radiusM / 1000, limit: 500 })).items.map((s) => s.name);

    expect(await names(d + 1)).toContain('北900m');
    expect(await names(d - 1)).not.toContain('北900m');
  });

  it('GiST インデックスを使える SQL になっている', async () => {
    await service.search({ ...TOKYO, radiusKm: 1, limit: 500 });
    const searchQuery = recorder.queries.find((q) => q.query.includes('ST_Distance'));
    expect(searchQuery).toBeDefined();

    // 件数が少ないとプランナーは全件走査を選ぶため、この接続だけ全件走査を避けさせて確認する
    const runner = dataSource.createQueryRunner();
    try {
      await runner.query('SET enable_seqscan = off');
      const plan = await runner.query(`EXPLAIN ${searchQuery!.query}`, searchQuery!.parameters);
      const text = plan.map((r: { 'QUERY PLAN': string }) => r['QUERY PLAN']).join('\n');
      expect(text).toContain('idx_spots_location');
    } finally {
      await runner.release();
    }
  });
});

describe('SpotsService.search（経度方向）', () => {
  it('高緯度でも東西方向の距離をメートルで判定する（経度1度の長さが緯度で変わることを考慮できている）', async () => {
    // 北緯43度では経度1度は約81.5km。経度1度を緯度1度（約111km）と同じ長さとみなす実装だと、900m の点が半径外になる
    await insertSpot('東900m', east(SAPPORO, 900));
    await insertSpot('東1100m', east(SAPPORO, 1100));

    const result = await service.search({ ...SAPPORO, radiusKm: 1, limit: 500 });

    expect(result.items.map((s) => s.name)).toEqual(['東900m']);
  });
});

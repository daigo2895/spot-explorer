/**
 * シードデータ投入スクリプト。
 * docker-compose up 時に API 起動前に実行される（マイグレーション → シード → API起動）。
 *
 * - 何度実行しても結果が同じになるよう、source_id をキーに UPSERT する（冪等）
 * - 緯度経度が不正な行はスキップしてログに出す（1行の不備で全体を止めない）
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source-options.js';

type Row = Record<string, string>;

interface SpotSeed {
  sourceId: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  attributes: Record<string, string>;
}

// CSVの列名の揺れを吸収する（小文字・前後空白除去後に照合）
const COLUMN_ALIASES = {
  id: ['id', 'spot_id', 'spotid', 'no'],
  name: ['name', 'spot_name', 'title', '名称', '名前', 'スポット名'],
  lat: ['lat', 'latitude', '緯度'],
  lng: ['lng', 'lon', 'long', 'longitude', '経度'],
  category: ['category', 'genre', 'type', 'カテゴリ', 'カテゴリー', 'ジャンル'],
  address: ['address', '住所'],
} as const;

type Field = keyof typeof COLUMN_ALIASES;

function resolveColumns(headers: string[]): Partial<Record<Field, string>> {
  const normalized = new Map(headers.map((h) => [h.trim().toLowerCase(), h]));
  const result: Partial<Record<Field, string>> = {};
  for (const field of Object.keys(COLUMN_ALIASES) as Field[]) {
    const hit = COLUMN_ALIASES[field].find((alias) => normalized.has(alias));
    if (hit) result[field] = normalized.get(hit);
  }
  return result;
}

function toSeed(
  row: Row,
  columns: Partial<Record<Field, string>>,
  line: number,
): SpotSeed | string {
  const get = (f: Field) => (columns[f] ? row[columns[f]]?.trim() : undefined);
  const lat = Number(get('lat'));
  const lng = Number(get('lng'));
  const name = get('name');

  if (!name) return `line ${line}: name が空です`;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90)
    return `line ${line}: 緯度が不正です (${get('lat')})`;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180)
    return `line ${line}: 経度が不正です (${get('lng')})`;

  const used = new Set(Object.values(columns));
  const attributes = Object.fromEntries(
    Object.entries(row).filter(([k, v]) => !used.has(k) && v !== ''),
  );

  // IDの列がない場合は内容からハッシュを作り、再実行しても同じIDになるようにする
  const sourceId =
    get('id') ||
    createHash('sha1').update(`${name}|${lat}|${lng}`).digest('hex');

  return {
    sourceId,
    name,
    category: get('category') || null,
    address: get('address') || null,
    lat,
    lng,
    attributes,
  };
}

async function upsert(dataSource: DataSource, spots: SpotSeed[]) {
  const CHUNK = 200;
  await dataSource.transaction(async (manager) => {
    for (let i = 0; i < spots.length; i += CHUNK) {
      const chunk = spots.slice(i, i + CHUNK);
      const params: unknown[] = [];
      const values = chunk.map((s) => {
        const b = params.length;
        params.push(
          s.sourceId,
          s.name,
          s.category,
          s.address,
          s.lng,
          s.lat,
          JSON.stringify(s.attributes),
        );
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4},
          ST_SetSRID(ST_MakePoint($${b + 5}, $${b + 6}), 4326)::geography, $${b + 7}::jsonb)`;
      });
      await manager.query(
        `INSERT INTO spots (source_id, name, category, address, location, attributes)
         VALUES ${values.join(',')}
         ON CONFLICT (source_id) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           address = EXCLUDED.address,
           location = EXCLUDED.location,
           attributes = EXCLUDED.attributes,
           updated_at = now()`,
        params,
      );
    }
  });
}

async function main() {
  const file = path.resolve(
    process.env.SEED_FILE ?? 'seed/spots.csv',
  );
  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();

  try {
    const migrations = await dataSource.runMigrations({ transaction: 'each' });
    console.log(`[seed] migrations applied: ${migrations.length}`);

    const raw = await readFile(file, 'utf8');
    const rows: Row[] = parse(raw, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
    });
    if (rows.length === 0) throw new Error(`CSVが空です: ${file}`);

    const columns = resolveColumns(Object.keys(rows[0]));
    if (!columns.name || !columns.lat || !columns.lng) {
      throw new Error(
        `必須列(name/lat/lng)が見つかりません。ヘッダー: ${Object.keys(rows[0]).join(', ')}`,
      );
    }

    const spots: SpotSeed[] = [];
    const errors: string[] = [];
    rows.forEach((row, i) => {
      const r = toSeed(row, columns, i + 2); // ヘッダーが1行目
      if (typeof r === 'string') errors.push(r);
      else spots.push(r);
    });
    errors.forEach((e) => console.warn(`[seed] skip ${e}`));

    // 同じIDが複数行ある場合は後の行を採用（1回のINSERTで同じキーを2回更新できないため）
    const unique = [...new Map(spots.map((s) => [s.sourceId, s])).values()];
    if (unique.length !== spots.length) {
      console.warn(`[seed] duplicated ids: ${spots.length - unique.length}`);
    }

    await upsert(dataSource, unique);
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM spots',
    );
    console.log(
      `[seed] upserted ${unique.length} rows (skipped ${errors.length}), total in db: ${count}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});

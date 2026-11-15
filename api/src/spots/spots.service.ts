import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Spot } from './spot.entity.js';
import type { SearchSpotsQuery } from './dto/search-spots.query.js';

export interface SpotItem {
  id: number;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  distanceM: number;
  attributes: Record<string, string>;
}

export interface SearchResult {
  center: { lat: number; lng: number };
  radiusKm: number;
  /** 半径内の総件数（limitで切った場合でも本来の件数がわかるように返す） */
  total: number;
  items: SpotItem[];
}

export interface SpotsSummary {
  count: number;
  /** 地図の初期表示に使う、データ全体の範囲 */
  bounds: { south: number; west: number; north: number; east: number } | null;
  /** 半径10km以内に最も多くのスポットがある地点。地図の初期表示の中心に使う */
  initialCenter: { lat: number; lng: number } | null;
  /** カテゴリごとの件数（多い順）。画面の絞り込みと凡例に使う */
  categories: { name: string; count: number }[];
}

interface RawSpot {
  id: number;
  name: string;
  category: string | null;
  address: string | null;
  lat: string;
  lng: string;
  distance_m: string;
  attributes: Record<string, string>;
}

@Injectable()
export class SpotsService {
  constructor(
    @InjectRepository(Spot) private readonly spots: Repository<Spot>,
  ) {}

  async search({ lat, lng, radiusKm, limit, categories }: SearchSpotsQuery): Promise<SearchResult> {
    const radiusM = radiusKm * 1000;
    const center = 'ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography';

    // ST_DWithin は GiST インデックスを使えるため、全件の距離計算をせずに絞り込める
    const qb = this.spots
      .createQueryBuilder('s')
      .where(`ST_DWithin(s.location, ${center}, :radiusM)`, { lat, lng, radiusM });

    // カテゴリは半径で絞った後の少数行に対する条件なので、専用のインデックスは張っていない
    if (categories && categories.length > 0) {
      qb.andWhere('s.category IN (:...categories)', { categories });
    }

    const [rows, total] = await Promise.all([
      qb
        .clone()
        .select([
          's.id AS id',
          's.name AS name',
          's.category AS category',
          's.address AS address',
          's.attributes AS attributes',
          'ST_Y(s.location::geometry) AS lat',
          'ST_X(s.location::geometry) AS lng',
          `ST_Distance(s.location, ${center}) AS distance_m`,
        ])
        .orderBy('distance_m', 'ASC')
        .limit(limit)
        .getRawMany<RawSpot>(),
      qb.getCount(),
    ]);

    return {
      center: { lat, lng },
      radiusKm,
      total,
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        address: r.address,
        lat: Number(r.lat),
        lng: Number(r.lng),
        distanceM: Math.round(Number(r.distance_m)),
        attributes: r.attributes,
      })),
    };
  }

  async summary(): Promise<SpotsSummary> {
    const [row] = await this.spots.query<
      { count: string; south: number | null; west: number | null; north: number | null; east: number | null }[]
    >(`
      SELECT count(*) AS count,
             ST_YMin(ST_Extent(location::geometry)) AS south,
             ST_XMin(ST_Extent(location::geometry)) AS west,
             ST_YMax(ST_Extent(location::geometry)) AS north,
             ST_XMax(ST_Extent(location::geometry)) AS east
      FROM spots
    `);
    if (!row || row.south === null) {
      return { count: 0, bounds: null, initialCenter: null, categories: [] };
    }

    const categories = await this.spots.query<{ name: string; count: string }[]>(`
      SELECT category AS name, count(*) AS count
      FROM spots
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count(*) DESC, category
    `);

    // データは全国に散らばっているため、全体を表示すると半径数kmの円が見えないほど小さくなる。
    // そこで「周辺のスポットが最も多い地点」を初期表示の中心にする（件数が少ないので自己結合で十分）
    const [dense] = await this.spots.query<{ lat: number; lng: number }[]>(`
      SELECT ST_Y(a.location::geometry) AS lat, ST_X(a.location::geometry) AS lng
      FROM spots a
      JOIN spots b ON ST_DWithin(a.location, b.location, 10000)
      GROUP BY a.id
      ORDER BY count(*) DESC, a.id
      LIMIT 1
    `);

    return {
      count: Number(row.count),
      bounds: { south: row.south, west: row.west!, north: row.north!, east: row.east! },
      initialCenter: dense ? { lat: Number(dense.lat), lng: Number(dense.lng) } : null,
      categories: categories.map((c) => ({ name: c.name, count: Number(c.count) })),
    };
  }
}

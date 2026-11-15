export const GEOCODER = Symbol('GEOCODER');

/** 地名・住所の検索結果（1件） */
export interface GeocodeHit {
  /** 表示名（施設名や地名） */
  name: string;
  /** 住所（都道府県→市区町村→町名）。組み立てられない場合は null */
  address: string | null;
  lat: number;
  lng: number;
  /** その場所の範囲（市なら市全体など）。地図のズームに使う。点のみの場合は null */
  bounds: { south: number; west: number; north: number; east: number } | null;
}

/** ジオコーディングの提供元（Nominatim / Google）を差し替えられるようにするためのインターフェース */
export interface Geocoder {
  readonly name: string;
  /** 座標 → 住所（逆ジオコーディング）。住所が見つからない地点（海上など）は null を返す */
  reverse(lat: number, lng: number): Promise<string | null>;
  /** 地名・住所 → 座標（検索）。見つからなければ空配列 */
  search(query: string, limit: number): Promise<GeocodeHit[]>;
}

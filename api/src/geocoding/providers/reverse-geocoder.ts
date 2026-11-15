export const REVERSE_GEOCODER = Symbol('REVERSE_GEOCODER');

/** 逆ジオコーディングの提供元を差し替えられるようにするためのインターフェース */
export interface ReverseGeocoder {
  readonly name: string;
  /** 住所が見つからない地点（海上など）は null を返す */
  reverse(lat: number, lng: number): Promise<string | null>;
}

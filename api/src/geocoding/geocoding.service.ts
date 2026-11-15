import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LruCache } from './lru-cache.js';
import { GEOCODER, type GeocodeHit, type Geocoder } from './providers/geocoder.js';

export interface ReverseGeocodeResult {
  address: string | null;
  provider: string;
  cached: boolean;
}

export interface GeocodeSearchResult {
  query: string;
  hits: GeocodeHit[];
  provider: string;
  cached: boolean;
}

/**
 * 座標を丸める桁数。小数第4位 ≒ 約11m（緯度方向）。
 * 住所表示（町名レベル）ではこの程度の誤差は問題にならず、
 * 近い座標をまとめて同じキャッシュに当てられる。
 */
const PRECISION = 4;
/** 検索結果の上限。候補を選ぶ UI に出す件数 */
const SEARCH_LIMIT = 5;

@Injectable()
export class GeocodingService {
  private readonly reverseCache = new LruCache<string | null>(10_000, 24 * 60 * 60 * 1000);
  /** 検索は入力の揺れが多くヒット率が低いので、件数・期間とも小さめにする */
  private readonly searchCache = new LruCache<GeocodeHit[]>(1_000, 60 * 60 * 1000);
  /** 同じ問い合わせの同時リクエストを1回の外部API呼び出しにまとめる */
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(@Inject(GEOCODER) private readonly geocoder: Geocoder) {}

  async reverse(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const rLat = Number(lat.toFixed(PRECISION));
    const rLng = Number(lng.toFixed(PRECISION));
    const key = `reverse:${rLat},${rLng}`;

    const cached = this.reverseCache.get(key);
    if (cached !== undefined) {
      return { address: cached, provider: this.geocoder.name, cached: true };
    }
    const address = await this.dedupe(key, () => this.geocoder.reverse(rLat, rLng));
    this.reverseCache.set(key, address);
    return { address, provider: this.geocoder.name, cached: false };
  }

  async search(rawQuery: string): Promise<GeocodeSearchResult> {
    // 前後の空白と連続した空白を正規化し、同じ意味の入力は同じキャッシュに当てる
    const query = rawQuery.trim().replace(/\s+/g, ' ');
    if (query === '') return { query, hits: [], provider: this.geocoder.name, cached: false };
    const key = `search:${query}`;

    const cached = this.searchCache.get(key);
    if (cached !== undefined) {
      return { query, hits: cached, provider: this.geocoder.name, cached: true };
    }
    const hits = await this.dedupe(key, () => this.geocoder.search(query, SEARCH_LIMIT));
    this.searchCache.set(key, hits);
    return { query, hits, provider: this.geocoder.name, cached: false };
  }

  /** 同じキーの外部API呼び出しが進行中なら、その結果を待って共有する */
  private async dedupe<T>(key: string, call: () => Promise<T>): Promise<T> {
    let pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = call().finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    try {
      return await pending;
    } catch {
      // 外部APIの障害はキャッシュしない（復旧後すぐに取れるように）
      throw new ServiceUnavailableException('地名・住所の取得に失敗しました');
    }
  }
}

import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LruCache } from './lru-cache.js';
import { REVERSE_GEOCODER, type ReverseGeocoder } from './providers/reverse-geocoder.js';

export interface ReverseGeocodeResult {
  address: string | null;
  provider: string;
  cached: boolean;
}

/**
 * 座標を丸める桁数。小数第4位 ≒ 約11m（緯度方向）。
 * 住所表示（町名レベル）ではこの程度の誤差は問題にならず、
 * 近い座標をまとめて同じキャッシュに当てられる。
 */
const PRECISION = 4;

@Injectable()
export class GeocodingService {
  private readonly cache = new LruCache<string | null>(10_000, 24 * 60 * 60 * 1000);
  /** 同じ地点への同時リクエストを1回の外部API呼び出しにまとめる */
  private readonly inFlight = new Map<string, Promise<string | null>>();

  constructor(@Inject(REVERSE_GEOCODER) private readonly geocoder: ReverseGeocoder) {}

  async reverse(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const rLat = Number(lat.toFixed(PRECISION));
    const rLng = Number(lng.toFixed(PRECISION));
    const key = `${rLat},${rLng}`;

    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return { address: cached, provider: this.geocoder.name, cached: true };
    }

    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.geocoder.reverse(rLat, rLng).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }

    try {
      const address = await pending;
      this.cache.set(key, address);
      return { address, provider: this.geocoder.name, cached: false };
    } catch {
      // 外部APIの障害はキャッシュしない（復旧後すぐに取れるように）
      throw new ServiceUnavailableException('住所の取得に失敗しました');
    }
  }
}

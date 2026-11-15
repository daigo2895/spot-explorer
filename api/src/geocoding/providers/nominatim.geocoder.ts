import { Logger } from '@nestjs/common';
import type { GeocodeHit, Geocoder } from './geocoder.js';

interface NominatimReverseResponse {
  display_name?: string;
  error?: string;
  address?: Record<string, string>;
}

interface NominatimSearchItem {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  /** [south, north, west, east]（文字列） */
  boundingbox?: [string, string, string, string];
  address?: Record<string, string>;
}

/**
 * OpenStreetMap の Nominatim（公開インスタンス）を使う実装。APIキー不要。
 * 利用ポリシーにより「アプリ全体で最大1リクエスト/秒」「アプリを識別できる User-Agent 必須」。
 * そのため、逆ジオコーディングと検索の両方を同じキューで直列化して間隔を空ける。
 */
export class NominatimGeocoder implements Geocoder {
  readonly name = 'nominatim';
  private readonly logger = new Logger(NominatimGeocoder.name);
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(
    private readonly userAgent: string,
    private readonly baseUrl = 'https://nominatim.openstreetmap.org',
    private readonly minIntervalMs = 1100,
  ) {}

  reverse(lat: number, lng: number): Promise<string | null> {
    return this.enqueue(async () => {
      const body = await this.request<NominatimReverseResponse>('/reverse', {
        lat: String(lat),
        lon: String(lng),
        zoom: '18',
      });
      if (body.error || !body.address) return null;
      return formatJapaneseAddress(body.address) ?? body.display_name ?? null;
    });
  }

  search(query: string, limit: number): Promise<GeocodeHit[]> {
    return this.enqueue(async () => {
      const items = await this.request<NominatimSearchItem[]>('/search', {
        q: query,
        limit: String(limit),
        countrycodes: 'jp',
      });
      return items.map((item) => {
        const address = item.address ? formatJapaneseAddress(item.address) : null;
        const [south, north, west, east] = (item.boundingbox ?? []).map(Number);
        return {
          name: item.name || item.display_name.split(',')[0].trim(),
          address: address ?? item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
          bounds: item.boundingbox ? { south, west, north, east } : null,
        };
      });
    });
  }

  /** 呼び出しを直列にし、前回から minIntervalMs 空けてから実行する */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastRequestAt = Date.now();
      return task();
    });
    // 失敗しても後続のキューが止まらないようにする
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    url.search = new URLSearchParams({
      ...params,
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': 'ja',
    }).toString();

    const res = await fetch(url, {
      headers: { 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      this.logger.warn(`nominatim ${path} responded ${res.status}`);
      throw new Error(`nominatim error: ${res.status}`);
    }
    return (await res.json()) as T;
  }
}

/**
 * Nominatim の display_name は「番地, 町, 区, 都道府県, 郵便番号, 日本」と逆順なので、
 * 日本の住所表記（都道府県 → 市区町村 → 町名）に組み立て直す。
 */
function formatJapaneseAddress(a: Record<string, string>): string | null {
  if (a.country_code && a.country_code !== 'jp') return null;
  const parts = [
    a.province ?? a.state,
    a.city ?? a.town ?? a.village ?? a.county,
    a.city_district ?? a.suburb,
    a.quarter,
    a.neighbourhood,
  ].filter((p): p is string => Boolean(p));
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length > 0 ? unique.join('') : null;
}

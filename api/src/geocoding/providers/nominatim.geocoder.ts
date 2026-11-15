import { Logger } from '@nestjs/common';
import { formatJapaneseAddress } from './japanese-address.js';
import type { ReverseGeocoder } from './reverse-geocoder.js';

interface NominatimResponse {
  display_name?: string;
  error?: string;
  address?: Record<string, string>;
}

/**
 * OpenStreetMap の Nominatim（公開インスタンス）を使う実装。APIキー不要。
 * 利用ポリシーにより「アプリ全体で最大1リクエスト/秒」「アプリを識別できる User-Agent 必須」。
 * そのため、ここで呼び出しを直列化して間隔を空ける。
 */
export class NominatimGeocoder implements ReverseGeocoder {
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
    const task = this.queue.then(() => this.request(lat, lng));
    // 失敗しても後続のキューが止まらないようにする
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async request(lat: number, lng: number): Promise<string | null> {
    const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();

    const url = new URL('/reverse', this.baseUrl);
    url.search = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      zoom: '18',
      addressdetails: '1',
      'accept-language': 'ja',
    }).toString();

    const res = await fetch(url, {
      headers: { 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      this.logger.warn(`nominatim responded ${res.status}`);
      throw new Error(`nominatim error: ${res.status}`);
    }
    const body = (await res.json()) as NominatimResponse;
    if (body.error || !body.address) return null;
    return formatJapaneseAddress(body.address) ?? body.display_name ?? null;
  }
}

import { Logger } from '@nestjs/common';
import type { ReverseGeocoder } from './reverse-geocoder.js';

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results: { formatted_address: string }[];
}

/**
 * Google Geocoding API を使う実装。環境変数 GOOGLE_MAPS_API_KEY がある場合に使われる。
 * APIキーをブラウザに出さないため、必ずバックエンド経由で呼ぶ。
 */
export class GoogleGeocoder implements ReverseGeocoder {
  readonly name = 'google';
  private readonly logger = new Logger(GoogleGeocoder.name);

  constructor(private readonly apiKey: string) {}

  async reverse(lat: number, lng: number): Promise<string | null> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.search = new URLSearchParams({
      latlng: `${lat},${lng}`,
      language: 'ja',
      key: this.apiKey,
    }).toString();

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = (await res.json()) as GoogleGeocodeResponse;
    if (body.status === 'ZERO_RESULTS') return null;
    if (body.status !== 'OK') {
      this.logger.warn(`google geocode status=${body.status} ${body.error_message ?? ''}`);
      throw new Error(`google geocode error: ${body.status}`);
    }
    // 例: 「日本、〒100-0005 東京都千代田区丸の内１丁目」→ 国名と郵便番号を除く
    return body.results[0].formatted_address
      .replace(/^日本、/, '')
      .replace(/^〒\d{3}-\d{4}\s*/, '');
  }
}

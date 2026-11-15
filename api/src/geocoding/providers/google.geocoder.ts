import { Logger } from '@nestjs/common';
import type { GeocodeHit, Geocoder } from './geocoder.js';

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results: {
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
      viewport?: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
    };
  }[];
}

/**
 * Google Geocoding API を使う実装。環境変数 GOOGLE_MAPS_API_KEY がある場合に使われる。
 * APIキーをブラウザに出さないため、必ずバックエンド経由で呼ぶ。
 */
export class GoogleGeocoder implements Geocoder {
  readonly name = 'google';
  private readonly logger = new Logger(GoogleGeocoder.name);

  constructor(private readonly apiKey: string) {}

  async reverse(lat: number, lng: number): Promise<string | null> {
    const body = await this.request({ latlng: `${lat},${lng}` });
    if (body.results.length === 0) return null;
    return stripCountryAndPostalCode(body.results[0].formatted_address);
  }

  async search(query: string, limit: number): Promise<GeocodeHit[]> {
    const body = await this.request({ address: query, region: 'jp' });
    return body.results.slice(0, limit).map((r) => {
      const address = stripCountryAndPostalCode(r.formatted_address);
      const v = r.geometry.viewport;
      return {
        name: address,
        address,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        bounds: v
          ? { south: v.southwest.lat, west: v.southwest.lng, north: v.northeast.lat, east: v.northeast.lng }
          : null,
      };
    });
  }

  private async request(params: Record<string, string>): Promise<GoogleGeocodeResponse> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.search = new URLSearchParams({ ...params, language: 'ja', key: this.apiKey }).toString();

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = (await res.json()) as GoogleGeocodeResponse;
    if (body.status === 'ZERO_RESULTS') return { status: body.status, results: [] };
    if (body.status !== 'OK') {
      this.logger.warn(`google geocode status=${body.status} ${body.error_message ?? ''}`);
      throw new Error(`google geocode error: ${body.status}`);
    }
    return body;
  }
}

/** 例: 「日本、〒100-0005 東京都千代田区丸の内１丁目」→ 国名と郵便番号を除く */
function stripCountryAndPostalCode(formatted: string): string {
  return formatted.replace(/^日本、/, '').replace(/^〒\d{3}-\d{4}\s*/, '');
}

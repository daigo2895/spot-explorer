import { ServiceUnavailableException } from '@nestjs/common';
import { GeocodingService } from './geocoding.service.js';
import type { GeocodeHit, Geocoder } from './providers/geocoder.js';

function createGeocoder(
  reverse: Geocoder['reverse'] = async () => null,
  search: Geocoder['search'] = async () => [],
) {
  return { name: 'fake', reverse: vi.fn(reverse), search: vi.fn(search) } satisfies Geocoder;
}

const HIT: GeocodeHit = { name: '浅草寺', address: '東京都台東区浅草', lat: 35.71, lng: 139.79, bounds: null };

describe('GeocodingService.reverse', () => {
  it('約11m以内の座標は同じキャッシュを使い、外部APIを1回しか呼ばない', async () => {
    const geocoder = createGeocoder(async () => '東京都千代田区丸の内');
    const service = new GeocodingService(geocoder);

    const first = await service.reverse(35.681236, 139.767125);
    const second = await service.reverse(35.681249, 139.767101);

    expect(first).toEqual({ address: '東京都千代田区丸の内', provider: 'fake', cached: false });
    expect(second.cached).toBe(true);
    expect(geocoder.reverse).toHaveBeenCalledTimes(1);
  });

  it('同じ地点への同時リクエストは1回の呼び出しにまとめる', async () => {
    const geocoder = createGeocoder(
      () => new Promise((resolve) => setTimeout(() => resolve('住所'), 10)),
    );
    const service = new GeocodingService(geocoder);

    await Promise.all([service.reverse(35.68, 139.76), service.reverse(35.68, 139.76)]);

    expect(geocoder.reverse).toHaveBeenCalledTimes(1);
  });

  it('外部APIのエラーはキャッシュせず、503を返す', async () => {
    const geocoder = createGeocoder(async () => {
      throw new Error('down');
    });
    const service = new GeocodingService(geocoder);

    await expect(service.reverse(35.68, 139.76)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.reverse(35.68, 139.76)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(geocoder.reverse).toHaveBeenCalledTimes(2);
  });
});

describe('GeocodingService.search', () => {
  it('空白の違いだけの検索語は同じキャッシュを使い、外部APIを1回しか呼ばない', async () => {
    const geocoder = createGeocoder(undefined, async () => [HIT]);
    const service = new GeocodingService(geocoder);

    const first = await service.search(' 浅草  寺 ');
    const second = await service.search('浅草 寺');

    expect(first).toEqual({ query: '浅草 寺', hits: [HIT], provider: 'fake', cached: false });
    expect(second.cached).toBe(true);
    expect(geocoder.search).toHaveBeenCalledTimes(1);
    expect(geocoder.search).toHaveBeenCalledWith('浅草 寺', 5);
  });

  it('空の検索語は外部APIを呼ばず、空の結果を返す', async () => {
    const geocoder = createGeocoder();
    const service = new GeocodingService(geocoder);

    const result = await service.search('   ');

    expect(result.hits).toEqual([]);
    expect(geocoder.search).not.toHaveBeenCalled();
  });

  it('外部APIのエラーは503を返す', async () => {
    const geocoder = createGeocoder(undefined, async () => {
      throw new Error('down');
    });
    const service = new GeocodingService(geocoder);

    await expect(service.search('浅草')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

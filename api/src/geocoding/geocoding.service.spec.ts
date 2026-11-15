import { ServiceUnavailableException } from '@nestjs/common';
import { GeocodingService } from './geocoding.service.js';
import type { ReverseGeocoder } from './providers/reverse-geocoder.js';

function createGeocoder(impl: ReverseGeocoder['reverse']) {
  return { name: 'fake', reverse: vi.fn(impl) } satisfies ReverseGeocoder;
}

describe('GeocodingService', () => {
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

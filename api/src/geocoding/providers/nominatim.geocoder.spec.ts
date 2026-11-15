import { NominatimGeocoder } from './nominatim.geocoder.js';

describe('NominatimGeocoder', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('住所を「都道府県→市区町村→町名」の順に組み立てる', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        display_name: '1丁目, 丸の内, 千代田区, 東京都, 100-0005, 日本',
        address: {
          neighbourhood: '1丁目',
          quarter: '丸の内',
          city: '千代田区',
          province: '東京都',
          country_code: 'jp',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const geocoder = new NominatimGeocoder('test-agent', 'https://example.com', 0);
    await expect(geocoder.reverse(35.68, 139.76)).resolves.toBe('東京都千代田区丸の内1丁目');

    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.headers).toEqual({ 'User-Agent': 'test-agent' });
  });

  it('住所が見つからない地点（海上など）は null を返す', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Unable to geocode' })));
    const geocoder = new NominatimGeocoder('test-agent', 'https://example.com', 0);
    await expect(geocoder.reverse(35, 140)).resolves.toBeNull();
  });

  it('連続した呼び出しは、指定した間隔を空けて直列に実行する', async () => {
    const calledAt: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calledAt.push(Date.now());
        return Response.json({ address: { city: '千代田区', country_code: 'jp' } });
      }),
    );
    const geocoder = new NominatimGeocoder('test-agent', 'https://example.com', 100);
    await Promise.all([geocoder.reverse(1, 1), geocoder.reverse(2, 2)]);
    expect(calledAt[1] - calledAt[0]).toBeGreaterThanOrEqual(95);
  });
});

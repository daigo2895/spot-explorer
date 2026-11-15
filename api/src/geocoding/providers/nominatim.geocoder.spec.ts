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

  it('検索結果を名前・住所・座標・範囲に整形し、日本国内に限定して問い合わせる', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        {
          lat: '35.7147651',
          lon: '139.7966553',
          name: '浅草寺',
          display_name: '浅草寺, 2丁目, 浅草, 台東区, 東京都, 111-0032, 日本',
          boundingbox: ['35.7140000', '35.7155000', '139.7960000', '139.7975000'],
          address: { quarter: '浅草', city: '台東区', province: '東京都', country_code: 'jp' },
        },
        {
          lat: '35.0',
          lon: '135.0',
          display_name: '浅草寺前, 何か, 日本',
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const geocoder = new NominatimGeocoder('test-agent', 'https://example.com', 0);
    const hits = await geocoder.search('浅草寺', 5);

    expect(hits).toEqual([
      {
        name: '浅草寺',
        address: '東京都台東区浅草',
        lat: 35.7147651,
        lng: 139.7966553,
        bounds: { south: 35.714, west: 139.796, north: 35.7155, east: 139.7975 },
      },
      // name と address がない結果は display_name から補う
      { name: '浅草寺前', address: '浅草寺前, 何か, 日本', lat: 35, lng: 135, bounds: null },
    ]);
    const [url] = fetchMock.mock.calls.at(-1) as unknown as [URL];
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('浅草寺');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('countrycodes')).toBe('jp');
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
    // 逆ジオコーディングと検索は同じキューを使う（利用ポリシーの1リクエスト/秒はアプリ全体の上限のため）
    await Promise.all([geocoder.reverse(1, 1), geocoder.search('x', 5).catch(() => undefined)]);
    expect(calledAt[1] - calledAt[0]).toBeGreaterThanOrEqual(95);
  });
});

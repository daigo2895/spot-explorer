import { formatJapaneseAddress } from './japanese-address.js';

describe('formatJapaneseAddress', () => {
  it('都道府県 → 市区町村 → 町名の順に組み立てる', () => {
    expect(
      formatJapaneseAddress({ province: '大阪府', city: '大阪市', city_district: '北区', quarter: '梅田' }),
    ).toBe('大阪府大阪市北区梅田');
  });

  it('都道府県名がなく ISO コードだけの場合（東京23区など）は、コードから補う', () => {
    expect(
      formatJapaneseAddress({ 'ISO3166-2-lvl4': 'JP-13', city: '千代田区', quarter: '丸の内' }),
    ).toBe('東京都千代田区丸の内');
  });

  it('「丸の内」「丸の内一丁目」のように重なる要素は、詳しい方だけを残す', () => {
    expect(
      formatJapaneseAddress({
        'ISO3166-2-lvl4': 'JP-13',
        city: '千代田区',
        quarter: '丸の内',
        neighbourhood: '丸の内一丁目',
      }),
    ).toBe('東京都千代田区丸の内一丁目');
  });

  it('同じ名前が2回返る場合は1つにする', () => {
    expect(formatJapaneseAddress({ province: '東京都', city: '渋谷区', suburb: '渋谷', quarter: '渋谷' })).toBe(
      '東京都渋谷区渋谷',
    );
  });

  it('日本国外は null', () => {
    expect(formatJapaneseAddress({ country_code: 'us', state: 'California' })).toBeNull();
  });

  it('組み立てられる要素がなければ null', () => {
    expect(formatJapaneseAddress({ country_code: 'jp', postcode: '100-0005' })).toBeNull();
  });
});

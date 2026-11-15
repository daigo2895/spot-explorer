/**
 * Nominatim の address 要素から日本の住所表記（都道府県 → 市区町村 → 町名）を組み立てる。
 * display_name は「番地, 町, 区, 都道府県, 郵便番号, 日本」と逆順で、そのままでは読みにくいため。
 */

/** ISO 3166-2 の都道府県コード → 名前。東京23区などでは都道府県名が返らず、このコードだけが返る */
const PREFECTURE_BY_ISO: Record<string, string> = {
  'JP-01': '北海道', 'JP-02': '青森県', 'JP-03': '岩手県', 'JP-04': '宮城県', 'JP-05': '秋田県',
  'JP-06': '山形県', 'JP-07': '福島県', 'JP-08': '茨城県', 'JP-09': '栃木県', 'JP-10': '群馬県',
  'JP-11': '埼玉県', 'JP-12': '千葉県', 'JP-13': '東京都', 'JP-14': '神奈川県', 'JP-15': '新潟県',
  'JP-16': '富山県', 'JP-17': '石川県', 'JP-18': '福井県', 'JP-19': '山梨県', 'JP-20': '長野県',
  'JP-21': '岐阜県', 'JP-22': '静岡県', 'JP-23': '愛知県', 'JP-24': '三重県', 'JP-25': '滋賀県',
  'JP-26': '京都府', 'JP-27': '大阪府', 'JP-28': '兵庫県', 'JP-29': '奈良県', 'JP-30': '和歌山県',
  'JP-31': '鳥取県', 'JP-32': '島根県', 'JP-33': '岡山県', 'JP-34': '広島県', 'JP-35': '山口県',
  'JP-36': '徳島県', 'JP-37': '香川県', 'JP-38': '愛媛県', 'JP-39': '高知県', 'JP-40': '福岡県',
  'JP-41': '佐賀県', 'JP-42': '長崎県', 'JP-43': '熊本県', 'JP-44': '大分県', 'JP-45': '宮崎県',
  'JP-46': '鹿児島県', 'JP-47': '沖縄県',
};

/** 日本国外、または組み立てられる要素がない場合は null */
export function formatJapaneseAddress(a: Record<string, string>): string | null {
  if (a.country_code && a.country_code !== 'jp') return null;
  const parts = [
    a.province ?? a.state ?? PREFECTURE_BY_ISO[a['ISO3166-2-lvl4']],
    a.city ?? a.town ?? a.village ?? a.county,
    a.city_district ?? a.suburb,
    a.quarter,
    a.neighbourhood,
  ].filter((p): p is string => Boolean(p));

  // 「丸の内」「丸の内一丁目」のように、次の要素が前の要素を含んで始まる場合は前の要素を省く
  // （同じ名前が2回返る場合もこれで1つになる）
  const deduped = parts.filter((p, i) => i === parts.length - 1 || !parts[i + 1].startsWith(p));
  return deduped.length > 0 ? deduped.join('') : null;
}

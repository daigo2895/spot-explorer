/**
 * カテゴリごとのマーカー色。summary のカテゴリ一覧（件数の多い順）に対して順に割り当てる。
 * 色の数より多いカテゴリがあれば先頭から繰り返す。
 */
const PALETTE = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#d946ef", // fuchsia
  "#eab308", // yellow
  "#0ea5e9", // sky
];

/** カテゴリが未設定、または一覧にないスポットの色 */
export const DEFAULT_COLOR = "#64748b";

export type CategoryColorMap = ReadonlyMap<string, string>;

export function buildCategoryColors(categories: { name: string }[]): CategoryColorMap {
  return new Map(categories.map((c, i) => [c.name, PALETTE[i % PALETTE.length]]));
}

export function categoryColor(colors: CategoryColorMap, category: string | null): string {
  return (category && colors.get(category)) || DEFAULT_COLOR;
}

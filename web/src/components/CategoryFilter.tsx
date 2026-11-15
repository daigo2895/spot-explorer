import type { CategoryCount } from "@/lib/api";
import { categoryColor, type CategoryColorMap } from "@/lib/categoryColors";

interface Props {
  categories: CategoryCount[];
  colors: CategoryColorMap;
  /** 選択中のカテゴリ。空なら全カテゴリ */
  selected: string[];
  onChange: (selected: string[]) => void;
}

/** カテゴリの絞り込み。チップの色はマーカーと同じで、凡例を兼ねる */
export function CategoryFilter({ categories, colors, selected, onChange }: Props) {
  if (categories.length === 0) return null;

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name]);

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm font-medium">
        カテゴリ
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs font-normal text-blue-600 underline">
            すべて表示
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const active = selected.length === 0 || selected.includes(c.name);
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={selected.includes(c.name)}
              onClick={() => toggle(c.name)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                active ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-100 text-slate-400"
              } ${selected.includes(c.name) ? "ring-2 ring-blue-500" : ""}`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: categoryColor(colors, c.name), opacity: active ? 1 : 0.4 }}
              />
              {c.name}
              <span className="text-slate-400">{c.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

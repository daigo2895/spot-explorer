const PRESETS = [1, 5, 10, 50];
export const MIN_RADIUS_KM = 0.5;
export const MAX_RADIUS_KM = 50;

export function RadiusControl({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  return (
    <div>
      <label htmlFor="radius" className="flex items-baseline justify-between text-sm font-medium">
        検索半径
        <span className="text-base font-bold text-blue-600">{value} km</span>
      </label>
      <input
        id="radius"
        type="range"
        min={MIN_RADIUS_KM}
        max={MAX_RADIUS_KM}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-blue-600"
      />
      <div className="mt-1 flex gap-2">
        {PRESETS.map((km) => (
          <button
            key={km}
            type="button"
            onClick={() => onChange(km)}
            className={`flex-1 rounded border px-2 py-1 text-xs ${
              value === km ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 hover:bg-slate-100"
            }`}
          >
            {km} km
          </button>
        ))}
      </div>
    </div>
  );
}

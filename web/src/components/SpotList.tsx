import { useEffect, useRef } from "react";
import type { SpotSearchState } from "@/hooks/useSpotSearch";
import { formatDistance } from "@/lib/geo";
import { MAX_RADIUS_KM } from "./RadiusControl";

interface Props {
  state: SpotSearchState & { retry: () => void };
  radiusKm: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onExpandRadius: (km: number) => void;
}

export function SpotList({ state, radiusKm, selectedId, onSelect, onExpandRadius }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  // 地図のマーカーを選んだら、一覧の該当行までスクロールする
  useEffect(() => {
    if (selectedId === null) return;
    listRef.current
      ?.querySelector(`[data-spot-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const expandTo = Math.min(MAX_RADIUS_KM, radiusKm * 2);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm">
        <span>
          <span className="font-bold">{state.spots.length}</span> 件
        </span>
        {state.status === "loading" && <span className="text-xs text-slate-500">検索中…</span>}
      </div>

      {state.status === "error" && (
        <div className="m-4 rounded bg-red-50 p-3 text-sm text-red-700">
          スポットを取得できませんでした。
          <button type="button" onClick={state.retry} className="ml-2 underline">
            再試行
          </button>
        </div>
      )}

      {state.status === "success" && state.spots.length === 0 && (
        <div className="m-4 rounded bg-slate-100 p-4 text-center text-sm text-slate-600">
          <p>半径 {radiusKm} km 以内にスポットはありません。</p>
          <p className="mt-1 text-xs">地図を動かすか、検索半径を広げてください。</p>
          {radiusKm < MAX_RADIUS_KM && (
            <button
              type="button"
              onClick={() => onExpandRadius(expandTo)}
              className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
            >
              半径を {expandTo} km に広げる
            </button>
          )}
        </div>
      )}

      <ul
        ref={listRef}
        className={`min-h-0 flex-1 overflow-y-auto ${state.status === "loading" ? "opacity-60" : ""}`}
      >
        {state.spots.map((spot) => (
          <li key={spot.id} data-spot-id={spot.id}>
            <button
              type="button"
              onClick={() => onSelect(spot.id === selectedId ? null : spot.id)}
              className={`w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-blue-50 ${
                spot.id === selectedId ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{spot.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatDistance(spot.distanceM)}</span>
              </div>
              {(spot.category || spot.address) && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {spot.category && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{spot.category}</span>
                  )}
                  {spot.address && <span className="truncate">{spot.address}</span>}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

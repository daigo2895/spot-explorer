import type { CenterAddressState } from "@/hooks/useCenterAddress";
import type { LatLng } from "@/lib/geo";

export function AddressBar({ state, center }: { state: CenterAddressState; center: LatLng | null }) {
  let text: string;
  let textClass = "";
  if (state.status === "error") {
    text = "住所を取得できませんでした（地図を動かすと再試行します）";
    textClass = "text-red-600";
  } else if (state.address) {
    text = state.address;
    if (state.status === "loading") textClass = "text-slate-500";
  } else if (state.status === "success") {
    text = "この地点の住所は見つかりませんでした";
    textClass = "text-slate-500";
  } else {
    text = "住所を取得中…";
    textClass = "text-slate-500";
  }

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-[1000] w-[min(92%,32rem)] -translate-x-1/2">
      <div className="rounded-lg bg-white/95 px-4 py-2 shadow-md ring-1 ring-slate-200">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>地図の中心</span>
          {state.status === "loading" && (
            <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
          )}
          {center && (
            <span className="ml-auto font-mono">
              {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
            </span>
          )}
        </div>
        <p className={`truncate text-sm font-medium ${textClass}`}>{text}</p>
      </div>
    </div>
  );
}

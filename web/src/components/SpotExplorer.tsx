"use client";

import { useEffect, useMemo, useState } from "react";
import { useCenterAddress } from "@/hooks/useCenterAddress";
import { useSpotSearch } from "@/hooks/useSpotSearch";
import { api, type SpotsSummary } from "@/lib/api";
import { buildCategoryColors } from "@/lib/categoryColors";
import type { LatLng } from "@/lib/geo";
import { AddressBar } from "./AddressBar";
import { CategoryFilter } from "./CategoryFilter";
import { PlaceSearch, type MapTarget } from "./PlaceSearch";
import { RadiusControl } from "./RadiusControl";
import { SpotList } from "./SpotList";
import { SpotMap } from "./SpotMap";

export function SpotExplorer() {
  const [summary, setSummary] = useState<SpotsSummary | null | "error">(null);
  /** 地図を動かしている最中も更新される中心（住所表示用） */
  const [liveCenter, setLiveCenter] = useState<LatLng | null>(null);
  /** 地図の移動が止まった時点の中心（スポット検索用） */
  const [searchCenter, setSearchCenter] = useState<LatLng | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  /** 絞り込むカテゴリ。空なら全カテゴリ */
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  /** 地名検索・現在地ボタンからの移動指示 */
  const [target, setTarget] = useState<(MapTarget & { seq: number }) | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .summary(controller.signal)
      .then(setSummary)
      .catch(() => !controller.signal.aborted && setSummary("error"));
    return () => controller.abort();
  }, []);

  const search = useSpotSearch(searchCenter, radiusKm, categories);
  const address = useCenterAddress(liveCenter);
  const allCategories = useMemo(() => (summary && summary !== "error" ? summary.categories : []), [summary]);
  const colors = useMemo(() => buildCategoryColors(allCategories), [allCategories]);

  if (summary === null) {
    return <div className="flex h-full items-center justify-center text-slate-500">データを読み込み中…</div>;
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="order-2 flex min-h-0 flex-1 flex-col border-slate-200 bg-white md:order-1 md:w-96 md:flex-none md:border-r">
        <header className="border-b border-slate-200 p-4">
          <h1 className="text-lg font-bold">スポット探索マップ</h1>
          <p className="mt-1 text-xs text-slate-500">
            地図を動かすと、中心（＋）から半径 {radiusKm} km 以内のスポットを表示します
          </p>
          <div className="mt-3">
            <PlaceSearch onNavigate={(t) => setTarget({ ...t, seq: (target?.seq ?? 0) + 1 })} />
          </div>
          <div className="mt-3">
            <RadiusControl value={radiusKm} onChange={setRadiusKm} />
          </div>
          <div className="mt-3">
            <CategoryFilter categories={allCategories} colors={colors} selected={categories} onChange={setCategories} />
          </div>
        </header>
        <SpotList
          state={search}
          radiusKm={radiusKm}
          colors={colors}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onExpandRadius={setRadiusKm}
        />
      </aside>

      <main className="relative order-1 h-[55vh] md:order-2 md:h-auto md:flex-1">
        <SpotMap
          initialCenter={summary === "error" ? null : summary.initialCenter}
          bounds={summary === "error" ? null : summary.bounds}
          spots={search.spots}
          colors={colors}
          searchCenter={searchCenter}
          radiusKm={radiusKm}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(c) => {
            setIsMoving(true);
            setLiveCenter(c);
          }}
          onMoveEnd={(c) => {
            setIsMoving(false);
            setLiveCenter(c);
            setSearchCenter(c);
          }}
          target={target}
        />
        <AddressBar state={address} center={liveCenter} />
        {(isMoving || search.status === "loading") && (
          <div className="pointer-events-none absolute right-3 bottom-8 z-[1000] rounded-full bg-slate-900/80 px-3 py-1 text-xs text-white">
            {isMoving ? "移動中…" : "検索中…"}
          </div>
        )}
      </main>
    </div>
  );
}

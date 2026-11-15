"use client";

import { useEffect, useRef, useState } from "react";
import { api, type GeocodeHit } from "@/lib/api";
import type { LatLng } from "@/lib/geo";

/** 地図の移動先。bounds があればその範囲に合わせ、なければ center を中心にズームする */
export interface MapTarget {
  center: LatLng;
  bounds: GeocodeHit["bounds"];
}

interface Props {
  onNavigate: (target: MapTarget) => void;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "results"; hits: GeocodeHit[] }
  | { status: "error"; message: string };

/** 地名・住所の検索と現在地ボタン。候補を選ぶと地図をその場所に移動する */
export function PlaceSearch({ onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const select = (hit: GeocodeHit) => {
    onNavigate({ center: { lat: hit.lat, lng: hit.lng }, bounds: hit.bounds });
    setSearch({ status: "idle" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setSearch({ status: "loading" });
    try {
      const { hits } = await api.geocodeSearch(q, controller.current.signal);
      // 候補が1件なら選ぶ手間を省いて即移動する
      if (hits.length === 1) select(hits[0]);
      else setSearch({ status: "results", hits });
    } catch (err) {
      if (controller.current.signal.aborted) return;
      setSearch({ status: "error", message: err instanceof Error ? err.message : "unknown error" });
    }
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("このブラウザでは現在地を取得できません");
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        onNavigate({ center: { lat: coords.latitude, lng: coords.longitude }, bounds: null });
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "位置情報の利用が許可されていません"
            : "現在地を取得できませんでした",
        );
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="地名・住所・施設名で移動"
          aria-label="地名・住所・施設名で移動"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={search.status === "loading" || !query.trim()}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {search.status === "loading" ? "検索中…" : "移動"}
        </button>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          title="現在地へ移動"
          aria-label="現在地へ移動"
          className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
          {locating ? "…" : "◎"}
        </button>
      </form>

      {search.status === "results" && search.hits.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">見つかりませんでした。別の言い方で試してください</p>
      )}
      {search.status === "results" && search.hits.length > 1 && (
        <ul className="mt-1 divide-y divide-slate-100 rounded border border-slate-200 bg-white text-sm">
          {search.hits.map((hit, i) => (
            <li key={`${hit.lat},${hit.lng},${i}`}>
              <button type="button" onClick={() => select(hit)} className="w-full px-2 py-1.5 text-left hover:bg-blue-50">
                <span className="font-medium">{hit.name}</span>
                {hit.address && hit.address !== hit.name && (
                  <span className="ml-2 text-xs text-slate-500">{hit.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.status === "error" && (
        <p className="mt-1 text-xs text-red-600">検索できませんでした（{search.message}）</p>
      )}
      {geoError && <p className="mt-1 text-xs text-red-600">{geoError}</p>}
    </div>
  );
}

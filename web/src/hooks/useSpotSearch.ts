"use client";

import { useEffect, useRef, useState } from "react";
import { api, type SearchResult, type Spot } from "@/lib/api";
import { distanceM, type LatLng } from "@/lib/geo";

/** 実際の検索半径より少し広く取得しておき、少し動かしただけなら再取得しない */
const PREFETCH_FACTOR = 1.5;
const MAX_RADIUS_KM = 100; // APIの上限に合わせる
const DEBOUNCE_MS = 300;

export type SearchStatus = "idle" | "loading" | "success" | "error";

export interface SpotSearchState {
  status: SearchStatus;
  spots: Spot[];
  /** 直近の結果がAPIを呼ばずにキャッシュから作られたか */
  fromCache: boolean;
  error: string | null;
}

/**
 * 取得済みの結果（中心C・半径R）が、新しい検索範囲（中心c・半径r）を完全に含むなら
 * その結果を使い回せる。条件: 距離(C, c) + r <= R
 */
function canReuse(prev: SearchResult, center: LatLng, radiusKm: number): boolean {
  const truncated = prev.total > prev.items.length;
  return !truncated && distanceM(prev.center, center) + radiusKm * 1000 <= prev.radiusKm * 1000;
}

function filterWithin(source: Spot[], center: LatLng, radiusKm: number): Spot[] {
  return source
    .map((s) => ({ ...s, distanceM: Math.round(distanceM(center, s)) }))
    .filter((s) => s.distanceM <= radiusKm * 1000)
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function useSpotSearch(center: LatLng | null, radiusKm: number): SpotSearchState & { retry: () => void } {
  const [state, setState] = useState<SpotSearchState>({
    status: "idle",
    spots: [],
    fromCache: false,
    error: null,
  });
  const [retryToken, setRetryToken] = useState(0);
  const lastResult = useRef<SearchResult | null>(null);

  useEffect(() => {
    if (!center) return;

    const prev = lastResult.current;
    if (prev && canReuse(prev, center, radiusKm)) {
      setState({ status: "success", spots: filterWithin(prev.items, center, radiusKm), fromCache: true, error: null });
      return;
    }

    const controller = new AbortController();
    // 前の結果は残したままローディング表示にする（一覧がちらつかないように）
    setState((s) => ({ ...s, status: "loading", error: null }));

    const timer = setTimeout(async () => {
      try {
        const fetchRadius = Math.min(MAX_RADIUS_KM, radiusKm * PREFETCH_FACTOR);
        const result = await api.searchSpots(center, fetchRadius, controller.signal);
        lastResult.current = result;
        setState({ status: "success", spots: filterWithin(result.items, center, radiusKm), fromCache: false, error: null });
      } catch (e) {
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "unknown error" }));
      }
    }, DEBOUNCE_MS);

    // 地図がさらに動いたら、古いリクエストは取り消す（結果の逆転も防げる）
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [center, radiusKm, retryToken]);

  return { ...state, retry: () => setRetryToken((t) => t + 1) };
}

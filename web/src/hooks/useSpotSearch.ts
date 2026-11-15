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
 * カテゴリの絞り込みは API 側で行っているため、取得時と同じ選択のときだけ再利用する
 */
function canReuse(prev: FetchedResult, center: LatLng, radiusKm: number, categoryKey: string): boolean {
  const truncated = prev.total > prev.items.length;
  return (
    !truncated &&
    prev.categoryKey === categoryKey &&
    distanceM(prev.center, center) + radiusKm * 1000 <= prev.radiusKm * 1000
  );
}

interface FetchedResult extends SearchResult {
  /** 取得時に選択していたカテゴリ（ソート済み・カンマ区切り） */
  categoryKey: string;
}

/**
 * 取得済みの結果を、別の中心・半径で絞り込む（再利用時のみ使う）。
 * 中心が変わっているため、距離はブラウザ側で再計算する（球面近似）
 */
function filterWithin(source: Spot[], center: LatLng, radiusKm: number): Spot[] {
  return source
    .map((s) => ({ ...s, distanceM: Math.round(distanceM(center, s)) }))
    .filter((s) => s.distanceM <= radiusKm * 1000)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * API から取得した直後は、取得時の中心と検索の中心が同じなので、
 * PostGIS が計算した距離と並び順をそのまま使い、半径で絞るだけにする
 */
function withinRadius(items: Spot[], radiusKm: number): Spot[] {
  return items.filter((s) => s.distanceM <= radiusKm * 1000);
}

export function useSpotSearch(
  center: LatLng | null,
  radiusKm: number,
  categories: string[],
): SpotSearchState & { retry: () => void } {
  const [state, setState] = useState<SpotSearchState>({
    status: "idle",
    spots: [],
    fromCache: false,
    error: null,
  });
  const [retryToken, setRetryToken] = useState(0);
  const lastResult = useRef<FetchedResult | null>(null);
  // 配列の参照ではなく内容で比較できるよう、文字列のキーにする（useEffect の依存にも使う）
  const categoryKey = [...categories].sort().join(",");

  useEffect(() => {
    if (!center) return;

    const prev = lastResult.current;
    if (prev && canReuse(prev, center, radiusKm, categoryKey)) {
      setState({ status: "success", spots: filterWithin(prev.items, center, radiusKm), fromCache: true, error: null });
      return;
    }

    const controller = new AbortController();
    // 前の結果は残したままローディング表示にする（一覧がちらつかないように）
    setState((s) => ({ ...s, status: "loading", error: null }));

    const timer = setTimeout(async () => {
      try {
        const fetchRadius = Math.min(MAX_RADIUS_KM, radiusKm * PREFETCH_FACTOR);
        const result = await api.searchSpots(center, fetchRadius, categoryKey ? categoryKey.split(",") : [], controller.signal);
        lastResult.current = { ...result, categoryKey };
        setState({ status: "success", spots: withinRadius(result.items, radiusKm), fromCache: false, error: null });
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
  }, [center, radiusKm, categoryKey, retryToken]);

  return { ...state, retry: () => setRetryToken((t) => t + 1) };
}

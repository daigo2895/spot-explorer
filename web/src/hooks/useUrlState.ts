"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildUrlSearch, parseUrlState, type UrlState } from "@/lib/urlState";

/**
 * 検索条件と URL のクエリを同期する。
 * - 初期値：ページを開いたときの URL から読む（1回だけ）
 * - 更新：history.replaceState で置き換える。pushState にすると地図を動かすたびに履歴が増え、
 *   「戻る」が使いにくくなるため使わない。Next.js のルーターも使わない（移動のたびに
 *   サーバーコンポーネントの再描画を起こさないため）
 */
export function useUrlState() {
  // このコンポーネントは SSR を無効にして読み込まれるため、window を直接参照できる
  const [initial] = useState<UrlState | null>(() => parseUrlState(window.location.search));
  const lastSearch = useRef<string>(window.location.search);

  const sync = useCallback((state: Parameters<typeof buildUrlSearch>[0]) => {
    const search = buildUrlSearch(state);
    if (search === lastSearch.current) return;
    lastSearch.current = search;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}`);
  }, []);

  return { initial, sync };
}

/** 現在の URL をクリップボードにコピーする。2秒間「コピーしました」を返す */
export function useCopyUrl() {
  const [copied, setCopied] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("copied");
    } catch {
      setCopied("error");
    }
  }, []);

  return { copied, copy };
}

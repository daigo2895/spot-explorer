"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { distanceM, roundedKey, type LatLng } from "@/lib/geo";

/** 地図を動かしている間も、この間隔で住所を更新する（スロットリング） */
const THROTTLE_MS = 1000;
/** 前回問い合わせた地点からこの距離未満の移動では API を呼ばない */
const MIN_MOVE_M = 25;
const MAX_CACHE = 500;

export type AddressStatus = "idle" | "loading" | "success" | "error";

export interface CenterAddressState {
  address: string | null;
  status: AddressStatus;
}

/**
 * 地図中心の住所を、呼び出し回数を抑えながら高頻度で更新するフック。
 * 1. 同じ地点（約11m単位）は、ブラウザ内のキャッシュから即時に表示
 * 2. 少しの移動（25m未満）では呼ばない
 * 3. 動かし続けている間は1秒に1回まで（最後の位置は必ず取得する）
 */
export function useCenterAddress(center: LatLng | null): CenterAddressState {
  const [state, setState] = useState<CenterAddressState>({ address: null, status: "idle" });
  const cache = useRef(new Map<string, string | null>());
  const lastRequested = useRef<LatLng | null>(null);
  const lastSentAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestId = useRef(0);

  useEffect(() => {
    if (!center) return;

    const key = roundedKey(center);
    if (cache.current.has(key)) {
      // 予約済みの問い合わせや通信中の結果で、キャッシュの表示を上書きしないようにする
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      latestRequestId.current++;
      lastRequested.current = center;
      setState({ address: cache.current.get(key) ?? null, status: "success" });
      return;
    }
    if (lastRequested.current && distanceM(lastRequested.current, center) < MIN_MOVE_M) return;

    const send = async () => {
      timer.current = null;
      lastSentAt.current = Date.now();
      lastRequested.current = center;
      const requestId = ++latestRequestId.current;
      setState((s) => ({ ...s, status: "loading" }));
      try {
        const { address } = await api.reverseGeocode(center);
        cache.current.set(key, address);
        if (cache.current.size > MAX_CACHE) {
          cache.current.delete(cache.current.keys().next().value!);
        }
        // 古いリクエストの結果で新しい表示を上書きしない
        if (requestId === latestRequestId.current) setState({ address, status: "success" });
      } catch {
        // 前の地点の住所を残すと、失敗に気づけず別の場所の住所を見てしまうため消す
        if (requestId === latestRequestId.current) setState({ address: null, status: "error" });
      }
    };

    if (timer.current) clearTimeout(timer.current);
    const elapsed = Date.now() - lastSentAt.current;
    timer.current = setTimeout(send, Math.max(0, THROTTLE_MS - elapsed));
  }, [center]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return state;
}

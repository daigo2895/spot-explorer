"use client";

import dynamic from "next/dynamic";

// Leaflet は window を参照するため、サーバー側でのレンダリングを無効にして読み込む
const SpotExplorer = dynamic(() => import("./SpotExplorer").then((m) => m.SpotExplorer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-500">地図を読み込み中…</div>
  ),
});

export function SpotExplorerLoader() {
  return <SpotExplorer />;
}

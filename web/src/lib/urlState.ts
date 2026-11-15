import { MAX_RADIUS_KM, MIN_RADIUS_KM } from "@/components/RadiusControl";
import type { LatLng } from "./geo";

/** URL のクエリに保持する検索条件 */
export interface UrlState {
  center: LatLng;
  zoom: number | null;
  radiusKm: number | null;
  categories: string[];
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 19;
const MAX_CATEGORIES = 50;

function numberIn(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * URL のクエリから検索条件を読む。不正な値は無視する（中心が不正なら全体を無視）。
 * 例: ?lat=35.6812&lng=139.7671&z=13&r=5&c=寺院,神社
 */
export function parseUrlState(search: string): UrlState | null {
  const params = new URLSearchParams(search);
  const lat = numberIn(params.get("lat"), -90, 90);
  const lng = numberIn(params.get("lng"), -180, 180);
  if (lat === null || lng === null) return null;

  const categories = (params.get("c") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c !== "")
    .slice(0, MAX_CATEGORIES);

  return {
    center: { lat, lng },
    zoom: numberIn(params.get("z"), MIN_ZOOM, MAX_ZOOM),
    radiusKm: numberIn(params.get("r"), MIN_RADIUS_KM, MAX_RADIUS_KM),
    categories: [...new Set(categories)],
  };
}

/** 検索条件をクエリ文字列（先頭の ? を含む）にする。中心は小数第4位（約11 m）に丸めて短くする */
export function buildUrlSearch(state: { center: LatLng; zoom: number; radiusKm: number; categories: string[] }): string {
  const params = new URLSearchParams({
    lat: state.center.lat.toFixed(4),
    lng: state.center.lng.toFixed(4),
    z: String(Math.round(state.zoom * 100) / 100),
    r: String(state.radiusKm),
  });
  if (state.categories.length > 0) params.set("c", state.categories.join(","));
  return `?${params.toString()}`;
}

import type { LatLng } from "./geo";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export interface Spot {
  id: number;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  distanceM: number;
  attributes: Record<string, string>;
}

export interface SearchResult {
  center: LatLng;
  radiusKm: number;
  total: number;
  items: Spot[];
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface SpotsSummary {
  count: number;
  bounds: { south: number; west: number; north: number; east: number } | null;
  initialCenter: LatLng | null;
  /** カテゴリごとの件数（多い順） */
  categories: CategoryCount[];
}

export interface ReverseGeocodeResult {
  address: string | null;
  provider: string;
  cached: boolean;
}

async function getJson<T>(path: string, params: Record<string, string | number>, signal?: AbortSignal) {
  const url = new URL(`/api${path}`, API_BASE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  searchSpots: (center: LatLng, radiusKm: number, categories: string[], signal?: AbortSignal) =>
    getJson<SearchResult>(
      "/spots",
      {
        lat: center.lat,
        lng: center.lng,
        radiusKm,
        limit: 1000,
        // 空のときはパラメータ自体を送らない（全カテゴリ）
        ...(categories.length > 0 ? { categories: categories.join(",") } : {}),
      },
      signal,
    ),
  summary: (signal?: AbortSignal) => getJson<SpotsSummary>("/spots/summary", {}, signal),
  reverseGeocode: (center: LatLng, signal?: AbortSignal) =>
    getJson<ReverseGeocodeResult>("/geocode/reverse", { lat: center.lat, lng: center.lng }, signal),
};

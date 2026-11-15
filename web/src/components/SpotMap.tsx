"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { CircleMarker as LeafletCircleMarker, LatLngBoundsExpression } from "leaflet";
import type { Spot } from "@/lib/api";
import { categoryColor, type CategoryColorMap } from "@/lib/categoryColors";
import { formatDistance, type LatLng } from "@/lib/geo";
import type { MapTarget } from "./PlaceSearch";

interface Props {
  /** URL に保存されていた表示位置。あれば initialCenter より優先する */
  initialView: { center: LatLng; zoom: number | null } | null;
  initialCenter: LatLng | null;
  bounds: { south: number; west: number; north: number; east: number } | null;
  spots: Spot[];
  /** カテゴリごとのマーカー色（凡例のチップと同じ色） */
  colors: CategoryColorMap;
  searchCenter: LatLng | null;
  radiusKm: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMove: (center: LatLng) => void;
  onMoveEnd: (center: LatLng, zoom: number) => void;
  /** 地名検索・現在地ボタンからの移動指示。同じ場所を2回選んでも動くよう、連番つき */
  target: (MapTarget & { seq: number }) | null;
}

/** 点に移動するときのズーム。町名が読める程度 */
const TARGET_ZOOM = 15;

function MapNavigator({ target }: Pick<Props, "target">) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    if (target.bounds) {
      const b = target.bounds;
      map.flyToBounds(
        [
          [b.south, b.west],
          [b.north, b.east],
        ],
        { maxZoom: TARGET_ZOOM, duration: 0.8 },
      );
    } else {
      map.flyTo([target.center.lat, target.center.lng], TARGET_ZOOM, { duration: 0.8 });
    }
  }, [map, target]);
  return null;
}

// データがない・取得に失敗した場合の初期表示（東京駅周辺）
const FALLBACK_CENTER: [number, number] = [35.681236, 139.767125];

function MapEvents({ onMove, onMoveEnd }: Pick<Props, "onMove" | "onMoveEnd">) {
  const map = useMapEvents({
    move: () => onMove(map.getCenter()),
    moveend: () => onMoveEnd(map.getCenter(), map.getZoom()),
  });
  // 初期表示時にも1回検索する
  useEffect(() => {
    onMoveEnd(map.getCenter(), map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

function SpotMarker({
  spot,
  color,
  selected,
  onSelect,
}: {
  spot: Spot;
  color: string;
  selected: boolean;
  onSelect: Props["onSelect"];
}) {
  const ref = useRef<LeafletCircleMarker>(null);
  const map = useMap();

  // 一覧で選ばれたらポップアップを開き、画面外なら見える位置まで寄せる
  useEffect(() => {
    if (!selected || !ref.current) return;
    ref.current.openPopup();
    if (!map.getBounds().contains(ref.current.getLatLng())) map.panTo(ref.current.getLatLng());
  }, [selected, map]);

  return (
    <CircleMarker
      ref={ref}
      center={[spot.lat, spot.lng]}
      radius={selected ? 10 : 6}
      pathOptions={{
        color: selected ? "#1d4ed8" : "#ffffff",
        weight: 2,
        fillColor: selected ? "#2563eb" : color,
        fillOpacity: 0.9,
      }}
      eventHandlers={{ click: () => onSelect(spot.id), popupclose: () => selected && onSelect(null) }}
    >
      <Popup autoPan={false}>
        <div className="text-sm">
          <p className="font-bold">{spot.name}</p>
          {spot.category && <p className="text-slate-600">{spot.category}</p>}
          {spot.address && <p className="text-slate-600">{spot.address}</p>}
          <p className="text-slate-500">中心から {formatDistance(spot.distanceM)}</p>
        </div>
      </Popup>
    </CircleMarker>
  );
}

/** 初期表示の既定のズーム。半径 5 km の円が収まる程度 */
const DEFAULT_ZOOM = 12;

export function SpotMap({
  initialView,
  initialCenter,
  bounds,
  spots,
  colors,
  searchCenter,
  radiusKm,
  selectedId,
  onSelect,
  onMove,
  onMoveEnd,
  target,
}: Props) {
  // 初期表示：URL の表示位置 → スポットが密集している地点 → データ全体の範囲 → 既定の地点 の順に使う
  const initial: { bounds: LatLngBoundsExpression } | { center: [number, number]; zoom: number } = initialView
    ? { center: [initialView.center.lat, initialView.center.lng], zoom: initialView.zoom ?? DEFAULT_ZOOM }
    : initialCenter
      ? { center: [initialCenter.lat, initialCenter.lng], zoom: DEFAULT_ZOOM }
      : bounds
        ? { bounds: [[bounds.south, bounds.west], [bounds.north, bounds.east]] }
        : { center: FALLBACK_CENTER, zoom: DEFAULT_ZOOM };

  return (
    <div className="relative h-full w-full">
      <MapContainer {...initial} className="h-full w-full" zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onMove={onMove} onMoveEnd={onMoveEnd} />
        <MapNavigator target={target} />
        {searchCenter && (
          <Circle
            center={searchCenter}
            radius={radiusKm * 1000}
            pathOptions={{ color: "#2563eb", weight: 1.5, fillOpacity: 0.06, dashArray: "6 4" }}
            interactive={false}
          />
        )}
        {spots.map((spot) => (
          <SpotMarker
            key={spot.id}
            spot={spot}
            color={categoryColor(colors, spot.category)}
            selected={spot.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </MapContainer>
      {/* 地図の中心を示す十字。住所表示・検索の基準点 */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 text-3xl leading-none font-light text-slate-800 drop-shadow">
        ＋
      </div>
    </div>
  );
}

"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { CircleMarker as LeafletCircleMarker, LatLngBoundsExpression } from "leaflet";
import type { Spot } from "@/lib/api";
import { formatDistance, type LatLng } from "@/lib/geo";

interface Props {
  initialCenter: LatLng | null;
  bounds: { south: number; west: number; north: number; east: number } | null;
  spots: Spot[];
  searchCenter: LatLng | null;
  radiusKm: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMove: (center: LatLng) => void;
  onMoveEnd: (center: LatLng) => void;
}

// データがない・取得に失敗した場合の初期表示（東京駅周辺）
const FALLBACK_CENTER: [number, number] = [35.681236, 139.767125];

function MapEvents({ onMove, onMoveEnd }: Pick<Props, "onMove" | "onMoveEnd">) {
  const map = useMapEvents({
    move: () => onMove(map.getCenter()),
    moveend: () => onMoveEnd(map.getCenter()),
  });
  // 初期表示時にも1回検索する
  useEffect(() => {
    onMoveEnd(map.getCenter());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

function SpotMarker({ spot, selected, onSelect }: { spot: Spot; selected: boolean; onSelect: Props["onSelect"] }) {
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
        fillColor: selected ? "#2563eb" : "#ef4444",
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

export function SpotMap({ initialCenter, bounds, spots, searchCenter, radiusKm, selectedId, onSelect, onMove, onMoveEnd }: Props) {
  // 初期表示：スポットが密集している地点 → データ全体の範囲 → 既定の地点 の順に使う
  const initial: { bounds: LatLngBoundsExpression } | { center: [number, number]; zoom: number } = initialCenter
    ? { center: [initialCenter.lat, initialCenter.lng], zoom: 12 }
    : bounds
      ? { bounds: [[bounds.south, bounds.west], [bounds.north, bounds.east]] }
      : { center: FALLBACK_CENTER, zoom: 12 };

  return (
    <div className="relative h-full w-full">
      <MapContainer {...initial} className="h-full w-full" zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onMove={onMove} onMoveEnd={onMoveEnd} />
        {searchCenter && (
          <Circle
            center={searchCenter}
            radius={radiusKm * 1000}
            pathOptions={{ color: "#2563eb", weight: 1.5, fillOpacity: 0.06, dashArray: "6 4" }}
            interactive={false}
          />
        )}
        {spots.map((spot) => (
          <SpotMarker key={spot.id} spot={spot} selected={spot.id === selectedId} onSelect={onSelect} />
        ))}
      </MapContainer>
      {/* 地図の中心を示す十字。住所表示・検索の基準点 */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 text-3xl leading-none font-light text-slate-800 drop-shadow">
        ＋
      </div>
    </div>
  );
}

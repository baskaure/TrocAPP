import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type LocationMapProps = {
  lat: number;
  lng: number;
  /** Zoom initial (défaut 14 — quartier lisible) */
  zoom?: number;
  /** Texte du popup au clic sur le marqueur */
  popupLabel?: string;
  className?: string;
};

/** Tuiles Carto « Voyager » (couleurs claires, lisibles) — pas de clé API. */
const TILE_VOYAGER =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function MapInvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const id = window.setTimeout(() => map.invalidateSize(), 350);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function primaryPinIcon() {
  const html = `
    <div class="location-map-pin-inner" aria-hidden="true">
      <svg width="40" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="loc-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#002de6" flood-opacity="0.45"/>
          </filter>
        </defs>
        <path filter="url(#loc-shadow)" fill="#002de6" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="3" fill="white"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    className: 'location-map-pin',
    html,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -44],
  });
}

/**
 * Carte interactive (Leaflet + tuiles Carto) centrée sur un point.
 */
export function LocationMap({ lat, lng, zoom = 14, popupLabel, className = '' }: LocationMapProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const icon = useMemo(() => primaryPinIcon(), []);

  if (!ready) {
    return (
      <div
        className={`flex h-full min-h-[200px] w-full animate-pulse items-center justify-center rounded-[inherit] bg-slate-100 dark:bg-slate-800 ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      className={`z-[1] [&_.leaflet-control-attribution]:rounded-bl-2xl [&_.leaflet-control-attribution]:text-[10px] ${className}`}
      style={{ height: '100%', width: '100%', minHeight: 'inherit' }}
      scrollWheelZoom={false}
      zoomControl
    >
      <MapInvalidateOnMount />
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_VOYAGER} maxZoom={19} />
      <Marker position={[lat, lng]} icon={icon}>
        {popupLabel ? <Popup>{popupLabel}</Popup> : null}
      </Marker>
    </MapContainer>
  );
}

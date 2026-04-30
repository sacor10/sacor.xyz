import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons (Leaflet's default icons break with most bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface Stop {
  name: string;
  lat: number;
  lng: number;
  arrivalTime?: string;
  durationMinutes?: number;
  notes?: string;
}

export interface ItineraryMapProps {
  stops: Stop[];
  showRoute?: boolean;
  height?: string;
}

// Numbered marker so users can see the order at a glance
const numberedIcon = (n: number) =>
  L.divIcon({
    className: 'itinerary-marker',
    html: `<div style="
      background:#c0392b;color:white;border-radius:50%;
      width:32px;height:32px;display:flex;align-items:center;justify-content:center;
      font-weight:600;font-size:14px;border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
    ">${n}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

// Helper to auto-fit the map bounds to all stops
function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 0) return;
    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [stops, map]);
  return null;
}

export default function ItineraryMap({
  stops,
  showRoute = true,
  height = '500px',
}: ItineraryMapProps) {
  if (stops.length === 0) return null;

  const center: [number, number] = [stops[0].lat, stops[0].lng];
  const routePoints: [number, number][] = stops.map((s) => [s.lat, s.lng]);

  return (
    <div style={{ height, width: '100%' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds stops={stops} />
        {showRoute && stops.length > 1 && (
          <Polyline positions={routePoints} pathOptions={{ color: '#c0392b', weight: 3, dashArray: '6 8' }} />
        )}
        {stops.map((stop, i) => (
          <Marker key={i} position={[stop.lat, stop.lng]} icon={numberedIcon(i + 1)}>
            <Popup>
              <strong>{stop.name}</strong>
              {stop.arrivalTime && <div>Arrive: {stop.arrivalTime}</div>}
              {stop.durationMinutes && <div>Duration: {stop.durationMinutes} min</div>}
              {stop.notes && <div style={{ marginTop: 6 }}>{stop.notes}</div>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

"use client";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";

const iconePin = divIcon({
  className: "",
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.8 17 27 17 27s17-14.2 17-27C34 7.6 26.4 0 17 0z" fill="var(--cor-primaria, #0E5C46)"/>
    <circle cx="17" cy="16" r="6.5" fill="var(--cor-destaque, #D6F455)"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
});

export default function MapaLocal({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      style={{ height: "10rem", borderRadius: "0.75rem", zIndex: 0 }}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[latitude, longitude]} icon={iconePin} />
    </MapContainer>
  );
}

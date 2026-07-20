"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { divIcon } from "leaflet";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Pin verde no estilo da marca (SVG embutido — sem depender das imagens
// padrão do Leaflet, que dão problema com empacotadores).
const iconePin = divIcon({
  className: "",
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.8 17 27 17 27s17-14.2 17-27C34 7.6 26.4 0 17 0z" fill="var(--cor-primaria, #0E5C46)"/>
    <circle cx="17" cy="16" r="6.5" fill="var(--cor-destaque, #D6F455)"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
});

function CliqueNoMapa({
  aoClicar,
}: {
  aoClicar: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      aoClicar(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type Props = {
  centro: [number, number];
  pin: [number, number] | null;
  aoMoverPin: (lat: number, lng: number) => void;
};

export default function MapaPin({ centro, pin, aoMoverPin }: Props) {
  const mapaRef = useRef<L.Map | null>(null);

  // Quando a busca de endereço muda o centro, move o mapa junto.
  useEffect(() => {
    mapaRef.current?.setView(centro, 16);
  }, [centro]);

  return (
    <MapContainer
      center={centro}
      zoom={pin ? 16 : 13}
      style={{ height: "16rem", borderRadius: "0.75rem", zIndex: 0 }}
      ref={mapaRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CliqueNoMapa aoClicar={aoMoverPin} />
      {pin && (
        <Marker
          position={pin}
          icon={iconePin}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const pos = e.target.getLatLng();
              aoMoverPin(pos.lat, pos.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}

"use client";

import dynamic from "next/dynamic";

// Mini-mapa da página do clube (só exibição, sem interação pesada).
const MapaLocal = dynamic(() => import("@/components/mapa/MapaLocal"), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center rounded-xl bg-fundo text-sm text-tinta-suave">
      Carregando mapa...
    </div>
  ),
});

export function ClubeMiniMapa({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  return <MapaLocal latitude={latitude} longitude={longitude} />;
}

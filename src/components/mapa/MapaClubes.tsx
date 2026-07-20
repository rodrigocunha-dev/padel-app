"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { divIcon } from "leaflet";
import Link from "next/link";
import {
  menorPrecoCentavos,
  formatarReais,
  type ClubeDescoberta,
} from "@/lib/descoberta";
import "leaflet/dist/leaflet.css";

const CENTRO_PADRAO: [number, number] = [-29.6783, -51.1309]; // Novo Hamburgo

// Pin com o menor preço/h do clube escrito nele.
function iconePreco(precoCentavos: number | null) {
  const texto = precoCentavos === null ? "—" : formatarReais(precoCentavos);
  return divIcon({
    className: "",
    html: `<div style="
      background: var(--cor-primaria, #0E5C46);
      color: #fff;
      font-family: var(--font-archivo), sans-serif;
      font-weight: 700;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,.3);
      border: 2px solid #fff;
      transform: translate(-50%, -100%);
      display: inline-block;
    ">${texto}</div>`,
    iconSize: [0, 0],
  });
}

const iconeEu = divIcon({
  className: "",
  html: `<div style="
    width: 14px; height: 14px; border-radius: 50%;
    background: #2b7fff; border: 3px solid #fff;
    box-shadow: 0 0 0 2px #2b7fff55;
    transform: translate(-50%, -50%);
  "></div>`,
  iconSize: [0, 0],
});

type Props = {
  clubes: ClubeDescoberta[];
  minhaPosicao: [number, number] | null;
};

export default function MapaClubes({ clubes, minhaPosicao }: Props) {
  const centro =
    minhaPosicao ??
    (clubes.length > 0
      ? ([clubes[0].latitude, clubes[0].longitude] as [number, number])
      : CENTRO_PADRAO);

  return (
    <MapContainer
      center={centro}
      zoom={13}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {minhaPosicao && <Marker position={minhaPosicao} icon={iconeEu} />}
      {clubes.map((clube) => (
        <Marker
          key={clube.id}
          position={[clube.latitude, clube.longitude]}
          icon={iconePreco(menorPrecoCentavos(clube.quadras))}
        >
          <Popup>
            <div style={{ minWidth: "10rem" }}>
              <strong>{clube.nome}</strong>
              <br />
              {clube.cidade} · {clube.quadras.length}{" "}
              {clube.quadras.length === 1 ? "quadra" : "quadras"}
              <br />
              <Link href={`/app/clubes/${clube.id}`}>Ver clube →</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

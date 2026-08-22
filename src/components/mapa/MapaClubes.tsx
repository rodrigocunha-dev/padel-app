"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

// ============================================================
// CENTRALIZAR QUANDO A LOCALIZAÇÃO CHEGAR
// ============================================================
// ⚠️ O `center` do MapContainer só vale NA MONTAGEM — o Leaflet ignora
// mudanças nele depois disso. Como a localização do celular demora um ou dois
// segundos para responder, o mapa já tinha aberto centrado em outro lugar; o
// ponto azul aparecia e o mapa não se mexia. Era o que o fundador via.
//
// Este componente não desenha nada: ele existe para mover o mapa quando a
// posição finalmente chega.
//
// ⚠️ E move UMA VEZ SÓ. Sem o controle, qualquer redesenho puxaria o mapa de
// volta — a pessoa arrastaria para ver outro bairro e o mapa a traria de
// volta sozinha, que é pior do que nunca centralizar.
function CentralizarEm({ posicao }: { posicao: [number, number] | null }) {
  const mapa = useMap();
  const jaCentralizou = useRef(false);

  useEffect(() => {
    if (!posicao || jaCentralizou.current) return;
    jaCentralizou.current = true;

    // ⚠️ `invalidateSize()` ANTES do `setView`, e não é supérfluo.
    //
    // O mapa vive num contêiner `position: absolute; inset: 0` que só ganha
    // tamanho depois que a tela se acomoda. Chamando `setView` enquanto o
    // Leaflet ainda acha que tem tamanho zero, ele aceita a coordenada e não
    // desenha nada diferente — foi o que aconteceu no primeiro teste: a
    // função rodava, dizia que ia centralizar, e o mapa não saía do lugar.
    //
    // `invalidateSize` faz o Leaflet remedir o contêiner antes de mover.
    //
    // Sem animação, de propósito: a distância pode ser de milhares de
    // quilômetros (o mapa abre nos clubes, a pessoa pode estar longe), e
    // animar isso é uma varredura tonta pelo mapa-múndi.
    const id = setTimeout(() => {
      mapa.invalidateSize();
      mapa.setView(posicao, 14, { animate: false });
    }, 100);

    return () => clearTimeout(id);
  }, [posicao, mapa]);

  return null;
}

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
      <CentralizarEm posicao={minhaPosicao} />
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

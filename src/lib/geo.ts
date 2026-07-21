// Consultas de endereço/coordenadas no OpenStreetMap (Nominatim, gratuito).
// A CIDADE do clube sempre vem daqui — nunca é digitada — para que o nome
// seja sempre o oficial ("Novo Hamburgo", não "NH") e os filtros por
// cidade funcionem.

export type LocalEncontrado = {
  latitude: number;
  longitude: number;
  cidade: string | null;
  endereco: string | null;
};

type EnderecoOsm = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
};

function extrairCidade(endereco: EnderecoOsm | undefined): string | null {
  return (
    endereco?.city ??
    endereco?.town ??
    endereco?.village ??
    endereco?.municipality ??
    null
  );
}

// Endereço escrito → coordenadas + cidade oficial.
export async function buscarEndereco(
  consulta: string
): Promise<LocalEncontrado | null> {
  const resposta = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`,
    { headers: { "Accept-Language": "pt-BR" } }
  );
  const resultados = await resposta.json();
  if (!Array.isArray(resultados) || resultados.length === 0) return null;
  const primeiro = resultados[0];
  return {
    latitude: parseFloat(primeiro.lat),
    longitude: parseFloat(primeiro.lon),
    cidade: extrairCidade(primeiro.address),
    endereco: primeiro.display_name ?? null,
  };
}

// Coordenadas (pin arrastado, GPS do jogador) → cidade oficial.
export async function localPorCoordenadas(
  latitude: number,
  longitude: number
): Promise<LocalEncontrado | null> {
  const resposta = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`,
    { headers: { "Accept-Language": "pt-BR" } }
  );
  const dados = await resposta.json();
  if (!dados || dados.error) return null;
  return {
    latitude,
    longitude,
    cidade: extrairCidade(dados.address),
    endereco: dados.display_name ?? null,
  };
}

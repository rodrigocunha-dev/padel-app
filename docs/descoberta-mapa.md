# Descoberta de clubes — mapa, filtros e "Jogar agora" (Sprint 2)

## O que é
Em `/app/descobrir`, o jogador vê os clubes no mapa, cada um com um pin mostrando o **menor preço/hora**. Tocar no pin abre a página do clube.

## Onde fica no código
- Página: `src/app/app/descobrir/page.tsx`
- Filtros e lógica: `src/components/mapa/Descobrir.tsx` + `src/lib/descoberta.ts`
- Mapa: `src/components/mapa/MapaClubes.tsx` (Leaflet + OpenStreetMap)
- Página do clube: `src/app/app/clubes/[id]/page.tsx` + avaliação em `src/components/AvaliarClube.tsx`

## Decisão: OpenStreetMap em vez de Google Maps
Escolha do fundador (20/07/2026): OpenStreetMap é gratuito, sem conta e sem cartão de crédito. O Google Maps exigiria conta de faturamento desde o 1º dia. A troca futura, se necessária, fica contida nos componentes de mapa. A busca de endereço (clube) usa o serviço gratuito Nominatim.

## Filtros
Esporte, tipo de piso, só cobertas, preço máximo/h e distância. O filtro de distância usa a localização do navegador (se a pessoa permitir) e a distância em linha reta.

## "Jogar agora"
Mostra só clubes com **pelo menos 1 hora contínua livre nas próximas 3 horas**, dentro do horário de funcionamento (as faixas de preço cadastradas valem como horário de funcionamento). A checagem consulta a função `horarios_ocupados` do banco, que devolve apenas quadra + horários — **nunca nome ou telefone de quem reservou** (LGPD).

## Página do clube
Fotos, endereço, quadras com preços, média e lista de avaliações (1–5 estrelas + comentário; uma por jogador, editável) e botão **"Chamar no WhatsApp"** (canal nativo — regra nº 9).

## Métricas
- `mapa_aberto` (quantos clubes no mapa), `mapa_filtro_usado` (qual filtro), `jogar_agora_ativado`, `clube_avaliado` (nota, tem comentário), `clube_localizacao_salva`, `clube_foto_adicionada`

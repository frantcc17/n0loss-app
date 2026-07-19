/* ============================================================
   services/prices.js — Precios y oráculos (simulados en beta)
   En producción: Chainlink Price Feeds / API de exchange.
   ============================================================ */
import { sleep } from "../utils/helpers.js";
import { PROTOCOL } from "../utils/constants.js";

const LATENCY = 200;

/* Pequeña variación aleatoria para que la UI se vea "viva" */
const jitter = (base, pct = 0.002) => base * (1 + (Math.random() * 2 - 1) * pct);

/* ---------- Precios spot ---------- */
export async function getPrice(symbol) {
  await sleep(LATENCY);
  const table = {
    USDC: jitter(1.0, 0.0005),   // stablecoin: prácticamente 1:1
    POL: jitter(0.62),           // gas de Polygon (lo paga el protocolo)
    EURUSDC: jitter(0.91),       // conversión aproximada a EUR
  };
  return table[symbol] ?? null;
}

/* ---------- APR del subyacente (Ondo OUSG) ----------
   Media móvil 4 semanas + histórico para la gráfica.            */
export async function getAprHistory() {
  await sleep(LATENCY);
  const base = PROTOCOL.apr;
  return Array.from({ length: 8 }, (_, i) => ({
    label: `S${PROTOCOL.cycle - 7 + i}`,
    value: +(base + Math.sin(i / 1.6) * 0.25).toFixed(2),
  }));
}

export async function getCurrentApr() {
  const hist = await getAprHistory();
  return hist[hist.length - 1].value;
}

/* ---------- Conversión útil para la UI ---------- */
export async function usdcToEur(amount) {
  const rate = await getPrice("EURUSDC");
  return amount * rate;
}

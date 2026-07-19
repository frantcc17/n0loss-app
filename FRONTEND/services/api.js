/* ============================================================
   services/api.js — Llamadas a la API (datos demo en beta)
   Todas las funciones son async con latencia simulada para que
   la UI ya esté preparada para datos reales (loading states).
   ============================================================ */
import { sleep } from "../utils/helpers.js";
import { randHash } from "../utils/format.js";
import { PROTOCOL, weeklyYield, rewardPool } from "../utils/constants.js";

const LATENCY = 250; // ms — simula red

/* ---------- Estadísticas generales ---------- */
export async function getProtocolStats() {
  await sleep(LATENCY);
  return {
    tvl: PROTOCOL.tvl,
    apr: PROTOCOL.apr,
    participants: PROTOCOL.participants,
    totalTickets: PROTOCOL.totalTickets,
    cycle: PROTOCOL.cycle,
    weeklyYield: weeklyYield(),
    rewardPool: rewardPool(),
  };
}

/* ---------- Histórico de TVL por ciclo (USDC) ---------- */
export async function getTvlHistory() {
  await sleep(LATENCY);
  return [
    18, 31, 47, 62, 78, 96, 112, 139, 158, 181, 204, 226, 248, 262,
  ].map((v, i) => ({ label: `S${i + 1}`, value: v * 1000 }));
}

/* ---------- Premios semanales repartidos (USDC) ---------- */
export async function getPrizeHistory() {
  await sleep(LATENCY);
  const tvl = await getTvlHistory();
  return tvl.slice(-8).map((x) => ({
    label: x.label,
    value: Math.round(x.value * (PROTOCOL.apr / 100) * (7 / 365) * PROTOCOL.yieldSplit.reward),
  }));
}

/* ---------- Sorteos pasados con prueba VRF ---------- */
export async function getPastDraws() {
  await sleep(LATENCY);
  return [
    { cycle: 13, date: "10 jul 2026", winner: "0x93aF…b1E4", prize: 428.6, vrf: randHash() },
    { cycle: 12, date: "03 jul 2026", winner: "0x5Cd2…90aA", prize: 391.4, vrf: randHash() },
    { cycle: 11, date: "26 jun 2026", winner: "0xE07b…4c19", prize: 350.2, vrf: randHash() },
    { cycle: 10, date: "19 jun 2026", winner: "0x1BfF…77Dd", prize: 312.9, vrf: randHash() },
  ];
}

/* ---------- Participantes de la ronda (muestra para la rueda) ---------- */
export async function getDrawPool() {
  await sleep(LATENCY);
  return [
    { name: "0x93aF…b1E4", score: 3.1 },
    { name: "0x5Cd2…90aA", score: 2.4 },
    { name: "0xE07b…4c19", score: 1.9 },
    { name: "0x1BfF…77Dd", score: 1.6 },
    { name: "0xA641…0f2C", score: 1.2 },
    { name: "0x7e19…dB03", score: 0.9 },
    { name: "0xC4d8…21aF", score: 0.7 },
  ];
}

/* ---------- Movimientos del usuario (demo para Portfolio) ---------- */
export async function getUserActivity() {
  await sleep(LATENCY);
  return [
    { type: "deposit", label: "Depósito", amount: 1500, date: "12 jun 2026", tx: randHash() },
    { type: "deposit", label: "Depósito", amount: 1000, date: "26 jun 2026", tx: randHash() },
    { type: "ticket", label: "Tickets ciclo 13", amount: 250, date: "03 jul 2026", tx: null },
    { type: "ticket", label: "Tickets ciclo 14", amount: 250, date: "10 jul 2026", tx: null },
  ];
}

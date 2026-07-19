/* ============================================================
   utils/format.js — Formateo de datos
   ============================================================ */
import { PROTOCOL } from "./constants.js";

/* Número con separadores es-ES: fmt(2500.5, 2) → "2.500,50" */
export const fmt = (n, d = 0) =>
  Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });

/* Dirección abreviada: 0x8F3a…C21b */
export const shortAddr = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");

/* Hash pseudoaleatorio para simular txs y pruebas VRF */
export const randHash = () =>
  "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[(Math.random() * 16) | 0]).join("");

/* Próximo cierre de ciclo: viernes a las 18:00 (hora local) */
export function nextDraw() {
  const now = new Date();
  const d = new Date(now);
  const add = (PROTOCOL.drawDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  d.setHours(PROTOCOL.drawHour, 0, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 7);
  return d;
}

/* Diferencia hasta el sorteo en {d,h,m,s} */
export function countdownTo(target) {
  const diff = Math.max(0, target - new Date());
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor(diff / 3600000) % 24,
    m: Math.floor(diff / 60000) % 60,
    s: Math.floor(diff / 1000) % 60,
  };
}

/* USDC → tickets según el protocolo */
export const toTickets = (usdc) => Math.floor(usdc / PROTOCOL.ticketPrice);

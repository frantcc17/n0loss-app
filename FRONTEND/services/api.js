/* ============================================================
   services/api.js — Llamadas a la API (datos demo en beta)
   Todas las funciones son async con latencia simulada para que
   la UI ya esté preparada para datos reales (loading states).
   ============================================================ */
import { sleep } from "../utils/helpers.js";
import { randHash } from "../utils/format.js";
import { PROTOCOL, weeklyYield, rewardPool, DEMO_WALLET } from "../utils/constants.js";

const LATENCY = 250; // ms — simula red

/* ============================================================
   AUTENTICACIÓN (demo)
   Auth.js importa este objeto como `api`. Todas las funciones
   devuelven { ok, message?, user? } — NUNCA lanzan excepciones,
   para que la UI pueda mostrar el error sin romper el render.
   ============================================================ */

/* Base de usuarios en memoria. En producción esto vive en el backend. */
const users = new Map(); // email -> { email, password, country, wallet }
let session = null;      // { email, country, wallet } | null

/* Lista de la beta: correos permitidos en `precheck`.
   Vacía = se acepta cualquier correo. */
const BETA_ALLOWLIST = [];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Genera una dirección 0x… determinista a partir del correo,
   para que el mismo usuario vea siempre la misma wallet. */
function fakeAddress(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  let hex = "";
  for (let i = 0; i < 5; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    hex += (h >>> 0).toString(16).padStart(8, "0");
  }
  return "0x" + hex.slice(0, 40);
}

const publicUser = (u) => ({ email: u.email, country: u.country, wallet: u.wallet });

export const api = {
  /* ---------- Sesión activa ---------- */
  async me() {
    await sleep(120);
    return session ? { ok: true, user: session } : { ok: false, message: "Sin sesión." };
  },

  /* ---------- Inicio de sesión con correo ---------- */
  async login(email, password) {
    await sleep(LATENCY);
    const user = users.get(String(email).toLowerCase());
    if (!user || user.password !== password) {
      return { ok: false, message: "Correo o contraseña incorrectos." };
    }
    session = publicUser(user);
    return { ok: true, user: session };
  },

  /* ---------- Reto para firmar con la wallet ---------- */
  async nonce(address) {
    await sleep(LATENCY);
    if (!address) return { ok: false, message: "No se recibió ninguna dirección." };
    return {
      ok: true,
      message: `N0Loss quiere verificar tu wallet.\n\nDirección: ${address}\nReto: ${randHash()}`,
    };
  },

  /* ---------- Inicio de sesión con wallet ---------- */
  async loginWithWallet(address, signature) {
    await sleep(LATENCY);
    if (!signature) return { ok: false, message: "Firma no válida." };
    const target = String(address).toLowerCase();
    const user = [...users.values()].find((u) => u.wallet.toLowerCase() === target);
    if (!user) {
      return { ok: false, message: "Esta wallet no está registrada. Crea una cuenta primero." };
    }
    session = publicUser(user);
    return { ok: true, user: session };
  },

  /* ---------- Paso 1 del registro: validar correo ---------- */
  async precheck(email) {
    await sleep(LATENCY);
    const key = String(email).toLowerCase();
    if (!EMAIL_RE.test(key)) {
      return { ok: false, message: "Ese correo no tiene un formato válido." };
    }
    if (users.has(key)) {
      return { ok: false, message: "Ya existe una cuenta con este correo. Inicia sesión." };
    }
    if (BETA_ALLOWLIST.length && !BETA_ALLOWLIST.includes(key)) {
      return { ok: false, message: "Este correo no está en la lista de la beta." };
    }
    return { ok: true };
  },

  /* ---------- Paso 2 del registro: crear la cuenta ---------- */
  /* payload: { email, password, country, terms, mode, ownerAddress?, signature? } */
  async register(payload) {
    await sleep(LATENCY + 300); // desplegar la cuenta inteligente tarda un poco más
    const key = String(payload.email).toLowerCase();

    if (users.has(key)) {
      return { ok: false, message: "Ya existe una cuenta con este correo." };
    }
    if (payload.mode === "external") {
      if (!payload.ownerAddress || !payload.signature) {
        return { ok: false, message: "No se pudo verificar la firma de la wallet." };
      }
    }

    const wallet =
      payload.mode === "external"
        ? payload.ownerAddress
        : DEMO_WALLET || fakeAddress(key);

    const user = {
      email: key,
      password: payload.password,
      country: payload.country,
      wallet,
    };
    users.set(key, user);
    session = publicUser(user); // el registro deja la sesión abierta
    return { ok: true, user: session };
  },

  /* ---------- Cerrar sesión ---------- */
  async logout() {
    await sleep(80);
    session = null;
    return { ok: true };
  },
};

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

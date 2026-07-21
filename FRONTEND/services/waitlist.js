/* ============================================================
   services/waitlist.js — Lista blanca de la beta cerrada
   - isEmailAllowlisted(email): check de UX en reg paso 1.
   - linkBetaWallet(...): puerta REAL en servidor al crear la wallet.
   ============================================================ */

import {
  WAITLIST_ENDPOINT,
  WAITLIST_DEMO_EMAILS,
  BETA_LINK_ENDPOINT,
} from "../utils/constants.js";

/**
 * Comprobación de UX (reg paso 1). No es una puerta de seguridad.
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function isEmailAllowlisted(email) {
  const e = (email || "").trim().toLowerCase();

  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return { ok: false, message: "Introduce un correo válido." };
  }

  if (WAITLIST_ENDPOINT) {
    try {
      const r = await fetch(
        `${WAITLIST_ENDPOINT}?email=${encodeURIComponent(e)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data.allowed
        ? { ok: true }
        : { ok: false, message: "Este correo no está en la lista de la beta. Únete desde la landing." };
    } catch (err) {
      console.error("[waitlist] endpoint error:", err);
      // No dejamos pasar a ciegas; caemos a demo solo si está configurado.
    }
  }

  if (Array.isArray(WAITLIST_DEMO_EMAILS) && WAITLIST_DEMO_EMAILS.length) {
    const allowed = WAITLIST_DEMO_EMAILS.map((x) => x.toLowerCase()).includes(e);
    return allowed
      ? { ok: true }
      : { ok: false, message: "Este correo no está en la lista de la beta (modo demo)." };
  }

  return { ok: false, message: "No se pudo verificar la lista de espera. Inténtalo más tarde." };
}

/**
 * Puerta REAL: registra el enlace correo <-> smart account en el
 * servidor, que revalida que el correo esté en la waitlist.
 * @returns {Promise<{ ok: boolean, linked?: boolean, message?: string }>}
 */
export async function linkBetaWallet(email, smartAccount, owner) {
  // Sin backend configurado: no bloquea (modo demo). En producción
  // define BETA_LINK_ENDPOINT para que la puerta sea efectiva.
  if (!BETA_LINK_ENDPOINT) return { ok: true, linked: false };

  try {
    const r = await fetch(BETA_LINK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, smartAccount, owner: owner || null }),
    });
    const data = await r.json().catch(() => ({}));

    if (r.status === 403) {
      return { ok: false, message: data.message || "Correo no autorizado para la beta." };
    }
    if (!r.ok) {
      return { ok: false, message: data.message || "No se pudo vincular la wallet." };
    }
    return { ok: true, linked: !!data.linked };
  } catch (err) {
    console.error("[waitlist] link error:", err);
    return { ok: false, message: "No se pudo contactar con el servidor para vincular la wallet." };
  }
}

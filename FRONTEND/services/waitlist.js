/* ============================================================
   services/waitlist.js — Registro y login de usuarios.
   - isEmailAllowlisted(email): UX de verificación de email en registro.
   - registerUser(...): guarda usuario y wallet de smart account en backend.
   ============================================================ */

import {
  WAITLIST_ENDPOINT,
  WAITLIST_DEMO_EMAILS,
  LOGIN_ENDPOINT,
  REGISTER_ENDPOINT,
} from "../utils/constants.js";

async function requestJson(url, body, method = "POST") {
  try {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch (err) {
    console.error("[backend] request failed:", err);
    return { ok: false, status: 0, data: { message: "No se pudo contactar con el backend." } };
  }
}

/**
 * Comprueba si un correo está autorizado para entrar en la beta.
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function isEmailAllowlisted(email) {
  const e = (email || "").trim().toLowerCase();

  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return { ok: false, message: "Introduce un correo válido." };
  }

  const response = await requestJson(WAITLIST_ENDPOINT, { email: e });
  if (response.ok && response.data?.allowed) {
    return { ok: true };
  }

  if (response.data?.message) {
    return { ok: false, message: response.data.message };
  }

  if (Array.isArray(WAITLIST_DEMO_EMAILS) && WAITLIST_DEMO_EMAILS.length) {
    const allowed = WAITLIST_DEMO_EMAILS.map((x) => x.toLowerCase()).includes(e);
    return allowed
      ? { ok: true }
      : { ok: false, message: "Este correo no está en la lista de la beta (modo demo)." };
  }

  return { ok: false, message: "No se pudo verificar la lista de espera. Inténtalo más tarde." };
}

export async function registerUser(email, country, wallet, owner) {
  const e = (email || "").trim().toLowerCase();
  const response = await requestJson(REGISTER_ENDPOINT, { email: e, country, wallet, owner });
  if (response.ok) {
    return { ok: true };
  }
  return {
    ok: false,
    message: response.data?.message || "No se pudo crear la cuenta en la base de datos.",
  };
}

export async function loginUser(email) {
  const e = (email || "").trim().toLowerCase();
  const response = await requestJson(LOGIN_ENDPOINT, { email: e });
  if (response.ok) {
    return { ok: true, user: response.data?.user };
  }
  return {
    ok: false,
    message: response.data?.message || "No se pudo iniciar sesión.",
  };
}

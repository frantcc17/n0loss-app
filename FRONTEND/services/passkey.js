/* ============================================================
   services/passkey.js — Passkeys (WebAuthn) como firmante
   ------------------------------------------------------------
   La clave privada se genera y vive en el Secure Enclave / TEE del
   dispositivo. Nunca sale de ahí, ni siquiera nosotros la vemos.
   El backend solo guarda el credentialId y la clave pública, que
   NO son secretos: con ellos no se puede firmar nada.
   ============================================================ */

import {
  createWebAuthnCredential,
  toWebAuthnAccount,
} from "viem/account-abstraction";

import { API_BASE } from "../utils/constants.js";

/* ---------------------------------------------------------------
   Detección de soporte
   --------------------------------------------------------------- */

export function isPasskeySupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator.credentials?.create === "function"
  );
}

/* ¿Hay autenticador de plataforma (huella, Face ID, Windows Hello)?
   Si devuelve false el usuario tendría que usar una llave física o
   el móvil por QR, que es peor UX para un registro. */
export async function hasPlatformAuthenticator() {
  if (!isPasskeySupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------
   Alta de credencial
   --------------------------------------------------------------- */

/* Dispara el prompt biométrico del sistema operativo.
   Devuelve { id, publicKey }, ambos serializables a JSON. */
export async function createPasskey(email) {
  if (!isPasskeySupported()) {
    throw new Error(
      "Este navegador no soporta passkeys. Actualiza Chrome, Safari o Edge, o usa una wallet externa."
    );
  }

  try {
    const credential = await createWebAuthnCredential({
      name: `N0Loss — ${email}`,
    });

    return { id: credential.id, publicKey: credential.publicKey };
  } catch (err) {
    if (err?.name === "NotAllowedError") {
      throw new Error(
        "Registro cancelado. Inténtalo de nuevo y confirma con tu huella o tu cara."
      );
    }
    if (err?.name === "InvalidStateError") {
      throw new Error(
        "Ya existe una passkey de N0Loss en este dispositivo. Inicia sesión en lugar de registrarte."
      );
    }
    throw err;
  }
}

/* ---------------------------------------------------------------
   Recuperación de credencial existente
   --------------------------------------------------------------- */

/* Pide al backend la credencial guardada para este email.
   Nota de seguridad: si el backend estuviera comprometido y
   devolviera una clave pública falsa, se derivaría OTRA dirección
   de smart account. El atacante no puede robar los fondos de la
   cuenta real, porque no tiene la clave privada del dispositivo. */
export async function fetchPasskey(email) {
  const res = await fetch(
    `${API_BASE}/auth/passkey?email=${encodeURIComponent(email)}`,
    { headers: { accept: "application/json" } }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("No se pudo recuperar tu passkey. Inténtalo más tarde.");

  const data = await res.json();
  return data?.credential ?? null;
}

/* Guarda la credencial recién creada junto al usuario. */
export async function savePasskey({ email, credential, smartAccount }) {
  const res = await fetch(`${API_BASE}/auth/passkey`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      credentialId: credential.id,
      publicKey: credential.publicKey,
      smartAccount,
    }),
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => null);
    throw new Error(msg?.message || "No se pudo vincular tu passkey a la cuenta.");
  }

  return res.json();
}

/* ---------------------------------------------------------------
   Firmante
   --------------------------------------------------------------- */

/* Convierte { id, publicKey } en un firmante que la smart account
   puede usar. Cada firma vuelve a pedir la biometría. */
export function toSigner(credential) {
  return toWebAuthnAccount({ credential });
}

/* ============================================================
   services/wallet.js — Conexión con wallets (simulada en beta)
   Cuando pasemos a testnet real, este archivo es el único que
   cambia: connect() llamará a window.ethereum.request(...)
   ============================================================ */
import { sleep, createStore } from "../utils/helpers.js";
import { DEMO_WALLET } from "../utils/constants.js";

/* Estado de la conexión, observable desde cualquier componente */
export const walletStore = createStore({
  connected: false,
  address: null,
  provider: null,   // "metamask" | "walletconnect" | null
  chain: "polygon",
});

/* Proveedores disponibles para pintar en la UI */
export const PROVIDERS = [
  { id: "metamask", label: "MetaMask" },
  { id: "walletconnect", label: "WalletConnect" },
];

/* Conexión simulada: emula eth_requestAccounts con su latencia.
   Devuelve la dirección conectada.                              */
export async function connect(provider = "metamask") {
  await sleep(1400); // el usuario "aprueba" en su wallet
  walletStore.set({ connected: true, address: DEMO_WALLET, provider });
  return DEMO_WALLET;
}

export function disconnect() {
  walletStore.set({ connected: false, address: null, provider: null });
}

/* Firma simulada de una transacción: latencia de firma + minado.
   El Modal ya gestiona sus propios tiempos; esto existe para
   cuando servicios necesiten firmar sin UI (no usado en beta).  */
export async function signAndSend() {
  await sleep(1100);
  await sleep(1700);
  return true;
}

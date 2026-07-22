/* ============================================================
   services/wallet.js — Wallet + Abstracción de cuenta (ERC-4337)
   ------------------------------------------------------------
   Red        : Polygon Amoy (chainId 80002)
   Cuenta     : Kernel v0.3.1  ·  EntryPoint v0.7
   Infra      : Pimlico (bundler + paymaster), SIEMPRE vía backend
   Firmantes  : passkey (por defecto) | wallet externa | local (fallback)
   ------------------------------------------------------------
   Aquí no hay ninguna API key. El backend las añade al reenviar.
   Los imports son "bare specifiers": los resuelve el import map
   de index.html. Eso garantiza una única instancia de viem.
   ============================================================ */

import { createPublicClient, createWalletClient, custom, http } from "viem";
import { polygonAmoy } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import { createSmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";

import { API_BASE, PIMLICO_SPONSORSHIP_POLICY_ID } from "../utils/constants.js";
import {
  createPasskey,
  fetchPasskey,
  toSigner,
  isPasskeySupported,
  hasPlatformAuthenticator,
} from "./passkey.js";

/* ---------------------------------------------------------------
   Endpoints (proxy en el backend, sin credenciales en el cliente)
   --------------------------------------------------------------- */

const BUNDLER_URL = `${API_BASE}/aa/rpc`; // → Pimlico
const NODE_URL = `${API_BASE}/rpc`;       // → Alchemy / Infura

/* Solo para wallet_addEthereumChain: MetaMask necesita una URL
   pública a la que pueda llegar por su cuenta, no nuestro proxy. */
const PUBLIC_AMOY_RPC = "https://rpc-amoy.polygon.technology";
const AMOY_HEX = "0x13882"; // 80002

export const PROVIDERS = [
  { id: "passkey", label: "Crear con huella o Face ID", recommended: true },
  { id: "metamask", label: "MetaMask" },
  { id: "walletconnect", label: "WalletConnect" },
];

/* Filtra los métodos que el navegador puede ofrecer de verdad. */
export async function availableProviders() {
  const passkeyOk = isPasskeySupported() && (await hasPlatformAuthenticator());
  return PROVIDERS.filter((p) => (p.id === "passkey" ? passkeyOk : true));
}

/* ---------------------------------------------------------------
   Clientes base
   --------------------------------------------------------------- */

const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(NODE_URL),
});

const pimlicoClient = createPimlicoClient({
  chain: polygonAmoy,
  transport: http(BUNDLER_URL),
  entryPoint: { address: entryPoint07Address, version: "0.7" },
});

/* ---------------------------------------------------------------
   Construcción de la smart account
   --------------------------------------------------------------- */

async function buildSmartAccount(owner, meta = {}) {
  const account = await toKernelSmartAccount({
    client: publicClient,
    version: "0.3.1",
    owners: [owner],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });

  const client = createSmartAccountClient({
    account,
    chain: polygonAmoy,
    bundlerTransport: http(BUNDLER_URL),
    paymaster: pimlicoClient,
    paymasterContext: PIMLICO_SPONSORSHIP_POLICY_ID
      ? { sponsorshipPolicyId: PIMLICO_SPONSORSHIP_POLICY_ID }
      : undefined,
    userOperation: {
      // Sin esto, Polygon rechaza userOps por fees insuficientes.
      estimateFeesPerGas: async () =>
        (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return {
    address: account.address,          // la smart account
    ownerAddress: owner?.address ?? null, // null si el firmante es una passkey
    signerType: meta.signerType ?? "unknown",
    credential: meta.credential ?? null,
    client,
    account,
    owner,
  };
}

/* ---------------------------------------------------------------
   Camino 1 — Passkey (recomendado)
   --------------------------------------------------------------- */

/* Registro: crea la passkey y deriva la dirección.
   Ojo: la cuenta es counterfactual. La dirección existe y es estable,
   pero el contrato no se despliega hasta la primera transacción,
   que ya irá patrocinada. Es normal no verla en el explorer todavía. */
export async function createPasskeySmartAccount(email) {
  const credential = await createPasskey(email);
  return buildSmartAccount(toSigner(credential), {
    signerType: "passkey",
    credential,
  });
}

/* Login: recupera la credencial del backend y reconstruye la cuenta.
   La dirección resultante es idéntica a la del registro. */
export async function recoverPasskeySmartAccount(email) {
  const credential = await fetchPasskey(email);
  if (!credential) {
    throw new Error(
      "No hay ninguna passkey asociada a este correo en este momento."
    );
  }
  return buildSmartAccount(toSigner(credential), {
    signerType: "passkey",
    credential,
  });
}

/* ---------------------------------------------------------------
   Camino 2 — Wallet externa como firmante
   --------------------------------------------------------------- */

export async function connectSmartAccount(providerId = "metamask") {
  const provider = await getInjectedProvider(providerId);
  if (!provider) {
    throw new Error(
      "No se detectó ninguna wallet. Instala MetaMask o regístrate con huella."
    );
  }

  const [addr] = await provider.request({ method: "eth_requestAccounts" });
  await ensureAmoy(provider);

  const walletClient = createWalletClient({
    account: addr,
    chain: polygonAmoy,
    transport: custom(provider),
  });

  return buildSmartAccount(walletClient, { signerType: providerId });
}

/* ---------------------------------------------------------------
   Camino 3 — Firmante local (SOLO fallback de testnet)
   ------------------------------------------------------------
   Úsalo únicamente si el navegador no soporta passkeys. La clave
   vive en localStorage: si el usuario limpia el navegador, pierde
   el acceso. No debe llegar a mainnet.
   --------------------------------------------------------------- */

export async function createEmbeddedSmartAccount(email) {
  const key = `n0loss:signer:${(email || "anon").toLowerCase()}`;
  let pk = localStorage.getItem(key);
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(key, pk);
  }
  const owner = privateKeyToAccount(pk);

  // Si esto falla, falla de verdad. Antes se devolvía la EOA como si
  // fuese la smart account y se guardaba una dirección incorrecta en
  // la base de datos sin que nadie se enterase.
  return buildSmartAccount(owner, { signerType: "embedded" });
}

/* ---------------------------------------------------------------
   Envío de transacciones patrocinadas
   --------------------------------------------------------------- */

export async function sendSponsored(sa, calls) {
  if (!sa?.client) throw new Error("La wallet no está inicializada.");
  return sa.client.sendTransaction({
    calls: Array.isArray(calls) ? calls : [calls],
  });
}

/* ¿Está ya desplegada on-chain? */
export async function isDeployed(address) {
  const code = await publicClient.getCode({ address });
  return Boolean(code && code !== "0x");
}

/* ---------------------------------------------------------------
   Compatibilidad con el código existente
   --------------------------------------------------------------- */

export async function connect(providerId = "metamask") {
  const sa = await connectSmartAccount(providerId);
  return sa.address;
}

/* ---------------------------- helpers ---------------------------- */

async function getInjectedProvider(providerId) {
  if (providerId === "metamask") return window.ethereum ?? null;
  if (providerId === "walletconnect") return window.ethereum ?? null; // TODO: WC real
  return window.ethereum ?? null;
}

async function ensureAmoy(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY_HEX }],
    });
  } catch (err) {
    if (err?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: AMOY_HEX,
            chainName: "Polygon Amoy",
            nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
            rpcUrls: [PUBLIC_AMOY_RPC],
            blockExplorerUrls: ["https://amoy.polygonscan.com"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

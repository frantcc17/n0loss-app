/* ============================================================
   services/wallet.js — Wallet + Abstracción de cuenta (ERC-4337)
   Red: Polygon Amoy (testnet, chainId 80002)
   Stack: viem + permissionless.js + Pimlico (bundler + paymaster)
   ============================================================ */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "https://esm.sh/viem@2";
import { polygonAmoy } from "https://esm.sh/viem@2/chains";
import {
  privateKeyToAccount,
  generatePrivateKey,
} from "https://esm.sh/viem@2/accounts";
import { entryPoint07Address } from "https://esm.sh/viem@2/account-abstraction";
import { createSmartAccountClient } from "https://esm.sh/permissionless@0.2";
import { toSimpleSmartAccount } from "https://esm.sh/permissionless@0.2/accounts";
import { createPimlicoClient } from "https://esm.sh/permissionless@0.2/clients/pimlico";

import {
  AMOY_RPC,
  PIMLICO_API_KEY,
  PIMLICO_SPONSORSHIP_POLICY_ID,
} from "../utils/constants.js";

export const PROVIDERS = [
  { id: "metamask", label: "MetaMask" },
  { id: "walletconnect", label: "WalletConnect" },
];

const AMOY_HEX = "0x13882"; // 80002
const pimlicoUrl = `https://api.pimlico.io/v2/polygon-amoy/rpc?apikey=${PIMLICO_API_KEY}`;

const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(AMOY_RPC),
});

const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint: { address: entryPoint07Address, version: "0.7" },
});

async function buildSmartAccount(owner) {
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });

  const client = createSmartAccountClient({
    account,
    chain: polygonAmoy,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    paymasterContext: PIMLICO_SPONSORSHIP_POLICY_ID
      ? { sponsorshipPolicyId: PIMLICO_SPONSORSHIP_POLICY_ID }
      : undefined,
    userOperation: {
      estimateFeesPerGas: async () =>
        (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  // Dirección del firmante (EOA), útil para guardarla junto al enlace.
  const ownerAddress = owner?.address ?? owner?.account?.address ?? null;

  return { address: account.address, ownerAddress, client, account, owner };
}

/* Camino 1 — Wallet externa como firmante */
export async function connectSmartAccount(providerId = "metamask") {
  const provider = await getInjectedProvider(providerId);
  if (!provider) {
    throw new Error("No se detectó ninguna wallet. Instala MetaMask o usa WalletConnect.");
  }

  const [addr] = await provider.request({ method: "eth_requestAccounts" });
  await ensureAmoy(provider);

  const walletClient = createWalletClient({
    account: addr,
    chain: polygonAmoy,
    transport: custom(provider),
  });

  return buildSmartAccount(walletClient);
}

/* Camino 2 — Firmante embebido (SOLO DEMO/TESTNET) */
export async function createEmbeddedSmartAccount(email) {
  const key = `n0loss:signer:${(email || "anon").toLowerCase()}`;
  let pk = localStorage.getItem(key);
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(key, pk);
  }
  const owner = privateKeyToAccount(pk);
  return buildSmartAccount(owner);
}

/* Compatibilidad: connect() devolvía una dirección */
export async function connect(providerId = "metamask") {
  const sa = await connectSmartAccount(providerId);
  return sa.address;
}

/* ---------------------------- helpers ---------------------------- */
async function getInjectedProvider(providerId) {
  if (providerId === "metamask") return window.ethereum ?? null;
  if (providerId === "walletconnect") return window.ethereum ?? null; // TODO: WC provider real
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
        params: [{
          chainId: AMOY_HEX,
          chainName: "Polygon Amoy",
          nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
          rpcUrls: [AMOY_RPC],
          blockExplorerUrls: ["https://amoy.polygonscan.com"],
        }],
      });
    } else {
      throw err;
    }
  }
}

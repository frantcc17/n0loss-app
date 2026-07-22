/* ============================================================
   chain.js — Abstracción de cuenta (ERC-4337) en Polygon Amoy.
   viem + permissionless + Pimlico (bundler + paymaster).
   ============================================================ */
import { createPublicClient, http, getAddress } from "viem";
import { polygonAmoy } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { decryptSecret } from "./crypto.js";

const AMOY_RPC = process.env.AMOY_RPC || "https://rpc-amoy.polygon.technology";
const pimlicoUrl = () =>
  `https://api.pimlico.io/v2/polygon-amoy/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

const entryPoint = { address: entryPoint07Address, version: "0.7" };

export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(AMOY_RPC),
});

const pimlicoClient = () =>
  createPimlicoClient({ transport: http(pimlicoUrl()), entryPoint });

const paymasterContext = () =>
  process.env.PIMLICO_SPONSORSHIP_POLICY_ID
    ? { sponsorshipPolicyId: process.env.PIMLICO_SPONSORSHIP_POLICY_ID }
    : undefined;

/**
 * Dirección contrafactual de la cuenta inteligente para un firmante dado.
 * Es determinista: la misma EOA siempre produce la misma cuenta, y la
 * cuenta no se despliega hasta la primera operación (el despliegue va
 * incluido en la primera userOp y también lo paga el paymaster).
 */
export async function predictSmartAccount(ownerAddress) {
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner: { address: getAddress(ownerAddress), type: "local" },
    entryPoint,
  });
  return getAddress(account.address);
}

/**
 * Genera un firmante nuevo, propiedad del servidor, y devuelve la
 * clave privada en claro para que quien llama la cifre de inmediato.
 */
export async function createManagedWallet() {
  const privateKey = generatePrivateKey();
  const owner = privateKeyToAccount(privateKey);
  const smartAccount = await predictSmartAccount(owner.address);
  return { privateKey, ownerAddress: owner.address, smartAccount };
}

/**
 * Cliente listo para enviar userOps con gas patrocinado, para un usuario
 * de tipo 'managed'. Los usuarios 'external' firman desde su propia wallet
 * en el navegador (services/wallet.js).
 */
export async function smartAccountClientForUser(user) {
  if (user.signer_kind !== "managed") {
    throw new Error("Esta cuenta firma desde la wallet del usuario.");
  }
  const owner = privateKeyToAccount(decryptSecret(user.signer_secret));
  const account = await toSimpleSmartAccount({ client: publicClient, owner, entryPoint });
  const pimlico = pimlicoClient();

  return createSmartAccountClient({
    account,
    chain: polygonAmoy,
    bundlerTransport: http(pimlicoUrl()),
    paymaster: pimlico,
    paymasterContext: paymasterContext(),
    userOperation: {
      estimateFeesPerGas: async () =>
        (await pimlico.getUserOperationGasPrice()).fast,
    },
  });
}

/** ¿Está ya desplegado el contrato de la cuenta? */
export async function isDeployed(address) {
  const code = await publicClient.getCode({ address: getAddress(address) });
  return !!code && code !== "0x";
}

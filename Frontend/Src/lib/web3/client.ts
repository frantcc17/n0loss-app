/**
 * Web3 / Account Abstraction client.
 *
 * For the beta this app runs entirely on MOCK data (see auth-context.tsx and
 * mock-data.ts) so it can be demoed with zero on-chain dependencies.
 *
 * To wire it to a real ERC-4337 smart wallet + email login for the Polygon
 * fork, this is the only file that needs a real implementation:
 *
 *   import { createThirdwebClient } from "thirdweb";
 *   export const client = createThirdwebClient({
 *     clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
 *   });
 *
 * Then in auth-context.tsx, swap the mock sendCode/verifyCode calls for
 * thirdweb's `inAppWallet({ auth: { options: ["email"] } })`, and point the
 * chain at your Polygon fork (chain id 137, custom rpc pointing at your
 * `anvil --fork-url <polygon-rpc>` instance) or Polygon Amoy testnet.
 *
 * Kept as a stub for now since the beta uses fake funds and no real
 * contracts exist yet — see /contracts (phase 2) in the architecture doc.
 */

export const CHAIN_CONFIG = {
  name: "Polygon (fork - beta)",
  chainId: 137,
  currency: "USDF", // mock "fake USD" token minted for beta testers
  blockExplorer: null,
};

export const AA_PROVIDER_TODO =
  "Conectar thirdweb / Privy Embedded Wallet aquí con NEXT_PUBLIC_THIRDWEB_CLIENT_ID";

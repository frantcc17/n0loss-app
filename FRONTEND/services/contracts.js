/* ============================================================
   services/contracts.js — Interacción con smart contracts
   En beta: construye los descriptores de transacción que consume
   walletModal(). En testnet real: aquí irán las llamadas viem/
   ethers a Vault.sol y DistributionEngine.sol.
   ============================================================ */
import { CONTRACTS, PROTOCOL } from "../utils/constants.js";
import { fmt, toTickets } from "../utils/format.js";

/* ---------- Depósito: flujo real de dos firmas ----------
   1) approve() en el contrato USDC
   2) deposit() en el Vault ERC-4626                          */
export function buildDepositTx(amount) {
  return {
    steps: [
      {
        label: "Aprobar USDC",
        fn: "approve(address,uint256)",
        contractName: CONTRACTS.usdc.name,
        contractAddr: CONTRACTS.usdc.address,
        amount: `${fmt(amount, 2)} USDC`,
        detail:
          "Autorizas al Vault de N0Loss a mover exactamente este importe de USDC. Es el paso estándar previo a cualquier depósito ERC-20.",
      },
      {
        label: "Depositar en el Vault",
        fn: "deposit(uint256,address)",
        contractName: CONTRACTS.vault.name,
        contractAddr: CONTRACTS.vault.address,
        amount: `${fmt(amount, 2)} USDC`,
        detail: `Recibirás ${toTickets(amount)} tickets para el sorteo. Si depositas a mitad de ciclo, participas pro-rata por los días restantes.`,
      },
    ],
  };
}

/* ---------- Retiro: una firma, con aviso de exclusión ---------- */
export function buildWithdrawTx(amount) {
  return {
    warning:
      "Al retirar (parcial o total) quedas excluido del sorteo y no podrás volver a depositar hasta el inicio del siguiente ciclo completo. Tu racha de constancia se reinicia a cero.",
    steps: [
      {
        label: "Retirar del Vault",
        fn: "withdraw(uint256,address,address)",
        contractName: CONTRACTS.vault.name,
        contractAddr: CONTRACTS.vault.address,
        amount: `${fmt(amount, 2)} USDC`,
        detail: "El USDC vuelve a tu wallet al instante desde el colchón de liquidez del protocolo.",
      },
    ],
  };
}

/* ---------- Reclamo de premio: patrón pull-payment ---------- */
export function buildClaimTx(prize) {
  return {
    steps: [
      {
        label: "Reclamar premio",
        fn: "claimPrize()",
        contractName: CONTRACTS.engine.name,
        contractAddr: CONTRACTS.engine.address,
        amount: `${fmt(prize, 2)} USDC`,
        detail:
          "Patrón pull-payment: el premio está acreditado a tu dirección y lo retiras firmando esta transacción.",
      },
    ],
  };
}

/* ---------- Reglas de validación del protocolo ---------- */
export function validateDeposit(amount) {
  if (amount < PROTOCOL.minDeposit) return `El depósito mínimo es ${PROTOCOL.minDeposit} USDC.`;
  if (amount > PROTOCOL.maxDeposit) return `El depósito máximo por usuario es ${fmt(PROTOCOL.maxDeposit)} USDC.`;
  return null;
}

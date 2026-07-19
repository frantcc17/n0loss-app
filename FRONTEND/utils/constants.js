/* ============================================================
   utils/constants.js — Parámetros del protocolo y configuración
   (whitepaper v1.2)
   ============================================================ */

export const PROTOCOL = {
  name: "N0Loss",
  network: "Polygon PoS",
  tvl: 262140,               // USDC (demo)
  apr: 4.5,                  // % media móvil 4 semanas (Ondo OUSG)
  participants: 1847,
  totalTickets: 26214,
  cycle: 14,                 // ciclo actual
  ticketPrice: 10,           // 1 ticket = 10 USDC
  minDeposit: 10,
  maxDeposit: 100000,
  yieldSplit: { reward: 0.70, treasury: 0.20, lp: 0.10 }, // α / β / γ
  scoreWeights: { capital: 0.70, streak: 0.20, history: 0.10 },
  drawDay: 5,                // viernes
  drawHour: 18,              // 18:00 hora local
};

/* Direcciones de contratos (testnet demo) */
export const CONTRACTS = {
  vault:  { name: "Vault.sol (ERC-4626)",      address: "0x4Fa9b21cE0dE7331AD83c1A8b2E96f1d5C9021aB" },
  usdc:   { name: "USDC (Circle)",             address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" },
  engine: { name: "DistributionEngine.sol",    address: "0x81dC55eF9021bA0aE3F1cC0e02D144f7A6b0932F" },
};

/* Yield semanal = TVL × APR × 7/365 · Bote = 70% (α) */
export const weeklyYield = () => PROTOCOL.tvl * (PROTOCOL.apr / 100) * (7 / 365);
export const rewardPool  = () => weeklyYield() * PROTOCOL.yieldSplit.reward;

/* Rutas de la SPA (hash routing) */
export const ROUTES = {
  home:      { hash: "#/home",      title: "Mi panel" },
  vault:     { hash: "#/vault",     title: "Vault" },
  lottery:   { hash: "#/lottery",   title: "Sorteo" },
  portfolio: { hash: "#/portfolio", title: "Portafolio" },
  settings:  { hash: "#/settings",  title: "Ajustes" },
};
export const DEFAULT_ROUTE = "home";

/* Wallet demo de la beta */
export const DEMO_WALLET = "0x8F3aB4d17E90cC24aF61B02dE55E19a8f3D2C21b";

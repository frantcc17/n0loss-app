/* ============================================================
   pages/Vault/Vault.js — Gestión del vault
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $ } from "../../utils/helpers.js";
import { fmt, shortAddr } from "../../utils/format.js";
import { CONTRACTS, PROTOCOL } from "../../utils/constants.js";
import { getProtocolStats } from "../../services/api.js";
import VaultCard from "../../components/VaultCard/VaultCard.js";
import { statCard } from "../../components/Card/Card.js";
import { donutChart } from "../../components/Charts/Chart.js";

let templates = null;

async function getTemplates() {
  if (!templates) {
    injectCSS("./pages/Vault/Vault.css");
    const html = await loadTemplate("./pages/Vault/Vault.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    templates = {
      page: doc.querySelector("#tpl-vault").innerHTML,
      contract: doc.querySelector("#tpl-vault-contract").innerHTML,
    };
  }
  return templates;
}

export default async function Vault(outlet) {
  const t = await getTemplates();
  outlet.innerHTML = t.page;

  /* Estadísticas del protocolo */
  const statsSlot = $("[data-slot='stats']", outlet);
  const stats = await getProtocolStats();
  statsSlot.append(
    await statCard({ label: "TVL", value: `${fmt(stats.tvl)} USDC`, color: "--green" }),
    await statCard({ label: "APR efectivo (4 sem.)", value: `${stats.apr.toFixed(1)}% · Ondo OUSG` }),
    await statCard({ label: "Bote de esta semana", value: `${fmt(stats.rewardPool)} USDC`, color: "--gold" }),
    await statCard({ label: "Participantes", value: fmt(stats.participants) })
  );

  /* VaultCard con depósito/retiro */
  await VaultCard($("[data-slot='vaultcard']", outlet));

  /* Donut del reparto α/β/γ */
  const split = PROTOCOL.yieldSplit;
  await donutChart($("[data-slot='split']", outlet), [
    { label: "Reward Pool", value: split.reward * 100, color: "--gold" },
    { label: "Tesorería", value: split.treasury * 100, color: "--green" },
    { label: "LP Incentive", value: split.lp * 100, color: "--purple" },
  ]);

  /* Contratos */
  const contractsSlot = $("[data-slot='contracts']", outlet);
  contractsSlot.innerHTML = Object.values(CONTRACTS)
    .map((c) => tpl(t.contract, { name: c.name, addr: shortAddr(c.address) }))
    .join("");
}

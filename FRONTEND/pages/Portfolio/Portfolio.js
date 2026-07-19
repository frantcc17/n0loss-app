/* ============================================================
   pages/Portfolio/Portfolio.js — Portafolio e inversiones
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $ } from "../../utils/helpers.js";
import { fmt, toTickets } from "../../utils/format.js";
import { store } from "../../App.js";
import { getTvlHistory, getPrizeHistory, getUserActivity } from "../../services/api.js";
import { getAprHistory, usdcToEur } from "../../services/prices.js";
import { statCard } from "../../components/Card/Card.js";
import { areaChart, barChart } from "../../components/Charts/Chart.js";

let templates = null;

async function getTemplates() {
  if (!templates) {
    injectCSS("./pages/Portfolio/Portfolio.css");
    const html = await loadTemplate("./pages/Portfolio/Portfolio.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    templates = {
      page: doc.querySelector("#tpl-portfolio").innerHTML,
      activity: doc.querySelector("#tpl-portfolio-activity").innerHTML,
    };
  }
  return templates;
}

export default async function Portfolio(outlet) {
  const t = await getTemplates();
  outlet.innerHTML = t.page;

  const state = store.get();
  const eur = await usdcToEur(state.balance);

  /* ---------- Resumen de posición ---------- */
  const statsSlot = $("[data-slot='stats']", outlet);
  statsSlot.append(
    await statCard({
      label: "Tu capital",
      value: `${fmt(state.balance, 2)} USDC`,
      sub: `≈ ${fmt(eur, 2)} EUR`,
      color: "--green",
    }),
    await statCard({
      label: "Tickets este ciclo",
      value: fmt(toTickets(state.balance)),
      sub: "1 ticket = 10 USDC",
      color: "--gold",
    }),
    await statCard({
      label: "Premio pendiente",
      value: state.pendingPrize > 0 ? `${fmt(state.pendingPrize, 2)} USDC` : "—",
      sub: state.pendingPrize > 0 ? "Reclámalo desde tu panel" : "Sin premios por reclamar",
    }),
    await statCard({
      label: "Ciclos participados",
      value: String(state.cyclesTotal),
      sub: `${state.cyclesConsecutive} consecutivos sin retirar`,
    })
  );

  /* ---------- Gráficas ---------- */
  await areaChart($("[data-slot='tvl']", outlet), await getTvlHistory(), { color: "--green" });
  await barChart($("[data-slot='prizes']", outlet), await getPrizeHistory(), { color: "--gold" });
  await areaChart($("[data-slot='apr']", outlet), await getAprHistory(), { color: "--purple" });

  /* ---------- Movimientos ---------- */
  const activity = await getUserActivity();
  $("[data-slot='activity']", outlet).innerHTML = activity
    .map((m) =>
      tpl(t.activity, {
        type: m.type,
        label: m.label,
        date: m.date,
        amount: m.type === "ticket" ? `${fmt(m.amount)} tickets` : `+${fmt(m.amount, 2)} USDC`,
        amountClass: m.type === "ticket" ? "text-gold" : "text-green",
      })
    )
    .join("");
}

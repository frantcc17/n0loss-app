/* ============================================================
   pages/Lottery/Lottery.js — Página de sorteos
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $ } from "../../utils/helpers.js";
import { fmt, toTickets, shortAddr } from "../../utils/format.js";
import { rewardPool } from "../../utils/constants.js";
import { store } from "../../App.js";
import { getDrawPool, getPastDraws } from "../../services/api.js";
import LotteryCard from "../../components/LotteryCard/LotteryCard.js";

/* Misma paleta pastel que los segmentos de la rueda */
const SEG_COLORS = ["#CBE6D4", "#BFDFC9", "#DCEFE1", "#B2D6BF", "#E4F3E6", "#A8CFB6", "#D3EAD9"];

let templates = null;

async function getTemplates() {
  if (!templates) {
    injectCSS("./pages/Lottery/Lottery.css");
    const html = await loadTemplate("./pages/Lottery/Lottery.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pick = (id) => doc.querySelector(id).innerHTML;
    templates = {
      page: pick("#tpl-lottery"),
      participant: pick("#tpl-lottery-participant"),
      draw: pick("#tpl-lottery-draw"),
    };
  }
  return templates;
}

export default async function Lottery(outlet) {
  const t = await getTemplates();
  outlet.innerHTML = t.page;

  const state = store.get();
  const prize = rewardPool();

  /* ---------- Pool: participantes demo + el usuario si tiene tickets ---------- */
  const userTickets = state.suspended ? 0 : toTickets(state.balance);
  const pool = await getDrawPool();
  if (userTickets > 0) {
    pool.push({ name: "Tú", score: Math.max(0.4, userTickets / 14.2), you: true });
  }
  const total = pool.reduce((a, p) => a + p.score, 0);

  /* ---------- Rueda ---------- */
  await LotteryCard($("[data-slot='wheel']", outlet), {
    pool,
    prize,
    onWinner: (winner) => {
      /* Si ganas tú, el premio queda pendiente de reclamo en Home */
      if (winner.you) store.set({ pendingPrize: prize });
    },
  });

  /* ---------- Lista de participantes ---------- */
  const listSlot = $("[data-slot='participants']", outlet);
  listSlot.innerHTML = pool
    .map((p, i) =>
      tpl(t.participant, {
        color: p.you ? "var(--green)" : SEG_COLORS[i % SEG_COLORS.length],
        name: p.name,
        nameClass: p.you ? "is-you" : "",
        score: p.score.toFixed(2),
        pct: ((p.score / total) * 100).toFixed(1),
      })
    )
    .join("");

  if (userTickets === 0) {
    $("[data-slot='cta']", outlet).textContent = state.suspended
      ? "Participación suspendida este ciclo: volverás a entrar en la rueda en el próximo."
      : "Deposita al menos 10 USDC para entrar en la rueda del próximo ciclo.";
  }

  /* ---------- Histórico de sorteos ---------- */
  const draws = await getPastDraws();
  $("[data-slot='draws']", outlet).innerHTML = draws
    .map((d) =>
      tpl(t.draw, {
        cycle: d.cycle,
        date: d.date,
        winner: d.winner,
        prize: fmt(d.prize, 1),
        vrf: d.vrf.slice(0, 10),
      })
    )
    .join("");
}

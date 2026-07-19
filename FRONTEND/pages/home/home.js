/* ============================================================
   pages/Home/Home.js — Panel principal del usuario
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $ } from "../../utils/helpers.js";
import { fmt, toTickets, nextDraw, countdownTo } from "../../utils/format.js";
import { PROTOCOL, rewardPool } from "../../utils/constants.js";
import { store } from "../../App.js";
import VaultCard from "../../components/VaultCard/VaultCard.js";
import { walletModal } from "../../components/Modal/Modal.js";
import { buildClaimTx } from "../../services/contracts.js";

let templates = null;

async function getTemplates() {
  if (!templates) {
    injectCSS("./pages/Home/Home.css");
    const html = await loadTemplate("./pages/Home/Home.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pick = (id) => doc.querySelector(id).innerHTML;
    templates = {
      page: pick("#tpl-home"),
      prize: pick("#tpl-home-prize"),
      timebox: pick("#tpl-home-timebox"),
      scorebar: pick("#tpl-home-scorebar"),
    };
  }
  return templates;
}

export default async function Home(outlet) {
  const t = await getTemplates();

  outlet.innerHTML = tpl(t.page, {
    cycle: PROTOCOL.cycle,
    pot: fmt(rewardPool()),
  });

  /* ---------- VaultCard (reactiva por sí misma) ---------- */
  await VaultCard($("[data-slot='vaultcard']", outlet));

  /* ---------- Cuenta atrás al viernes 18:00 ---------- */
  const cdSlot = $("[data-slot='countdown']", outlet);
  const target = nextDraw();
  const units = [["D", "d"], ["H", "h"], ["M", "m"], ["S", "s"]];
  const tickClock = () => {
    const c = countdownTo(target);
    cdSlot.innerHTML = units
      .map(([label, key]) =>
        tpl(t.timebox, { value: String(c[key]).padStart(2, "0"), unit: label })
      )
      .join("");
  };
  tickClock();
  const clockId = setInterval(tickClock, 1000);

  /* ---------- Premio pendiente + aviso + score (reactivos) ---------- */
  const prizeSlot = $("[data-slot='prize']", outlet);
  const suspSlot = $("[data-slot='suspended']", outlet);
  const scoreTotal = $("[data-slot='score-total']", outlet);
  const scoreBars = $("[data-slot='score-bars']", outlet);

  const renderDynamic = () => {
    const s = store.get();

    /* Premio pendiente (pull-payment) */
    if (s.pendingPrize > 0) {
      prizeSlot.innerHTML = tpl(t.prize, { amount: fmt(s.pendingPrize, 2) });
      $("[data-action='claim']", prizeSlot).onclick = async () => {
        const ok = await walletModal(buildClaimTx(s.pendingPrize));
        if (ok) {
          store.set((st) => ({
            balance: st.balance + st.pendingPrize,
            pendingPrize: 0,
          }));
        }
      };
    } else {
      prizeSlot.innerHTML = "";
    }

    /* Aviso de suspensión */
    suspSlot.innerHTML = s.suspended
      ? `<div class="card card--notice card--notice-danger" style="margin-top:18px">
           Participación suspendida: tras un retiro quedas fuera del sorteo y no puedes
           volver a depositar hasta el inicio del siguiente ciclo completo.
         </div>`
      : "";

    /* Reputation Score (whitepaper §4.1) */
    const tickets = toTickets(s.balance);
    const avg = PROTOCOL.totalTickets / PROTOCOL.participants;
    const w = PROTOCOL.scoreWeights;
    const capital = tickets / avg;
    const streak = s.cyclesConsecutive / 4;
    const history = s.cyclesTotal / PROTOCOL.cycle;
    const score = w.capital * capital + w.streak * s.cyclesConsecutive + w.history * (s.cyclesTotal / PROTOCOL.cycle);

    scoreTotal.textContent = score.toFixed(2);
    const bars = [
      ["Capital", "70%", capital, `${fmt(tickets)} tickets vs. media de ${avg.toFixed(1)}`],
      ["Constancia", "20%", streak, `${s.cyclesConsecutive} ciclos consecutivos sin retirar`],
      ["Histórico", "10%", history, `${s.cyclesTotal} de ${PROTOCOL.cycle} ciclos del protocolo`],
    ];
    scoreBars.innerHTML = bars
      .map(([name, weight, val, sub]) =>
        tpl(t.scorebar, {
          name,
          weight,
          value: Math.min(val, 3).toFixed(2),
          pct: Math.min(100, (val / 3) * 100),
          sub,
        })
      )
      .join("");
  };

  renderDynamic();
  const unsub = store.subscribe(renderDynamic);

  /* ---------- Limpieza al salir de la página ---------- */
  const obs = new MutationObserver(() => {
    if (!document.contains(outlet.firstElementChild)) {
      clearInterval(clockId);
      unsub();
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

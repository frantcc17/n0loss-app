/* ============================================================
   components/VaultCard/VaultCard.js — Tarjeta del Vault
   Conecta: store (App) + Modal (importe y firma) + contracts.
   Uso: import VaultCard from "…"; await VaultCard(container);
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $ } from "../../utils/helpers.js";
import { fmt, toTickets } from "../../utils/format.js";
import { PROTOCOL } from "../../utils/constants.js";
import { store } from "../../App.js";
import { amountModal, walletModal } from "../Modal/Modal.js";
import { buildDepositTx, buildWithdrawTx } from "../../services/contracts.js";

let template = null;

/* Probabilidad estimada según el Reputation Score (heurística de la beta) */
function estimateProb(state) {
  const tickets = toTickets(state.balance);
  if (tickets === 0 || state.suspended) return "—";
  const avg = PROTOCOL.totalTickets / PROTOCOL.participants;
  const w = PROTOCOL.scoreWeights;
  const score =
    w.capital * (tickets / avg) +
    w.streak * state.cyclesConsecutive +
    w.history * (state.cyclesTotal / PROTOCOL.cycle);
  return Math.min(99, (score / (score + 120)) * 800).toFixed(2) + "%";
}

export default async function VaultCard(container) {
  if (!template) {
    injectCSS("./components/VaultCard/VaultCard.css");
    const html = await loadTemplate("./components/VaultCard/VaultCard.html");
    template = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("#tpl-vaultcard").innerHTML;
  }

  const host = document.createElement("div");
  container.append(host);

  const render = () => {
    const state = store.get();
    host.innerHTML = tpl(template, {
      balance: fmt(state.balance, 2),
      tickets: fmt(toTickets(state.balance)),
      prob: estimateProb(state),
    });

    /* Aviso de exclusión tras retiro */
    if (state.suspended) {
      $("[data-slot='notice']", host).innerHTML =
        `<div class="card--notice card--notice-danger">Participación suspendida: no puedes depositar ni entrar al sorteo hasta el próximo ciclo.</div>`;
    }

    const btnDeposit = $("[data-action='deposit']", host);
    const btnWithdraw = $("[data-action='withdraw']", host);
    btnDeposit.disabled = state.suspended;
    btnWithdraw.disabled = state.balance <= 0;

    /* ---- Depósito: importe → approve() → deposit() ---- */
    btnDeposit.onclick = async () => {
      const n = await amountModal({ mode: "deposit" });
      if (n == null) return;
      const ok = await walletModal(buildDepositTx(n));
      if (ok) store.set((s) => ({ balance: s.balance + n }));
    };

    /* ---- Retiro: importe → withdraw() con aviso ---- */
    btnWithdraw.onclick = async () => {
      const n = await amountModal({ mode: "withdraw", max: state.balance });
      if (n == null) return;
      const ok = await walletModal(buildWithdrawTx(n));
      if (ok) {
        store.set((s) => ({
          balance: s.balance - n,
          suspended: true,
          cyclesConsecutive: 0,
        }));
      }
    };
  };

  render();
  /* Re-render cuando cambia el estado global (balance, suspensión…) */
  const unsub = store.subscribe(render);

  /* Limpieza si el nodo desaparece del DOM (cambio de página) */
  const obs = new MutationObserver(() => {
    if (!document.contains(host)) { unsub(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  return host;
}

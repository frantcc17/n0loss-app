/* ============================================================
   components/Modal/Modal.js — Ventanas modales
   API:
     walletModal(tx)          → Promise<boolean>  firma multi-paso
     amountModal(opts)        → Promise<number|null>
     openModal(node)          → { close }         modal genérico
   Estructura de tx:
     {
       warning?: string,
       steps: [{ label, fn, contractName, contractAddr, amount?, detail? }]
     }
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $, sleep } from "../../utils/helpers.js";
import { shortAddr, fmt, toTickets } from "../../utils/format.js";
import { PROTOCOL, DEMO_WALLET } from "../../utils/constants.js";
import { store } from "../../App.js";

let templates = null;

async function getTemplates() {
  if (templates) return templates;
  injectCSS("./components/Modal/Modal.css");
  const html = await loadTemplate("./components/Modal/Modal.html");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pick = (id) => doc.querySelector(id).innerHTML;
  templates = {
    header: pick("#tpl-wallet-header"),
    review: pick("#tpl-wallet-review"),
    state: pick("#tpl-wallet-state"),
    confirmed: pick("#tpl-wallet-confirmed"),
    amount: pick("#tpl-amount"),
  };
  return templates;
}

/* ---------- Modal genérico ---------- */
export function openModal(node) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const box = document.createElement("div");
  box.className = "modal";
  box.append(node);
  backdrop.append(box);
  $("#overlay-root").append(backdrop);

  const close = () => backdrop.remove();
  return { close, box };
}

/* ---------- Firma de transacción estilo wallet ----------
   Resuelve true si el usuario firma todos los pasos,
   false si rechaza en cualquier momento.                      */
export async function walletModal(tx) {
  const t = await getTemplates();
  const wallet = store.get().user?.wallet || DEMO_WALLET;

  return new Promise((resolve) => {
    const content = document.createElement("div");
    content.innerHTML = tpl(t.header, { wallet: shortAddr(wallet) });
    const body = document.createElement("div");
    content.append(body);

    const { close } = openModal(content);
    let stepIdx = 0;

    const renderReview = () => {
      const step = tx.steps[stepIdx];
      body.innerHTML = tpl(t.review, {
        label: step.label,
        stepCount: tx.steps.length > 1 ? `Paso ${stepIdx + 1} de ${tx.steps.length}` : "",
        amount: step.amount ?? "",
        contractName: step.contractName,
        contractAddr: shortAddr(step.contractAddr),
        fn: step.fn,
        detail: step.detail ?? "",
        warning: stepIdx === 0 ? (tx.warning ?? "") : "",
      });

      $("[data-action='reject']", body).onclick = () => { close(); resolve(false); };
      $("[data-action='sign']", body).onclick = signFlow;
    };

    const renderState = (label, sub) => {
      body.innerHTML = tpl(t.state, { label, sub });
    };

    const signFlow = async () => {
      /* Simulación de firma + confirmación en red */
      renderState("Firmando con tu clave privada…", "Confirma en tu dispositivo si usas hardware wallet.");
      await sleep(1100);
      renderState("Transacción enviada", "Esperando confirmación en Polygon…");
      await sleep(1700);

      const step = tx.steps[stepIdx];
      const last = stepIdx === tx.steps.length - 1;
      body.innerHTML = tpl(t.confirmed, {
        label: step.label,
        nextLabel: last ? "Cerrar" : `Continuar · ${tx.steps[stepIdx + 1].label}`,
      });
      $("[data-action='next']", body).onclick = () => {
        if (last) { close(); resolve(true); }
        else { stepIdx += 1; renderReview(); }
      };
    };

    renderReview();
  });
}

/* ---------- Modal de importe ----------
   mode: "deposit" | "withdraw" · max: saldo disponible
   Resuelve con el número introducido o null si cancela.        */
export async function amountModal({ mode, max = 0 }) {
  const t = await getTemplates();
  const isDeposit = mode === "deposit";

  return new Promise((resolve) => {
    const content = document.createElement("div");
    content.innerHTML = tpl(t.amount, {
      title: isDeposit ? "Depositar USDC" : "Retirar USDC",
      desc: isDeposit
        ? `Mínimo ${PROTOCOL.minDeposit} USDC · máximo ${fmt(PROTOCOL.maxDeposit)} USDC por usuario. 1 ticket por cada ${PROTOCOL.ticketPrice} USDC.`
        : "Sin plazos ni penalización. Tras retirar, quedas fuera del sorteo hasta el próximo ciclo.",
      initial: isDeposit ? "100" : String(max),
    });

    const { close } = openModal(content);
    const input = $(".amount__input", content);
    const ticketsSlot = $("[data-slot='tickets']", content);
    const confirmBtn = $("[data-action='confirm']", content);

    const validate = () => {
      const n = parseFloat(input.value) || 0;
      const valid = isDeposit
        ? n >= PROTOCOL.minDeposit && n <= PROTOCOL.maxDeposit
        : n > 0 && n <= max;
      confirmBtn.disabled = !valid;
      ticketsSlot.textContent = isDeposit && n > 0 ? `= ${toTickets(n)} tickets` : "";
      return { n, valid };
    };

    input.addEventListener("input", validate);
    validate();

    $("[data-action='cancel']", content).onclick = () => { close(); resolve(null); };
    confirmBtn.onclick = () => {
      const { n, valid } = validate();
      if (!valid) return;
      close();
      resolve(n);
    };
  });
}

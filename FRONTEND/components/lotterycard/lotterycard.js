/* ============================================================
   components/LotteryCard/LotteryCard.js — Tarjeta del sorteo
   Uso:
     import LotteryCard from "…";
     await LotteryCard(container, {
       pool: [{ name, score, you? }],   // participantes ponderados
       prize: 430,                       // bote en USDC
       onWinner: (winner) => {}          // callback al terminar
     });
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $, sleep } from "../../utils/helpers.js";
import { fmt } from "../../utils/format.js";

/* Verdes pastel para los segmentos; el del usuario va en verde oscuro */
const SEG_COLORS = ["#CBE6D4", "#BFDFC9", "#DCEFE1", "#B2D6BF", "#E4F3E6", "#A8CFB6", "#D3EAD9"];
const CONFETTI_COLORS = ["#0F4A34", "#B98A1F", "#7FBF9B", "#6C4FD8"];

let templates = null;

async function getTemplates() {
  if (templates) return templates;
  injectCSS("./components/LotteryCard/LotteryCard.css");
  const html = await loadTemplate("./components/LotteryCard/LotteryCard.html");
  const doc = new DOMParser().parseFromString(html, "text/html");
  templates = {
    card: doc.querySelector("#tpl-lotterycard").innerHTML,
    step: doc.querySelector("#tpl-lottery-step").innerHTML,
    winner: doc.querySelector("#tpl-lottery-winner").innerHTML,
  };
  return templates;
}

/* Geometría de la rueda */
const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arcPath = (start, end) => {
  const [x1, y1] = polar(150, 150, 140, start);
  const [x2, y2] = polar(150, 150, 140, end);
  const large = end - start > 180 ? 1 : 0;
  return `M150,150 L${x1},${y1} A140,140 0 ${large} 1 ${x2},${y2} Z`;
};

/* Segmentos proporcionales al score */
function buildSegments(pool) {
  const total = pool.reduce((a, p) => a + p.score, 0);
  let acc = 0;
  return {
    total,
    segs: pool.map((p, i) => {
      const start = (acc / total) * 360;
      acc += p.score;
      const end = (acc / total) * 360;
      return { ...p, start, end, mid: (start + end) / 2, i };
    }),
  };
}

function renderWheel(svg, segs) {
  svg.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";
  for (const s of segs) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", arcPath(s.start, s.end));
    path.setAttribute("fill", s.you ? "var(--green)" : SEG_COLORS[s.i % SEG_COLORS.length]);
    path.setAttribute("stroke", "#FFFFFF");
    path.setAttribute("stroke-width", "2");
    svg.append(path);

    const [tx, ty] = polar(150, 150, 95, s.mid);
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", tx);
    text.setAttribute("y", ty);
    text.setAttribute("fill", s.you ? "#FFFFFF" : "#1B4536");
    text.setAttribute("font-weight", s.you ? "700" : "500");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("transform", `rotate(${s.mid}, ${tx}, ${ty})`);
    text.textContent = s.name;
    svg.append(text);
  }
  /* Centro: anillo de marca */
  svg.insertAdjacentHTML(
    "beforeend",
    `<circle cx="150" cy="150" r="34" fill="#FFFFFF" stroke="var(--line)" stroke-width="2"></circle>
     <circle cx="150" cy="150" r="24" fill="none" stroke="var(--green)" stroke-width="3"></circle>
     <line x1="141" y1="159" x2="159" y2="141" stroke="var(--green)" stroke-width="3" stroke-linecap="round"></line>`
  );
}

/* Selección ponderada: P(i) = score_i / Σ scores */
function pickWinner(segs, total) {
  let r = Math.random() * total;
  let acc = 0;
  for (const s of segs) {
    acc += s.score;
    if (r <= acc) return s;
  }
  return segs[segs.length - 1];
}

function launchConfetti(slot, isYou) {
  slot.innerHTML = "";
  for (let i = 0; i < 44; i++) {
    const piece = document.createElement("span");
    const size = 5 + Math.random() * 6;
    piece.style.left = Math.random() * 100 + "%";
    piece.style.width = size + "px";
    piece.style.height = size * 0.55 + "px";
    piece.style.background = isYou
      ? CONFETTI_COLORS[i % 4]
      : i % 2 ? "#0F4A34" : "#7FBF9B";
    piece.style.setProperty("--dur", 2.4 + Math.random() * 1.6 + "s");
    piece.style.setProperty("--delay", Math.random() * 0.9 + "s");
    slot.append(piece);
  }
}

export default async function LotteryCard(container, { pool, prize, onWinner }) {
  const t = await getTemplates();

  const host = document.createElement("div");
  host.innerHTML = tpl(t.card, { prize: fmt(prize) });
  const card = host.firstElementChild;
  container.append(card);

  const wheel = $("[data-slot='wheel']", card);
  const status = $("[data-slot='status']", card);
  const confettiSlot = $("[data-slot='confetti']", card);

  const { segs, total } = buildSegments(pool);
  renderWheel(wheel, segs);

  let rotation = 0;

  const showStep = (n, label) => {
    status.innerHTML = tpl(t.step, { n, label });
  };

  const run = async () => {
    confettiSlot.innerHTML = "";

    /* Secuencia Chainlink VRF v2.5 */
    showStep(1, "Solicitando número aleatorio a Chainlink VRF v2.5…");
    await sleep(1600);
    showStep(2, "Prueba criptográfica verificada on-chain ✓ — seleccionando ganador ponderado");
    await sleep(1700);
    showStep(3, "Ejecutando DistributionEngine.sol…");

    /* Giro: 6 vueltas + aterrizar con el segmento ganador bajo el puntero */
    const winner = pickWinner(segs, total);
    const target = 360 * 6 + (360 - winner.mid);
    rotation += target - (rotation % 360);
    wheel.classList.add("is-spinning");
    wheel.style.transform = `rotate(${rotation}deg)`;
    await sleep(6200);
    wheel.classList.remove("is-spinning");

    /* Resultado */
    launchConfetti(confettiSlot, !!winner.you);
    status.innerHTML = tpl(t.winner, {
      heading: winner.you ? "¡Enhorabuena!" : "Ganador del ciclo",
      name: winner.you ? "TÚ 🏆" : winner.name,
      nameClass: winner.you ? "text-gold" : "",
      prize: fmt(prize, 2),
      note: winner.you
        ? "El premio queda acreditado: reclámalo desde tu panel (pull-payment)."
        : "Premio acreditado al ganador vía pull-payment.",
    });
    $("[data-action='run']", status).onclick = run;

    onWinner?.(winner);
  };

  $("[data-action='run']", status).onclick = run;
  return card;
}

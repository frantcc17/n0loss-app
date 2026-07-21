/* ============================================================
   pages/Lottery/Lottery.js — Página de sorteos (Cascada de Hash)
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $ } from "../../utils/helpers.js";
import { fmt, toTickets, shortAddr } from "../../utils/format.js";
import { rewardPool } from "../../utils/constants.js";
import { store } from "../../App.js";
import { getDrawPool, getPastDraws } from "../../services/api.js";

/* Paleta de colores para la infraestructura criptográfica de los nodos */
const NODE_COLORS = ["#CBE6D4", "#BFDFC9", "#DCEFE1", "#B2D6BF", "#E4F3E6", "#A8CFB6", "#D3EAD9"];

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
      matrixNode: pick("#tpl-lottery-matrix-node"), // Nuevo template de nodo
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

  /* ---------- Pool: participantes + inyección del usuario ---------- */
  const userTickets = state.suspended ? 0 : toTickets(state.balance);
  const pool = await getDrawPool();
  
  if (userTickets > 0) {
    // Generar una wallet ficticia o usar la del usuario conectada si existiera
    const userAddr = "0x71C...3A90"; 
    pool.push({ 
      name: "Tú", 
      address: userAddr,
      score: Math.max(0.4, userTickets / 14.2), 
      you: true 
    });
  }

  // Asegurar que todos los participantes tengan una propiedad address para la matriz
  pool.forEach((p, i) => {
    if (!p.address) p.address = `0x${Math.random().toString(16).substring(2, 10)}...${i}9F2`;
  });

  const totalScore = pool.reduce((a, p) => a + p.score, 0);

  /* ---------- Renderizar Lista Lateral de Participantes ---------- */
  const listSlot = $("[data-slot='participants']", outlet);
  listSlot.innerHTML = pool
    .map((p, i) =>
      tpl(t.participant, {
        address: p.address,
        color: p.you ? "var(--green)" : NODE_COLORS[i % NODE_COLORS.length],
        name: p.name,
        nameClass: p.you ? "is-you" : "",
        score: p.score.toFixed(2),
        pct: ((p.score / totalScore) * 100).toFixed(1),
      })
    )
    .join("");

  /* ---------- Renderizar Grilla / Matriz del Motor VRF ---------- */
  const matrixSlot = $("[data-slot='matrix-display']", outlet);
  matrixSlot.innerHTML = pool
    .map((p, i) =>
      tpl(t.matrixNode, {
        address: p.address,
        shortAddress: p.you ? "TÚ" : shortAddr(p.address),
        color: p.you ? "var(--green)" : NODE_COLORS[i % NODE_COLORS.length],
      })
    )
    .join("");

  /* ---------- Gestión del Botón de Acción / CTA State ---------- */
  const ctaContainer = $("[data-slot='cta-container']", outlet);
  
  if (userTickets === 0) {
    const txt = state.suspended
      ? "Participación suspendida este ciclo: volverás a entrar en la cascada en el próximo."
      : "Deposita al menos 10 USDC para entrar en el sorteo del próximo ciclo.";
    ctaContainer.innerHTML = `<p class="lottery__cta text-gold">${txt}</p>`;
  } else {
    // Si tiene tickets habilitamos el botón para ejecutar la simulación interactiva
    ctaContainer.innerHTML = `<button class="btn btn--gold" id="btn-trigger-vrf">Simular Selección Chainlink VRF</button>`;
    
    $("#btn-trigger-vrf", outlet).addEventListener("click", () => {
      runHashCascadeSimulation(pool, totalScore, prize, outlet);
    });
  }

  /* ---------- Histórico de Sorteos ---------- */
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

/* ------------------------------------------------------------
   LÓGICA DE ANIMACIÓN Y SELECCIÓN PONDERADA (CASCADA)
   ------------------------------------------------------------ */
function runHashCascadeSimulation(pool, totalScore, prize, outlet) {
  const btn = $("#btn-trigger-vrf", outlet);
  const randomWordSlot = $("[data-slot='random-word']", outlet);
  if (btn) btn.disabled = true;

  // 1. Ejecutar Selección Ponderada Matemática Real (Ecuación 2)
  let rand = Math.random() * totalScore;
  let cumulativeScore = 0;
  let winner = pool[pool.length - 1]; // Fallback

  for (const participant of pool) {
    cumulativeScore += participant.score;
    if (rand <= cumulativeScore) {
      winner = participant;
      break;
    }
  }

  // 2. Animación de "Generación de Semilla" en el display del Random Word
  let ticks = 0;
  const intervalHex = setInterval(() => {
    // Generar un hash hexadecimal aleatorio simulando la respuesta de Chainlink VRF v2.5
    const mockHash = "0x" + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    
    randomWordSlot.textContent = mockHash;
    randomWordSlot.style.color = "var(--green)";
    
    ticks++;
    if (ticks > 25) { // Detener la mutación del hash raíz
      clearInterval(intervalHex);
      // Imprimir el hash definitivo final que amarra matemáticamente al ganador
      randomWordSlot.textContent = "0x8f2d...3c9a" + Math.random().toString(16).substring(2, 10) + "...ff25";
      randomWordSlot.style.color = "var(--gold)";
      
      // Iniciar el proceso de descarte secuencial en cascada
      executeDiscardCascade(pool, winner, prize, outlet);
    }
  }, 60);
}

function executeDiscardCascade(pool, winner, prize, outlet) {
  // Filtrar los perdedores y mezclarlos de forma aleatoria para el orden de descarte visual
  const losers = pool.filter(p => p.address !== winner.address);
  shuffleArray(losers);

  // Dividir el grupo de perdedores en tandas (batches) para eliminarlos progresivamente
  const batchSize = Math.ceil(losers.length / 4); 
  let currentBatch = 0;

  const intervalCascade = setInterval(() => {
    const startIdx = currentBatch * batchSize;
    const endIdx = startIdx + batchSize;
    const currentLosers = losers.slice(startIdx, endIdx);

    currentLosers.forEach(loser => {
      // Apagar nodo en la matriz
      const nodeEl = $(`.matrix-node[data-addr="${loser.address}"]`, outlet);
      if (nodeEl) nodeEl.classList.add("is-discarded");
      
      // Opacar fila en el listado derecho
      const rowEl = $(`.lottery__row[data-participant-addr="${loser.address}"]`, outlet);
      if (rowEl) rowEl.classList.add("is-discarded");
    });

    // Poner en evaluación visual los nodos que quedan vivos temporalmente
    pool.forEach(p => {
      const nodeEl = $(`.matrix-node[data-addr="${p.address}"]`, outlet);
      if (nodeEl && !nodeEl.classList.contains("is-discarded") && p.address !== winner.address) {
        nodeEl.classList.add("is-evaluating");
      }
    });

    currentBatch++;

    // Condición de cierre: Solo queda el ganador real
    if (startIdx >= losers.length) {
      clearInterval(intervalCascade);
      
      // Limpiar estados transitorios de evaluación
      pool.forEach(p => {
        const nodeEl = $(`.matrix-node[data-addr="${p.address}"]`, outlet);
        if (nodeEl) nodeEl.classList.remove("is-evaluating");
      });

      // Coronar al ganador de la ronda
      const winnerNode = $(`.matrix-node[data-addr="${winner.address}"]`, outlet);
      if (winnerNode) winnerNode.classList.add("is-winner");

      const winnerRow = $(`.lottery__row[data-participant-addr="${winner.address}"]`, outlet);
      if (winnerRow) winnerRow.classList.add("is-winner");

      // Si el ganador es el usuario conectado, actualizar el estado global reactivo
      if (winner.you) {
        store.set({ pendingPrize: prize });
      }

      // Restablecer o mutar el contenedor de acción
      const ctaContainer = $("[data-slot='cta-container']", outlet);
      ctaContainer.innerHTML = `
        <div class="text-green mono text-sm" style="margin-top:10px; font-weight:700;">
          ¡Sorteo Completado! Ganador: ${winner.name} (${fmt(prize, 1)} USDC)
        </div>
      `;
    }
  }, 600); // Velocidad a la que cae la cascada bajando los bloques
}

/* Función auxiliar de desordenamiento para que el descarte visual no sea predecible */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

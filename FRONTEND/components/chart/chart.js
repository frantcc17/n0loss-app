/* ============================================================
   components/Charts/Chart.js — Gráficas en canvas nativo
   API:
     await areaChart(container, data, opts)   data: [{label, value}]
     await barChart(container, data, opts)
     await donutChart(container, segments)    segments: [{label, value, color, display?}]
   Los colores se pasan como variables CSS ("--green", "--gold").
   ============================================================ */
import { loadTemplate, tpl, injectCSS } from "../../utils/helpers.js";
import { fmt } from "../../utils/format.js";

let templates = null;

async function getTemplates() {
  if (templates) return templates;
  injectCSS("./components/Charts/Chart.css");
  const html = await loadTemplate("./components/Charts/Chart.html");
  const doc = new DOMParser().parseFromString(html, "text/html");
  templates = {
    chart: doc.querySelector("#tpl-chart").innerHTML,
    donut: doc.querySelector("#tpl-chart-donut").innerHTML,
    legendRow: doc.querySelector("#tpl-chart-legend-row").innerHTML,
  };
  return templates;
}

/* Lee una variable CSS de :root ("--green" → "#0F4A34") */
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function toNode(html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild;
}

/* Prepara el canvas para pantallas HiDPI y devuelve el contexto */
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

const PAD = { top: 10, right: 8, bottom: 26, left: 40 };

/* Ejes, rejilla y etiquetas comunes */
function drawFrame(ctx, w, h, data, maxV) {
  const line = cssVar("--line-soft");
  const muted = cssVar("--muted-2");
  ctx.strokeStyle = line;
  ctx.fillStyle = muted;
  ctx.font = "11px " + cssVar("--mono");
  ctx.lineWidth = 1;

  const rows = 4;
  for (let i = 0; i <= rows; i++) {
    const y = PAD.top + ((h - PAD.top - PAD.bottom) * i) / rows;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(w - PAD.right, y);
    ctx.stroke();
    const v = maxV * (1 - i / rows);
    ctx.fillText(v >= 1000 ? fmt(v / 1000) + "k" : fmt(v), 4, y + 4);
  }

  const step = (w - PAD.left - PAD.right) / data.length;
  const every = Math.ceil(data.length / 8); // máx. ~8 etiquetas
  data.forEach((d, i) => {
    if (i % every) return;
    ctx.fillText(d.label, PAD.left + step * i + step / 2 - 8, h - 8);
  });
  return step;
}

/* ---------- Gráfica de área ---------- */
export async function areaChart(container, data, { color = "--green" } = {}) {
  const t = await getTemplates();
  const node = toNode(t.chart);
  container.append(node);

  const { ctx, w, h } = setupCanvas(node.querySelector("canvas"));
  const maxV = Math.max(...data.map((d) => d.value)) * 1.08;
  const step = drawFrame(ctx, w, h, data, maxV);
  const c = cssVar(color);

  const x = (i) => PAD.left + step * i + step / 2;
  const y = (v) => PAD.top + (h - PAD.top - PAD.bottom) * (1 - v / maxV);

  /* Relleno degradado */
  const grad = ctx.createLinearGradient(0, PAD.top, 0, h - PAD.bottom);
  grad.addColorStop(0, c + "48");
  grad.addColorStop(1, c + "00");
  ctx.beginPath();
  ctx.moveTo(x(0), h - PAD.bottom);
  data.forEach((d, i) => ctx.lineTo(x(i), y(d.value)));
  ctx.lineTo(x(data.length - 1), h - PAD.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  /* Línea */
  ctx.beginPath();
  data.forEach((d, i) => (i ? ctx.lineTo(x(i), y(d.value)) : ctx.moveTo(x(i), y(d.value))));
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.stroke();

  return node;
}

/* ---------- Gráfica de barras ---------- */
export async function barChart(container, data, { color = "--gold" } = {}) {
  const t = await getTemplates();
  const node = toNode(t.chart);
  container.append(node);

  const { ctx, w, h } = setupCanvas(node.querySelector("canvas"));
  const maxV = Math.max(...data.map((d) => d.value)) * 1.12;
  const step = drawFrame(ctx, w, h, data, maxV);
  const c = cssVar(color);

  const barW = Math.min(34, step * 0.55);
  data.forEach((d, i) => {
    const x = PAD.left + step * i + (step - barW) / 2;
    const y = PAD.top + (h - PAD.top - PAD.bottom) * (1 - d.value / maxV);
    const bh = h - PAD.bottom - y;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, [6, 6, 0, 0]);
    ctx.fill();
  });

  return node;
}

/* ---------- Donut con leyenda ---------- */
export async function donutChart(container, segments) {
  const t = await getTemplates();
  const node = toNode(t.donut);
  container.append(node);

  const { ctx, w, h } = setupCanvas(node.querySelector("canvas"));
  const cx = w / 2, cy = h / 2;
  const rOut = Math.min(w, h) / 2 - 4;
  const rIn = rOut * 0.66;
  const total = segments.reduce((a, s) => a + s.value, 0);

  let angle = -Math.PI / 2;
  for (const s of segments) {
    const slice = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, angle + 0.02, angle + slice - 0.02);
    ctx.arc(cx, cy, rIn, angle + slice - 0.02, angle + 0.02, true);
    ctx.closePath();
    ctx.fillStyle = cssVar(s.color);
    ctx.fill();
    angle += slice;
  }

  /* Leyenda */
  const legend = node.querySelector(".chart__legend");
  for (const s of segments) {
    legend.insertAdjacentHTML(
      "beforeend",
      tpl(t.legendRow, {
        color: cssVar(s.color),
        label: s.label,
        value: s.display ?? s.value + "%",
      })
    );
  }

  return node;
}

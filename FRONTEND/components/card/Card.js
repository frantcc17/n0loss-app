/* ============================================================
   components/Card/Card.js — Fábricas de tarjetas reutilizables
   Uso:
     import { statCard, panelCard, noticeCard } from ".../Card.js";
     grid.append(statCard({ label: "TVL", value: "262.140 USDC" }));
   ============================================================ */
import { loadTemplate, tpl, injectCSS } from "../../utils/helpers.js";

let templates = null;

/* Carga las <template> de Card.html una sola vez */
async function getTemplates() {
  if (templates) return templates;
  injectCSS("./components/Card/Card.css");
  const html = await loadTemplate("./components/Card/Card.html");
  const doc = new DOMParser().parseFromString(html, "text/html");
  templates = {
    stat: doc.querySelector("#tpl-card-stat").innerHTML,
    panel: doc.querySelector("#tpl-card-panel").innerHTML,
    notice: doc.querySelector("#tpl-card-notice").innerHTML,
  };
  return templates;
}

function toNode(html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild;
}

/* Tarjeta de estadística.
   color: variable CSS sin var(), p. ej. "--green" | "--gold" | "--text" */
export async function statCard({ label, value, sub = "", color = "--text" }) {
  const t = await getTemplates();
  return toNode(tpl(t.stat, { label, value, sub, color }));
}

/* Tarjeta panel con título; body puede ser un nodo o un string HTML */
export async function panelCard({ title, body }) {
  const t = await getTemplates();
  const node = toNode(tpl(t.panel, { title }));
  const slot = node.querySelector(".card-panel__body");
  if (typeof body === "string") slot.innerHTML = body;
  else if (body) slot.append(body);
  return node;
}

/* Tarjeta de aviso. kind: "info" | "warn" | "danger" */
export async function noticeCard({ text, kind = "info" }) {
  const t = await getTemplates();
  return toNode(tpl(t.notice, { text, kind }));
}

/* ============================================================
   utils/helpers.js — DOM, plantillas, CSS y estado reactivo
   Es el pegamento de la arquitectura: cada componente tiene su
   .html (plantilla), .css (inyectado una vez) y .js (lógica).
   ============================================================ */

/* ---------- Selectores ---------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Plantillas HTML (con caché) ----------
   loadTemplate("./components/Navbar/Navbar.html") → string HTML   */
const tplCache = new Map();
export async function loadTemplate(url) {
  if (tplCache.has(url)) return tplCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar la plantilla: ${url}`);
  const html = await res.text();
  tplCache.set(url, html);
  return html;
}

/* Rellena {{claves}} de una plantilla: tpl("Hola {{name}}", {name:"Ana"}) */
export const tpl = (html, data = {}) =>
  html.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] ?? ""));

/* ---------- CSS por componente (inyectado una sola vez) ---------- */
const cssLoaded = new Set();
export function injectCSS(url) {
  if (cssLoaded.has(url)) return;
  cssLoaded.add(url);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

/* ---------- Creación de nodos ---------- */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/* Delegación de eventos: on(root, "click", "[data-action]", fn) */
export function on(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

/* ---------- Store reactivo mínimo ----------
   const store = createStore({balance: 0});
   store.subscribe(state => render(state));
   store.set({balance: 100});                              */
export function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      subs.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/* ---------- Espera ---------- */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

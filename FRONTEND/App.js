/* ============================================================
   App.js — Componente raíz: estado global, router y shell
   ============================================================ */
import { $, createStore } from "./utils/helpers.js";
import { ROUTES, DEFAULT_ROUTE, DEMO_WALLET } from "./utils/constants.js";

/* ---------- Estado global de la app ---------- */
export const store = createStore({
  user: null,               // { email, country, wallet } | null
  balance: 0,               // USDC en el Vault
  available: 0,             // saldo disponible para comprar tickets
  cyclesConsecutive: 0,     // racha sin retirar (constancia)
  cyclesTotal: 0,           // ciclos históricos participados
  pendingPrize: 0,          // premio pendiente de reclamar (pull-payment)
  suspended: false,         // excluido tras un retiro hasta el próximo ciclo
  route: DEFAULT_ROUTE,
});

/* Sesión demo al iniciar sesión */
export function loginDemo(email) {
  store.set({
    user: { email: email || "demo@n0loss.com", wallet: DEMO_WALLET },
    balance: 0,
    available: 10000,
    cyclesConsecutive: 0,
    cyclesTotal: 0,
  });
}
export function logout() {
  store.set({
    user: null, balance: 0, available: 0, cyclesConsecutive: 0, cyclesTotal: 0,
    pendingPrize: 0, suspended: false,
  });
  location.hash = "#/auth";
}

/* ---------- Router por hash ---------- */
function currentRoute() {
  const hash = location.hash || "";
  const name = hash.replace("#/", "").split("?")[0];
  if (name === "auth") return "auth";
  return ROUTES[name] ? name : DEFAULT_ROUTE;
}

/* Carga dinámica de páginas; si aún no existe el archivo, placeholder */
async function renderPage(route, outlet) {
  const map = {
    auth:      () => import("./pages/Auth/Auth.js"),
    home:      () => import("./pages/Home/Home.js"),
    vault:     () => import("./pages/Vault/Vault.js"),
    lottery:   () => import("./pages/Lottery/Lottery.js"),
    portfolio: () => import("./pages/Portfolio/Portfolio.js"),
    settings:  () => import("./pages/Settings/Settings.js"),
  };
  try {
    const mod = await map[route]();
    await mod.default(outlet);            // cada página exporta default(outlet)
  } catch (err) {
    console.warn(`Página "${route}" pendiente de construir:`, err.message);
    outlet.innerHTML = `
      <div class="placeholder">
        <span class="badge">En construcción</span>
        <h1 class="h1">${ROUTES[route]?.title ?? route}</h1>
        <p class="sub">Esta página se añadirá en el siguiente lote.</p>
      </div>`;
  }
}

/* ---------- Shell: navbar + sidebar + outlet ---------- */
async function renderShell(root) {
  const { user } = store.get();

  /* Sin sesión → solo la página de auth, sin shell */
  if (!user) {
    root.innerHTML = `<main id="outlet" class="app-main app-main--full"></main>`;
    await renderPage("auth", $("#outlet", root));
    return;
  }

  root.innerHTML = `
    <header id="navbar-root"></header>
    <main id="outlet" class="app-main"></main>
    <footer class="app-footer">
      Beta demostrativa · sin fondos reales · Polygon PoS · Whitepaper v1.2<br />
      N0Loss está en fase de constitución legal: nada aquí constituye oferta de servicios de inversión.
    </footer>`;

  /* Navbar con la navegación arriba */
  try {
    const { default: Navbar } = await import("./components/Navbar/Navbar.js");
    await Navbar($("#navbar-root", root));
  } catch { /* Navbar pendiente */ }

  await renderPage(store.get().route, $("#outlet", root));
}

/* ---------- Pantalla de carga ---------- */
let splashHidden = false;
function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  const splash = document.getElementById("splash");
  if (!splash) return;
  /* Duración mínima de 900 ms para que el logo y el eslogan se aprecien */
  setTimeout(() => {
    splash.classList.add("is-hidden");
    setTimeout(() => splash.remove(), 500);
  }, 2900);
}

/* ---------- Arranque ---------- */
export default function App(root) {
  const sync = () => {
    const route = currentRoute();
    if (!store.get().user && route !== "auth") {
      location.hash = "#/auth";           // guardia de sesión
      return;
    }
    store.set({ route });
    renderShell(root).then(hideSplash);
  };

  window.addEventListener("hashchange", sync);

  /* Re-render del shell cuando cambia la sesión */
  let lastUser = store.get().user;
  store.subscribe((s) => {
    if (s.user !== lastUser) {
      lastUser = s.user;
      renderShell(root);
    }
  });

  if (!location.hash) location.hash = "#/auth";
  sync();
}

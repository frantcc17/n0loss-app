/* ============================================================
   components/Navbar/Navbar.js — Barra superior con navegación
   Uso: import Navbar from "…"; await Navbar(rootElement);
   ============================================================ */
import { loadTemplate, tpl, injectCSS, on, $$ } from "../../utils/helpers.js";
import { shortAddr } from "../../utils/format.js";
import { PROTOCOL } from "../../utils/constants.js";
import { store, logout } from "../../App.js";

export default async function Navbar(root) {
  injectCSS("./components/Navbar/Navbar.css");

  const html = await loadTemplate("./components/Navbar/Navbar.html");
  const { user, route } = store.get();

  root.innerHTML = tpl(html, {
    wallet: shortAddr(user?.wallet),
    cycle: PROTOCOL.cycle,
  });

  /* Pestaña activa según la ruta actual */
  $$(".navbar__tab", root).forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === route);
  });

  /* Acciones */
  on(root, "click", "[data-action='logout']", () => logout());
}

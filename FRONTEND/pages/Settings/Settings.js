/* ============================================================
   pages/Settings/Settings.js — Configuración y perfil
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $, $$ } from "../../utils/helpers.js";
import { shortAddr } from "../../utils/format.js";
import { store, logout } from "../../App.js";

const PREFS = [
  { label: "Resultado del sorteo", sub: "Cada viernes tras el cierre del ciclo", checked: true },
  { label: "Premio pendiente", sub: "Cuando tengas un premio por reclamar", checked: true },
  { label: "Recordatorio de depósito", sub: "48 h antes del cierre del ciclo", checked: false },
  { label: "Novedades del protocolo", sub: "Auditorías, hitos y cambios relevantes", checked: true },
];

let templates = null;

async function getTemplates() {
  if (!templates) {
    injectCSS("./pages/Settings/Settings.css");
    const html = await loadTemplate("./pages/Settings/Settings.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    templates = {
      page: doc.querySelector("#tpl-settings").innerHTML,
      pref: doc.querySelector("#tpl-settings-pref").innerHTML,
    };
  }
  return templates;
}

export default async function Settings(outlet) {
  const t = await getTemplates();
  const { user } = store.get();

  outlet.innerHTML = tpl(t.page, {
    email: user?.email ?? "",
    wallet: shortAddr(user?.wallet),
  });

  /* País guardado */
  if (user?.country) $("[name='country']", outlet).value = user.country;

  /* Preferencias */
  $("[data-slot='prefs']", outlet).innerHTML = PREFS
    .map((p) => tpl(t.pref, { ...p, checked: p.checked ? "checked" : "" }))
    .join("");

  /* Guardar perfil */
  $("[data-action='save']", outlet).onclick = () => {
    const email = $("[name='email']", outlet).value;
    const country = $("[name='country']", outlet).value;
    store.set((s) => ({ user: { ...s.user, email, country } }));
    const saved = $("[data-slot='saved']", outlet);
    saved.textContent = "✓ Guardado";
    setTimeout(() => (saved.textContent = ""), 2000);
  };

  /* Copiar dirección */
  $("[data-action='copy']", outlet).onclick = async (e) => {
    const btn = e.target.closest("button");
    try {
      await navigator.clipboard.writeText(user?.wallet ?? "");
      btn.textContent = "✓ Copiada";
    } catch {
      btn.textContent = "No disponible";
    }
    setTimeout(() => (btn.textContent = "Copiar dirección"), 2000);
  };

  /* Cerrar sesión */
  $("[data-action='logout']", outlet).onclick = logout;
}

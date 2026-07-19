/* ============================================================
   pages/Auth/Auth.js — Inicio de sesión y registro
   Vistas: login | reg1 (datos) | reg2 (wallet) | reg3 (listo)
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $ } from "../../utils/helpers.js";
import { shortAddr } from "../../utils/format.js";
import { loginDemo } from "../../App.js";
import { connect, PROVIDERS } from "../../services/wallet.js";

let templates = null;

async function getTemplates() {
  if (templates) return templates;
  injectCSS("./pages/Auth/Auth.css");
  const html = await loadTemplate("./pages/Auth/Auth.html");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pick = (id) => doc.querySelector(id).innerHTML;
  templates = {
    shell: pick("#tpl-auth"),
    login: pick("#tpl-auth-login"),
    reg1: pick("#tpl-auth-reg1"),
    reg2: pick("#tpl-auth-reg2"),
    reg3: pick("#tpl-auth-reg3"),
    connecting: pick("#tpl-auth-connecting"),
  };
  return templates;
}

export default async function Auth(outlet) {
  const t = await getTemplates();
  outlet.innerHTML = t.shell;

  const tagline = $("[data-slot='tagline']", outlet);
  const steps = $("[data-slot='steps']", outlet);
  const view = $("[data-slot='view']", outlet);
  const switcher = $("[data-slot='switch']", outlet);

  const form = { email: "", country: "España", wallet: null };

  const enter = () => {
    loginDemo(form.email);
    location.hash = "#/home";
  };

  /* ---------- Vistas ---------- */
  const showLogin = () => {
    tagline.textContent =
      "Ahorro con premios semanales. Tu capital se mantiene intacto: solo el rendimiento financia los sorteos de cada viernes.";
    steps.innerHTML = "";
    view.innerHTML = t.login;
    switcher.innerHTML = `¿Aún no tienes cuenta? <a data-action="go-register">Regístrate</a>`;

    $("[data-action='login']", view).onclick = () => {
      form.email = $("[name='email']", view).value;
      enter();
    };
    $("[data-action='connect-login']", view).onclick = async (e) => {
      e.target.closest("button").disabled = true;
      await connect("metamask");
      enter();
    };
    $("[data-action='go-register']", switcher).onclick = () => showReg(1);
  };

  const paintSteps = (step) => {
    steps.innerHTML = [1, 2, 3]
      .map((s) => `<span class="${s <= step ? "is-done" : ""}"></span>`)
      .join("");
  };

  const showReg = async (step) => {
    tagline.textContent = "Tres pasos: datos, wallet y listo.";
    switcher.innerHTML = `¿Ya tienes cuenta? <a data-action="go-login">Inicia sesión</a>`;
    $("[data-action='go-login']", switcher).onclick = showLogin;
    paintSteps(step);

    if (step === 1) {
      view.innerHTML = t.reg1;
      $("[data-action='reg-next']", view).onclick = () => {
        form.email = $("[name='email']", view).value;
        form.country = $("[name='country']", view).value;
        showReg(2);
      };
    }

    if (step === 2) {
      view.innerHTML = t.reg2;
      const slot = $("[data-slot='providers']", view);
      for (const p of PROVIDERS) {
        const btn = document.createElement("button");
        btn.className = "btn btn--ghost btn--block auth__provider";
        btn.innerHTML = `<span class="auth__providericon auth__providericon--${p.id === "metamask" ? "mm" : "wc"}"></span>${p.label}`;
        btn.onclick = async () => {
          view.innerHTML = tpl(t.connecting, { provider: p.label });
          form.wallet = await connect(p.id);
          showReg(3);
        };
        slot.append(btn);
      }
      $("[data-action='reg-skip']", view).onclick = () => showReg(3);
    }

    if (step === 3) {
      const { DEMO_WALLET } = await import("../../utils/constants.js");
      view.innerHTML = tpl(t.reg3, { wallet: shortAddr(form.wallet || DEMO_WALLET) });
      $("[data-action='reg-finish']", view).onclick = enter;
    }
  };

  showLogin();
}

/* ============================================================
   pages/Auth/Auth.js — Inicio de sesión y registro
   Vistas: login | reg1 (datos) | reg2 (wallet) | reg3 (listo)
   ============================================================ */
import { loadTemplate, tpl, injectCSS, $ } from "../../utils/helpers.js";
import { shortAddr } from "../../utils/format.js";
import { loginDemo } from "../../App.js";
import {
  connectSmartAccount,
  createEmbeddedSmartAccount,
  PROVIDERS,
} from "../../services/wallet.js";
import { isEmailAllowlisted, linkBetaWallet } from "../../services/waitlist.js";

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

function flashError(container, msg) {
  container.querySelector(".auth__error")?.remove();
  const el = document.createElement("div");
  el.className = "auth__error";
  el.textContent = msg;
  el.style.cssText =
    "margin-bottom:12px;padding:10px 12px;border-radius:8px;" +
    "background:#fdecea;color:#b71c1c;font-size:13px;line-height:1.45;";
  container.prepend(el);
}

export default async function Auth(outlet) {
  const t = await getTemplates();
  outlet.innerHTML = t.shell;

  const tagline = $("[data-slot='tagline']", outlet);
  const steps = $("[data-slot='steps']", outlet);
  const view = $("[data-slot='view']", outlet);
  const switcher = $("[data-slot='switch']", outlet);

  const form = { email: "", country: "España", wallet: null, smartAccount: null };

  const enter = () => {
    loginDemo(form.email);
    location.hash = "#/home";
  };

  // Crea la smart account y la vincula en servidor (puerta real).
  // Devuelve true si todo fue bien; pinta el error y devuelve false si no.
  const createAndLink = async (saPromise) => {
    const sa = await saPromise;
    form.wallet = sa.address;
    form.smartAccount = sa;

    const link = await linkBetaWallet(form.email, sa.address, sa.ownerAddress);
    if (!link.ok) {
      await showReg(2);
      flashError(view, link.message || "No se pudo vincular la wallet a la beta.");
      return false;
    }
    return true;
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
      // Login = usuario ya registrado. Valida credenciales contra tu backend.
      enter();
    };

    $("[data-action='connect-login']", view).onclick = async (e) => {
      const btn = e.target.closest("button");
      btn.disabled = true;
      try {
        const sa = await connectSmartAccount("metamask");
        form.wallet = sa.address;
        form.smartAccount = sa;
        enter();
      } catch (err) {
        btn.disabled = false;
        flashError(view, err.message || "No se pudo conectar la wallet.");
      }
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

    /* ----- Paso 1: datos + verificación de lista ----- */
    if (step === 1) {
      view.innerHTML = t.reg1;
      $("[data-action='reg-next']", view).onclick = async () => {
        form.email = $("[name='email']", view).value.trim();
        form.country = $("[name='country']", view).value;

        if (!$("[name='terms']", view)?.checked) {
          return flashError(view, "Debes aceptar los términos para continuar.");
        }

        const btn = $("[data-action='reg-next']", view);
        btn.disabled = true;
        const label = btn.textContent;
        btn.textContent = "Verificando…";

        const res = await isEmailAllowlisted(form.email);

        btn.disabled = false;
        btn.textContent = label;

        if (!res.ok) {
          return flashError(view, res.message || "Este correo no está en la lista de la beta.");
        }
        showReg(2);
      };
    }

    /* ----- Paso 2: conectar wallet o saltar (crea + vincula) ----- */
    if (step === 2) {
      view.innerHTML = t.reg2;
      const slot = $("[data-slot='providers']", view);

      for (const p of PROVIDERS) {
        const btn = document.createElement("button");
        btn.className = "btn btn--ghost btn--block auth__provider";
        btn.innerHTML =
          `<span class="auth__providericon auth__providericon--${
            p.id === "metamask" ? "mm" : "wc"
          }"></span>${p.label}`;
        btn.onclick = async () => {
          view.innerHTML = tpl(t.connecting, { provider: p.label });
          try {
            const ok = await createAndLink(connectSmartAccount(p.id));
            if (ok) showReg(3);
          } catch (err) {
            await showReg(2);
            flashError(view, err.message || "No se pudo conectar la wallet.");
          }
        };
        slot.append(btn);
      }

      $("[data-action='reg-skip']", view).onclick = async () => {
        view.innerHTML = tpl(t.connecting, { provider: "tu cuenta N0Loss" });
        try {
          const ok = await createAndLink(createEmbeddedSmartAccount(form.email));
          if (ok) showReg(3);
        } catch (err) {
          await showReg(2);
          flashError(view, err.message || "No se pudo crear la wallet.");
        }
      };
    }

    /* ----- Paso 3: cuenta creada ----- */
    if (step === 3) {
      const { DEMO_WALLET } = await import("../../utils/constants.js");
      view.innerHTML = tpl(t.reg3, {
        wallet: shortAddr(form.wallet || DEMO_WALLET),
      });
      $("[data-action='reg-finish']", view).onclick = enter;
    }
  };

  showLogin();
}

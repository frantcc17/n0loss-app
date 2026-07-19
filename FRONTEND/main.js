/* ============================================================
   main.js — Punto de entrada de la aplicación
   ============================================================ */
import App from "./App.js";
import { $ } from "./utils/helpers.js";

document.addEventListener("DOMContentLoaded", () => {
  App($("#app"));
});

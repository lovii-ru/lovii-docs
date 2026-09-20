// lv_eslint.mjs — eslint 9 flat-config для классических скриптов lovii-demo.
// Globals синтезируются из top-level деклараций всех js/*.js (архитектура демо:
// классические <script> в одном window-скоупе, поэтому имена «протекают» между
// файлами легально).
//
// Запуск из корня демо:  npx eslint --config /путь/к/lv_eslint.mjs js/*.js sw.js
// Выход: 0 ошибок — чисто; найденное — чинить в рамках SZ-062 (фаза 1/5).
// NB: no-redeclare выключен — синтезированные глобалы пересекаются с легальными
// own-декларациями файлов; межфайловые дубли ловит lv_collisions.py, а
// внутрифайловые повторные let/const — node --check (SyntaxError).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const globals = {
  window: "readonly", document: "readonly", navigator: "readonly",
  location: "readonly", history: "readonly", localStorage: "readonly",
  sessionStorage: "readonly", console: "readonly", setTimeout: "readonly",
  clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly",
  fetch: "readonly", URL: "readonly", URLSearchParams: "readonly",
  FormData: "readonly", alert: "readonly", confirm: "readonly",
  CustomEvent: "readonly", Event: "readonly", getComputedStyle: "readonly",
  matchMedia: "readonly", caches: "readonly", self: "readonly",
  clients: "readonly", registration: "readonly", skipWaiting: "readonly",
  RegExp: "readonly", Proxy: "readonly", ResizeObserver: "readonly",
  IntersectionObserver: "readonly", MutationObserver: "readonly",
  Notification: "readonly", serviceWorker: "readonly", visualViewport: "readonly",
  Response: "readonly", Request: "readonly", Headers: "readonly",
  performance: "readonly", crypto: "readonly", BroadcastChannel: "readonly",
  atob: "readonly", btoa: "readonly", structuredClone: "readonly",
  queueMicrotask: "readonly", TextEncoder: "readonly", TextDecoder: "readonly",
  PublicKeyCredential: "readonly", Blob: "readonly",
};

const jsDir = join(root, "js");
if (existsSync(jsDir)) {
  const decl = /^(?:let|const|var|class|function|async\s+function)\s+([A-Za-z_$][\w$]*)/gm;
  const files = readdirSync(jsDir).filter((f) => f.endsWith(".js"));
  for (const f of files) {
    const text = readFileSync(join(jsDir, f), "utf8");
    for (const m of text.matchAll(decl)) globals[m[1]] = "readonly";
  }
}

export default [
  {
    files: ["**/js/**/*.js", "**/sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals,
    },
    rules: {
      "no-undef": "error",
      "no-redeclare": "off",
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-fallthrough": "error",
      "no-unreachable": "error",
      "no-use-before-define": ["warn", { functions: false }],
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "eqeqeq": ["warn", "smart"],
    },
  },
];

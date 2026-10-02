#!/usr/bin/env node
/**
 * login-check.mjs — API-логин на staging (тест-профиль) + пробы эндпоинтов.
 * Только чтение. Сохраняет state: token.json / profile.json / probes.json / fixtures.json
 *
 * Запуск (из любой директории):
 *   node .cluster/app-pages-shots/tools/login-check.mjs
 * Повтор без OTP: SKIP_LOGIN=1 node …
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const API = "https://api-staging.lovii.ru/api/v1";
const PHONE = process.env.E2E_TEST_PHONE ?? "+79119287478";
/** Пути резолвятся от расположения скрипта (запуск из любой директории). */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] ?? path.join(HERE, "..", "state"));
fs.mkdirSync(OUT, { recursive: true });

const tokenFile = path.join(OUT, "token.json");
let token = null;
if (process.env.SKIP_LOGIN === "1" && fs.existsSync(tokenFile)) {
  token = JSON.parse(fs.readFileSync(tokenFile, "utf8")).token;
  console.log("using cached token from", tokenFile);
}

async function call(pathname, { method = "GET", body, token: tk } = {}) {
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  if (tk) headers.Authorization = `Bearer ${tk}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${API}/${pathname}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text: text.slice(0, 500) };
  } finally {
    clearTimeout(t);
  }
}

if (!token) {
  const send = await call("auth/send-code", { method: "POST", body: { phone: PHONE, channel: "sms" } });
  console.log("send-code:", send.status, send.text.slice(0, 150));
  const last = await call(`dev/otp/last-code?phone=${encodeURIComponent(PHONE)}`);
  console.log("otp last-code:", last.status, last.text.slice(0, 150));
  const code = last.json?.code;
  if (!code) {
    console.error("Нет OTP-кода — проверить OTP_DEV_BYPASS на staging");
    process.exit(2);
  }
  const conf = await call("auth/confirm", { method: "POST", body: { phone: PHONE, code } });
  console.log("confirm:", conf.status, conf.text.slice(0, 150));
  token = conf.json?.token;
  if (!token) {
    console.error("Нет токена");
    process.exit(2);
  }
  fs.writeFileSync(tokenFile, JSON.stringify({ phone: PHONE, token, at: new Date().toISOString() }, null, 2));
  console.log("token saved ->", tokenFile);
}

// --- profile ---
const prof = await call("profile", { token });
if (prof.status === 200 && prof.json?.data) {
  fs.writeFileSync(path.join(OUT, "profile.json"), JSON.stringify(prof.json.data, null, 2));
}
console.log("profile:", prof.status, JSON.stringify(prof.json?.data ?? prof.text).slice(0, 400));

// --- probes ---
const probes = [
  "profile",
  "profile/consents",
  "orders?per_page=5",
  "carts",
  "profile/addresses",
  "balance",
  "wallet",
  "wallet/transactions?per_page=5",
  "subscription",
  "profile/promo",
  "msp/overview",
  "msp/payment",
  "msp/orders?per_page=5",
  "msp/products?per_page=5",
  "msp/team",
  "representative/profile",
  "representative/points",
  "representative/approvals",
  "representative/income",
  "ambassador/dashboard",
  "ambassador/reps",
  "ambassador/income",
  "ambassador/training",
  "loyalty/rules",
  "loyalty/groups",
  "loyalty/catalog",
  "team/orders",
  "team/products",
];
const results = {};
for (const p of probes) {
  try {
    const r = await call(p, { token });
    results[p] = { status: r.status, peek: r.text.slice(0, 200) };
  } catch (e) {
    results[p] = { status: "ERR", peek: String(e).slice(0, 200) };
  }
  console.log(`GET ${p} -> ${results[p].status}`);
}
fs.writeFileSync(path.join(OUT, "probes.json"), JSON.stringify(results, null, 2));

// --- fixtures ---
const fixtures = {};
try {
  const r = await call("orders?per_page=5", { token });
  fixtures.orderIds = (r.json?.data ?? r.json?.orders ?? []).map((o) => o.id);
} catch {}
try {
  const r = await call("profile/addresses", { token });
  fixtures.addressIds = (r.json?.data ?? []).map((a) => a.id);
} catch {}
try {
  const r = await call("carts", { token });
  fixtures.carts = ((r.json?.carts ?? r.json?.data) ?? []).map((c) => ({
    id: c.id,
    items: (c.items ?? []).length,
    merchant: c.merchant?.name ?? c.merchant_name ?? null,
  }));
} catch {}
try {
  const r = await call("msp/orders?per_page=5", { token });
  fixtures.mspOrderIds = (r.json?.data ?? []).map((o) => o.id);
} catch {}
try {
  const r = await call("stores?lat=59.938784&lon=30.314997&per_page=5");
  fixtures.storeIds = (r.json?.data ?? []).map((s) => s.id);
} catch {}
fs.writeFileSync(path.join(OUT, "fixtures.json"), JSON.stringify(fixtures, null, 2));
console.log("fixtures:", JSON.stringify(fixtures).slice(0, 500));
console.log("DONE");

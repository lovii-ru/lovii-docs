#!/usr/bin/env node
/**
 * gallery-check.mjs — интерактивная проверка gallery.html:
 *  • 60 карточек, фильтры переключают видимость
 *  • все превью грузятся (naturalWidth > 0)
 *  • лайтбокс открывается/закрывается, full-ссылки существуют
 *  • нет console/page errors
 *  • QA-скриншоты: desktop 1440, mobile 420
 *
 * Запуск (из любой директории): node .cluster/app-pages-shots/tools/gallery-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire("/Users/best/LOVII/lovii-app/");
const { chromium } = require("playwright");

/** Пути резолвятся от расположения скрипта (запуск из любой директории). */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const GALLERY = path.join(ROOT, "DELIVERY/gallery.html");
const QA = path.join(ROOT, "qa");
fs.mkdirSync(QA, { recursive: true });

const results = [];
const push = (name, ok, detail) => {
	results.push({ name, ok: !!ok, detail: detail ?? "" });
	console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
};

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));
page.on("console", (m) => {
	if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
});

await page.goto("file://" + GALLERY, { waitUntil: "load" });

// QA-скриншот верха страницы (до любых кликов)
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(QA, "gallery-top.png") });

// 1. карточки/фильтры
const cardCount = await page.locator(".card").count();
push("cards == 60", cardCount === 60, `count=${cardCount}`);
const filterCount = await page.locator(".filter").count();
push("filters >= 8", filterCount >= 8, `count=${filterCount}`);

// 2. превью грузятся
const imgReport = await page.evaluate(async () => {
	const imgs = [...document.querySelectorAll(".card__shot img")];
	imgs.forEach((i) => (i.loading = "eager"));
	await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
	const broken = imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute("src"));
	return { total: imgs.length, broken };
});
push("thumbs loaded", imgReport.broken.length === 0, `total=${imgReport.total} broken=${imgReport.broken.length} ${imgReport.broken.slice(0, 5).join(",")}`);

// 3. full-ссылки существуют на диске
const fullMissing = await page.evaluate(() => {
	const links = [...document.querySelectorAll("a.card__shot[data-full]")];
	return links.map((a) => a.getAttribute("data-full"));
});
let missingFiles = 0;
for (const rel of fullMissing) {
	const abs = path.join(path.dirname(GALLERY), rel);
	if (!fs.existsSync(abs)) missingFiles++;
}
push("full files exist", missingFiles === 0, `links=${fullMissing.length} missing=${missingFiles}`);

// 4. фильтр МСП
await page.click('[data-filter="msp"]');
const mspVisible = await page.locator(".card:not([hidden])").count();
push("filter msp == 9", mspVisible === 9, `visible=${mspVisible}`);
await page.click('[data-filter="all"]');
const allVisible = await page.locator(".card:not([hidden])").count();
push("filter all == 60", allVisible === 60, `visible=${allVisible}`);

// 5. лайтбокс
await page.click(".card__shot");
await page.waitForTimeout(400);
const lbOpen = await page.locator(".lb.is-open").count();
push("lightbox opens", lbOpen === 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const lbClosed = await page.locator(".lb.is-open").count();
push("lightbox closes (Esc)", lbClosed === 0);

// 6. console errors
push("no js errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

// QA-скриншоты
await page.screenshot({ path: path.join(QA, "gallery-desktop.png") });
await page.setViewportSize({ width: 420, height: 900 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(QA, "gallery-mobile.png") });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.evaluate(() => window.scrollTo(0, 1100));
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(QA, "gallery-grid.png") });

await browser.close();

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(QA, "gallery-check.json"), JSON.stringify({ results, failed: failed.length }, null, 2));
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);

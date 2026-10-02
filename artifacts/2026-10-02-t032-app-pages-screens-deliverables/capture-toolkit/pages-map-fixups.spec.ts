/**
 * T-032: точечные пересъёмки экранов, требующих клика/параметров:
 *  APP-P-019 — форма редактирования адреса (прямой заход редиректит на список — открываем кликом);
 *  APP-P-058 — mock-банк с валидными order/payment (без параметров редиректит на заказы).
 *
 * Запуск:
 *   E2E_TARGET=staging E2E_CHANNEL=chrome PAGES_SHOTS_FIXUPS=1 \
 *   PAGES_SHOTS_OUT=/Users/best/LOVII/.cluster/app-pages-shots/raw \
 *   PAGES_SHOTS_STATE=/Users/best/LOVII/.cluster/app-pages-shots/state \
 *   npx playwright test --config=e2e/playwright.config.ts e2e/tests/pages-map-fixups.spec.ts
 */
import fs from "node:fs";
import path from "node:path";
import { test } from "../helpers/network";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
test.skip(process.env.PAGES_SHOTS_FIXUPS !== "1", "Пересъёмка: только при PAGES_SHOTS_FIXUPS=1");

const OUT = path.resolve(process.env.PAGES_SHOTS_OUT ?? "shots/pages-map");
const STATE = path.resolve(process.env.PAGES_SHOTS_STATE ?? "../.cluster/app-pages-shots/state");
const TOKEN_JSON = JSON.parse(fs.readFileSync(path.join(STATE, "token.json"), "utf8")) as { token: string };

const ORDER = Number(process.env.PAGES_FIXUP_ORDER ?? 440);
const PAYMENT = Number(process.env.PAGES_FIXUP_PAYMENT ?? 338);

test("съёмка: фиксы (адрес-форма, mock-банк)", async ({ page }) => {
	test.setTimeout(10 * 60_000);
	const manifest: Record<string, Record<string, unknown>> = {};
	const flush = () => fs.writeFileSync(path.join(OUT, "manifest-fixups.json"), JSON.stringify(manifest, null, 2));
	const variantManifest: Record<string, Record<string, unknown>> = {};
	const flushVariants = () =>
		fs.writeFileSync(path.join(OUT, "manifest-fixups-variant.json"), JSON.stringify(variantManifest, null, 2));

	await page.addInitScript((t: string) => {
		try {
			localStorage.setItem("loviAccessToken", t);
			localStorage.removeItem("loviGuestToken");
		} catch {}
	}, TOKEN_JSON.token);

	// --- APP-P-019 — форма редактирования адреса (клик из списка) ---
	{
		const file = "APP-P-019-address-edit.png";
		const entry: Record<string, unknown> = {
			id: "APP-P-019-address-edit",
			route: "/profile/addresses → клик ✎ → /profile/addresses/edit/:id",
			section: "fixups",
			status: "pending",
			note: "форма открыта кликом из списка (прямой заход редиректит: стор пуст)",
		};
		try {
			await page.goto("/profile/addresses", { waitUntil: "domcontentloaded", timeout: 45_000 });
			await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
			const editBtn = page.locator(".address-item__edit").first();
			await editBtn.waitFor({ state: "visible", timeout: 15_000 });
			await editBtn.click();
			await page.waitForTimeout(2200);
			await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
			await page.waitForTimeout(1200);
			// Закрыть автоподсказки (раскрываются при гидратации): фокус → blur
			await page.locator(".city-search input").click().catch(() => {});
			await page.waitForTimeout(250);
			await page.evaluate(() => {
				const el = document.activeElement;
				if (el instanceof HTMLElement) el.blur();
			});
			await page.waitForTimeout(350);
			await page.locator(".street-search input").click().catch(() => {});
			await page.waitForTimeout(250);
			await page.evaluate(() => {
				const el = document.activeElement;
				if (el instanceof HTMLElement) el.blur();
			});
			await page.waitForTimeout(400);
			await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
			await page.screenshot({ path: path.join(OUT, file), fullPage: true });
			entry.status = "ok";
			entry.finalUrl = page.url();
			entry.file = file;
			entry.bytes = fs.statSync(path.join(OUT, file)).size;
		} catch (e) {
			entry.status = `error: ${String(e).slice(0, 200)}`;
		}
		manifest["APP-P-019-address-edit"] = entry;
		flush();
		console.log("[fixups] 019:", JSON.stringify(entry));
	}

	// --- APP-P-019 (вариант as-is: автоподсказки раскрыты при входе) ---
	{
		const file = "APP-P-019-address-edit.as-is.png";
		const entry: Record<string, unknown> = {
			id: "APP-P-019-address-edit",
			route: "/profile/addresses → клик ✎ (сразу после входа)",
			section: "fixups",
			status: "pending",
			note: "as-is: автоподсказки города/улицы раскрываются при входе (гидратация запускает саджест)",
		};
		try {
			await page.goto("/profile/addresses", { waitUntil: "domcontentloaded", timeout: 45_000 });
			await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
			await page.locator(".address-item__edit").first().waitFor({ state: "visible", timeout: 15_000 });
			await page.locator(".address-item__edit").first().click();
			await page.waitForTimeout(3000);
			await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
			await page.waitForTimeout(1000);
			await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
			await page.screenshot({ path: path.join(OUT, file), fullPage: true });
			entry.status = "ok";
			entry.finalUrl = page.url();
			entry.file = file;
			entry.bytes = fs.statSync(path.join(OUT, file)).size;
		} catch (e) {
			entry.status = `error: ${String(e).slice(0, 200)}`;
		}
		variantManifest["APP-P-019-address-edit"] = entry;
		flushVariants();
		console.log("[fixups] 019 as-is:", JSON.stringify(entry));
	}

	// --- APP-P-058 — mock-банк с валидными параметрами ---
	{
		const file = "APP-P-058-fake-terminal.png";
		const entry: Record<string, unknown> = {
			id: "APP-P-058-fake-terminal",
			route: `/payment/fake?order=${ORDER}&payment=${PAYMENT}`,
			section: "fixups",
			status: "pending",
			note: "mock-банк (dev/staging): тестовая платёжная форма",
		};
		try {
			await page.goto(`/payment/fake?order=${ORDER}&payment=${PAYMENT}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
			await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
			await page.waitForTimeout(2800);
			await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
			await page.screenshot({ path: path.join(OUT, file), fullPage: true });
			entry.status = "ok";
			entry.finalUrl = page.url();
			entry.file = file;
			entry.bytes = fs.statSync(path.join(OUT, file)).size;
		} catch (e) {
			entry.status = `error: ${String(e).slice(0, 200)}`;
		}
		manifest["APP-P-058-fake-terminal"] = entry;
		flush();
		console.log("[fixups] 058:", JSON.stringify(entry));
	}

	// --- APP-P-046 (вариант: вкладка «История» с заказами) ---
	{
		const file = "APP-P-046-msp-orders.history.png";
		const entry: Record<string, unknown> = {
			id: "APP-P-046-msp-orders",
			route: "/cabinet/msp/orders → вкладка «История»",
			section: "fixups",
			status: "pending",
			note: "вариант: история заказов точки (основной кадр — вкладка «Активные», пусто)",
		};
		try {
			await page.goto("/cabinet/msp/orders", { waitUntil: "domcontentloaded", timeout: 45_000 });
			await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
			await page.waitForTimeout(2200);
			await page.locator('[data-testid="msp-orders-tab-history"]').click();
			await page.waitForTimeout(1800);
			await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
			await page.waitForTimeout(800);
			await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
			await page.screenshot({ path: path.join(OUT, file), fullPage: true });
			entry.status = "ok";
			entry.finalUrl = page.url();
			entry.file = file;
			entry.bytes = fs.statSync(path.join(OUT, file)).size;
		} catch (e) {
			entry.status = `error: ${String(e).slice(0, 200)}`;
		}
		variantManifest["APP-P-046-msp-orders"] = entry;
		flushVariants();
		console.log("[fixups] 046 history:", JSON.stringify(entry));
	}

	// --- APP-P-053 (вариант: вкладка «История» с заказами) ---
	{
		const file = "APP-P-053-team-orders.history.png";
		const entry: Record<string, unknown> = {
			id: "APP-P-053-team-orders",
			route: "/cabinet/team → вкладка «История»",
			section: "fixups",
			status: "pending",
			note: "вариант: история заказов (основной кадр — вкладка «Активные», пусто)",
		};
		try {
			await page.goto("/cabinet/team", { waitUntil: "domcontentloaded", timeout: 45_000 });
			await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
			await page.waitForTimeout(2600);
			await page.locator('[data-testid="team-orders-tab-history"]').click();
			await page.waitForTimeout(1800);
			await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
			await page.waitForTimeout(800);
			await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
			await page.screenshot({ path: path.join(OUT, file), fullPage: true });
			entry.status = "ok";
			entry.finalUrl = page.url();
			entry.file = file;
			entry.bytes = fs.statSync(path.join(OUT, file)).size;
		} catch (e) {
			entry.status = `error: ${String(e).slice(0, 200)}`;
		}
		variantManifest["APP-P-053-team-orders"] = entry;
		flushVariants();
		console.log("[fixups] 053 history:", JSON.stringify(entry));
	}
});

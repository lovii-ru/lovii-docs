/**
 * T-032 APP_PAGES: скрины всех страниц приложения (60 карточек APP-P-001…060).
 *
 * Запуск (staging):
 *   cd lovii-app
 *   E2E_TARGET=staging PAGES_SHOTS=1 \
 *   PAGES_SHOTS_OUT=/Users/best/LOVII/.cluster/app-pages-shots/raw \
 *   PAGES_SHOTS_STATE=/Users/best/LOVII/.cluster/app-pages-shots/state \
 *   npx playwright test --config=e2e/playwright.config.ts e2e/tests/pages-map-shots.spec.ts
 *
 * Секции (можно гонять по одной): -g 'съёмка: гость' | 'съёмка: покупатель' |
 *   'съёмка: представитель' | 'съёмка: платформа' | 'съёмка: амбассадор' |
 *   'съёмка: МСП' | 'съёмка: команда'
 *
 * Env: PAGES_SHOTS_RESUME=1 — не переснимать существующие файлы;
 *      PAGES_SHOTS_SETTLE=ms — базовый «отстой» после загрузки (по умолчанию 2600);
 *      PAGES_SHOTS_TOKEN — готовый токен (иначе state/token.json или OTP-логин);
 *      PAGES_SHOTS_ONLY=APP-P-046-msp-orders[,APP-P-019-address-edit] — точечно только эти экраны.
 *
 * Токен: тест-профиль владельца (user 51) — роли representative/ambassador/msp/founder.
 * Манифест: manifest-<section>.json в PAGES_SHOTS_OUT; файлы — APP-P-XXX-<slug>.png.
 * Временная спека для съёмки; в репозиторий не коммитится (см. delivery/README).
 */
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test } from "../helpers/network";
import { loginWithOtp } from "../helpers/api";
import { apiUrl } from "../helpers/targets";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
test.skip(process.env.PAGES_SHOTS !== "1", "Съёмка страниц: только при PAGES_SHOTS=1");

const OUT = path.resolve(process.env.PAGES_SHOTS_OUT ?? "shots/pages-map");
fs.mkdirSync(OUT, { recursive: true });
const SETTLE = Number(process.env.PAGES_SHOTS_SETTLE ?? 2600);
const RESUME = process.env.PAGES_SHOTS_RESUME === "1";
/** Точечная пересъёмка: PAGES_SHOTS_ONLY=APP-P-046-msp-orders[,APP-P-…] — только эти экраны. */
const ONLY = (process.env.PAGES_SHOTS_ONLY ?? "")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);
const STATE = path.resolve(process.env.PAGES_SHOTS_STATE ?? "../.cluster/app-pages-shots/state");
const TOKEN_FILE = path.join(STATE, "token.json");
const PHONE = process.env.E2E_TEST_PHONE ?? "+79119287478";

interface Entry {
	id: string;
	route: string;
	section: string;
	status: string;
	finalUrl?: string;
	httpStatus?: number;
	title?: string;
	file?: string;
	bytes?: number;
	ms?: number;
	note?: string;
}
type Manifest = Record<string, Entry>;

interface Fixtures {
	storeBranchId?: number;
	storeOfferId?: number;
	cartId?: number;
	orderId?: number;
	addressId?: number;
	mspOrderId?: number;
}

const FALLBACK: Fixtures = { storeBranchId: 196, storeOfferId: 4851020, cartId: 205, orderId: 440, addressId: 106, mspOrderId: 441 };
let fixtureCache: Fixtures | null = null;

function log(...a: unknown[]) {
	console.log("[pages-map]", ...a);
}

async function apiGet(pathname: string, token?: string) {
	const res = await fetch(`${apiUrl()}/${pathname}`, {
		headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
	});
	const json = await res.json().catch(() => null);
	return { status: res.status, json };
}

async function getToken(): Promise<string> {
	if (process.env.PAGES_SHOTS_TOKEN) return process.env.PAGES_SHOTS_TOKEN;
	try {
		const cached = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as { token?: string };
		if (cached?.token) {
			// Проверяем живость токена
			const probe = await apiGet("profile", cached.token);
			if (probe.status === 200) {
				log("token: cached OK");
				return cached.token;
			}
		}
	} catch {}
	const token = await loginWithOtp(PHONE);
	fs.writeFileSync(TOKEN_FILE, JSON.stringify({ phone: PHONE, token, at: new Date().toISOString() }, null, 2));
	log("token: fresh via OTP");
	return token;
}

async function loadFixtures(token?: string): Promise<Fixtures> {
	if (fixtureCache) return fixtureCache;
	const f: Fixtures = {};
	// Точка с товарами (для 004/005): открытые — в приоритете.
	try {
		const stores = await apiGet("stores?lat=59.938784&lon=30.314997&per_page=10");
		const list = (stores.json as { data?: Array<{ id: number; availability?: { is_open?: boolean } }> })?.data ?? [];
		const ordered = [...list.filter((s) => s.availability?.is_open), ...list];
		for (const s of ordered.slice(0, 8)) {
			const sf = await apiGet(`storefront?branch_id=${s.id}&per_page=5`);
			const offers = (sf.json as { data?: Array<{ id: number }> })?.data ?? [];
			if (offers.length > 0) {
				f.storeBranchId = s.id;
				f.storeOfferId = offers[0].id;
				break;
			}
		}
	} catch {}
	if (token) {
		try {
			const r = await apiGet("carts", token);
			const carts = ((r.json as { carts?: unknown[]; data?: unknown[] })?.carts ?? (r.json as { data?: unknown[] })?.data ?? []) as Array<{ id: number; items?: unknown[] }>;
			const withItems = carts.filter((c) => (c.items ?? []).length > 0);
			f.cartId = (withItems[0] ?? carts[0])?.id;
		} catch {}
		try {
			const r = await apiGet("orders?per_page=5", token);
			f.orderId = ((r.json as { data?: Array<{ id: number }> })?.data ?? [])[0]?.id;
		} catch {}
		try {
			const r = await apiGet("profile/addresses", token);
			f.addressId = ((r.json as { data?: Array<{ id: number }> })?.data ?? [])[0]?.id;
		} catch {}
		try {
			const r = await apiGet("msp/orders?scope=history", token);
			f.mspOrderId = ((r.json as { data?: Array<{ id: number }> })?.data ?? [])[0]?.id;
		} catch {}
	}
	fixtureCache = { ...FALLBACK, ...f };
	log("fixtures:", JSON.stringify(fixtureCache));
	return fixtureCache;
}

interface PageDef {
	id: string;
	route: (f: Fixtures) => string;
	settle?: number;
	note?: string;
	fileName?: string;
	/** Ожидаем уход на другой URL (редирект-карточка) — фиксируем как note, не ошибку */
	expectAny?: boolean;
}

function flush(manifest: Manifest, section: string) {
	fs.writeFileSync(path.join(OUT, `manifest-${section}.json`), JSON.stringify(manifest, null, 2));
}

async function capture(page: Page, manifest: Manifest, def: PageDef, section: string, f: Fixtures) {
	const fileName = def.fileName ?? `${def.id}.png`;
	const file = path.join(OUT, fileName);
	const started = Date.now();
	const entry: Entry = { id: def.id, route: "", section, status: "pending" };
	if (def.note) entry.note = def.note;
	manifest[def.id] = entry;

	if (RESUME && fs.existsSync(file)) {
		entry.status = "skipped-existing";
		entry.file = fileName;
		entry.bytes = fs.statSync(file).size;
		flush(manifest, section);
		log(def.id, "skip (exists)");
		return;
	}

	try {
		const route = def.route(f);
		entry.route = route;
		const resp = await page
			.goto(route, { waitUntil: "domcontentloaded", timeout: 45_000 })
			.catch((e: Error) => {
				log(def.id, "goto:", e.message.slice(0, 120));
				return null;
			});
		entry.httpStatus = resp?.status();
		await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
		await page.waitForTimeout(def.settle ?? SETTLE);
		await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
		await page.waitForTimeout(120);
		await page.screenshot({ path: file, fullPage: true });
		const st = fs.statSync(file);
		entry.finalUrl = page.url();
		entry.title = await page.title().catch(() => "");
		entry.file = fileName;
		entry.bytes = st.size;
		entry.status = "ok";
	} catch (e) {
		entry.status = `error: ${String((e as Error).message).slice(0, 180)}`;
		try {
			entry.finalUrl = page.url();
		} catch {}
	}
	entry.ms = Date.now() - started;
	flush(manifest, section);
	log(def.id, entry.status, entry.finalUrl ?? "", entry.bytes ?? "");
}

async function runList(page: Page, manifest: Manifest, defs: PageDef[], section: string, f: Fixtures) {
	for (const def of defs) {
		if (ONLY.length > 0 && !ONLY.includes(def.id)) continue;
		await capture(page, manifest, def, section, f);
	}
}

async function setToken(page: Page, token: string) {
	await page.addInitScript((t: string) => {
		try {
			localStorage.setItem("loviAccessToken", t);
			localStorage.removeItem("loviGuestToken");
		} catch {}
	}, token);
}

// ---------- Секции ----------

test.describe("съёмка карты страниц (T-032)", () => {
	test("съёмка: гость", async ({ page }) => {
		test.setTimeout(15 * 60_000);
		const manifest: Manifest = {};
		const f = await loadFixtures();
		const defs: PageDef[] = [
			{ id: "APP-P-001-home", route: () => "/", settle: 3800 },
			{ id: "APP-P-002-popular", route: () => "/popular", settle: 3000 },
			{ id: "APP-P-003-stores", route: () => "/stores", settle: 3200 },
			{ id: "APP-P-004-store", route: (x) => `/stores/${x.storeBranchId}`, settle: 3500 },
			{ id: "APP-P-005-product", route: (x) => `/stores/${x.storeBranchId}/product/${x.storeOfferId}`, settle: 3000 },
			{ id: "APP-P-006-cart", route: () => "/cart", fileName: "APP-P-006-cart.guest.png", note: "гостевая корзина (без товаров)" },
			{ id: "APP-P-007-cart-order", route: (x) => `/cart/${x.cartId}`, fileName: "APP-P-007-cart-order.guest.png", note: "гость: карточка чужой корзины — ожидаем гейт/редирект" },
			{ id: "APP-P-008-profile", route: () => "/profile", fileName: "APP-P-008-profile.guest.png", note: "гостевой экран входа" },
			{ id: "APP-P-059-auth-by-binding", route: () => "/auth/by-binding", note: "magic link без токена — состояние страницы" },
			{ id: "APP-P-060-not-found", route: () => "/this-page-does-not-exist-404" },
		];
		await runList(page, manifest, defs, "guest", f);
	});

	test("съёмка: покупатель", async ({ page }) => {
		test.setTimeout(25 * 60_000);
		const manifest: Manifest = {};
		const token = await getToken();
		const f = await loadFixtures(token);
		await setToken(page, token);
		const defs: PageDef[] = [
			{ id: "APP-P-006-cart", route: () => "/cart", settle: 3200, note: "авторизованная корзина — приоритетный скрин" },
			{ id: "APP-P-007-cart-order", route: (x) => `/cart/${x.cartId}`, settle: 3500, note: "оформление заказа" },
			{ id: "APP-P-008-profile", route: () => "/profile", settle: 3200, note: "профиль авторизованного — хаб" },
			{ id: "APP-P-009-wallet", route: () => "/profile/wallet", settle: 3500 },
			{ id: "APP-P-010-transfer", route: () => "/profile/wallet/transfer", settle: 3200 },
			{ id: "APP-P-011-balance-redirect", route: () => "/profile/balance", note: "redirect-карточка (removed)" },
			{ id: "APP-P-012-operations-redirect", route: () => "/profile/operations", note: "redirect-карточка (removed)" },
			{ id: "APP-P-013-profile-edit", route: () => "/profile/edit", settle: 3000 },
			{ id: "APP-P-014-email-verify", route: () => "/profile/edit/email/verify", settle: 3000 },
			{ id: "APP-P-015-orders", route: () => "/profile/orders", settle: 3200 },
			{ id: "APP-P-016-order", route: (x) => `/profile/orders/${x.orderId}`, settle: 3200 },
			{ id: "APP-P-017-addresses", route: () => "/profile/addresses", settle: 3000 },
			{ id: "APP-P-018-address-create", route: () => "/profile/addresses/create", settle: 3000 },
			{ id: "APP-P-019-address-edit", route: (x) => `/profile/addresses/edit/${x.addressId}`, settle: 3000 },
			{ id: "APP-P-020-settings", route: () => "/settings", settle: 3200 },
			{ id: "APP-P-021-business-landing", route: () => "/business", settle: 3200 },
			{ id: "APP-P-022-business-apply", route: () => "/business/apply", settle: 3000 },
			{ id: "APP-P-023-business-status", route: () => "/business/status", settle: 3000 },
			{ id: "APP-P-024-business-result", route: () => "/business/result", settle: 3000 },
			{ id: "APP-P-025-mypoint", route: () => "/business/point", note: "redirect-карточка (removed)" },
			{ id: "APP-P-057-payment-result", route: (x) => `/payment/result?order=${x.orderId}`, settle: 3500, note: "страница статуса оплаты заказа" },
			{ id: "APP-P-058-fake-terminal", route: (x) => `/payment/fake?order=${x.orderId}`, settle: 3000, note: "mock-банк (dev/staging)" },
		];
		await runList(page, manifest, defs, "buyer", f);
	});

	test("съёмка: представитель", async ({ page }) => {
		test.setTimeout(15 * 60_000);
		const manifest: Manifest = {};
		const token = await getToken();
		const f = await loadFixtures(token);
		await setToken(page, token);
		const defs: PageDef[] = [
			{ id: "APP-P-026-rep-overview", route: () => "/cabinet/representative", settle: 3500 },
			{ id: "APP-P-027-rep-points", route: () => "/cabinet/representative/points", settle: 3200 },
			{ id: "APP-P-028-rep-approvals", route: () => "/cabinet/representative/approvals", settle: 3200 },
			{ id: "APP-P-029-rep-income", route: () => "/cabinet/representative/income", settle: 3500 },
			{ id: "APP-P-030-rep-profile", route: () => "/cabinet/representative/profile", settle: 3200 },
			{ id: "APP-P-031-rep-chats", route: () => "/cabinet/representative/chats", settle: 3000, note: "заглушка ChatStub (эксперимент)" },
		];
		await runList(page, manifest, defs, "representative", f);
	});

	test("съёмка: платформа", async ({ page }) => {
		test.setTimeout(15 * 60_000);
		const manifest: Manifest = {};
		const token = await getToken();
		const f = await loadFixtures(token);
		await setToken(page, token);
		const defs: PageDef[] = [
			{ id: "APP-P-032-platform", route: () => "/cabinet/platform", settle: 3200, note: "легаси-хаб" },
			{ id: "APP-P-033-owner-overview", route: () => "/cabinet/owner", settle: 3500 },
			{ id: "APP-P-034-owner-finance", route: () => "/cabinet/owner/finance", settle: 3500 },
			{ id: "APP-P-035-owner-structure", route: () => "/cabinet/owner/structure", settle: 3200 },
			{ id: "APP-P-036-investor-growth", route: () => "/cabinet/investor", settle: 3500 },
			{ id: "APP-P-037-investor-points", route: () => "/cabinet/investor/points", settle: 3200 },
			{ id: "APP-P-038-investor-money", route: () => "/cabinet/investor/money", settle: 3200 },
		];
		await runList(page, manifest, defs, "platform", f);
	});

	test("съёмка: амбассадор", async ({ page }) => {
		test.setTimeout(15 * 60_000);
		const manifest: Manifest = {};
		const token = await getToken();
		const f = await loadFixtures(token);
		await setToken(page, token);
		const defs: PageDef[] = [
			{ id: "APP-P-039-amb-overview", route: () => "/cabinet/ambassador", settle: 3500 },
			{ id: "APP-P-040-amb-reps", route: () => "/cabinet/ambassador/reps", settle: 3200 },
			{ id: "APP-P-041-amb-training", route: () => "/cabinet/ambassador/training", settle: 3200 },
			{ id: "APP-P-042-amb-income", route: () => "/cabinet/ambassador/income", settle: 3500 },
			{ id: "APP-P-043-amb-chats", route: () => "/cabinet/ambassador/chats", settle: 3000, note: "заглушка ChatStub (эксперимент)" },
		];
		await runList(page, manifest, defs, "ambassador", f);
	});

	test("съёмка: МСП", async ({ page }) => {
		test.setTimeout(25 * 60_000);
		const manifest: Manifest = {};
		const token = await getToken();
		const f = await loadFixtures(token);
		await setToken(page, token);
		const defs: PageDef[] = [
			{ id: "APP-P-044-msp-overview", route: () => "/cabinet/msp", settle: 4000 },
			{ id: "APP-P-045-msp-payment", route: () => "/cabinet/msp/payment", settle: 3200 },
			{ id: "APP-P-046-msp-orders", route: () => "/cabinet/msp/orders", settle: 3500 },
			{ id: "APP-P-047-msp-order-detail", route: (x) => `/cabinet/msp/orders/${x.mspOrderId}`, settle: 3500 },
			{ id: "APP-P-048-msp-products", route: () => "/cabinet/msp/products", settle: 3500 },
			{ id: "APP-P-049-msp-loyalty", route: () => "/cabinet/msp/loyalty", settle: 4200 },
			{ id: "APP-P-050-msp-branch-settings", route: () => "/cabinet/msp/settings", settle: 3500 },
			{ id: "APP-P-051-msp-team", route: () => "/cabinet/msp/team", settle: 3500 },
			{ id: "APP-P-052-msp-starter", route: () => "/cabinet/msp/starter", settle: 3500 },
		];
		await runList(page, manifest, defs, "msp", f);
	});

	test("съёмка: команда", async ({ page }) => {
		test.setTimeout(15 * 60_000);
		const manifest: Manifest = {};
		const token = await getToken();
		const f = await loadFixtures(token);
		await setToken(page, token);
		const defs: PageDef[] = [
			{ id: "APP-P-053-team-orders", route: () => "/cabinet/team", settle: 3500 },
			{ id: "APP-P-054-team-order-detail", route: (x) => `/cabinet/team/orders/${x.mspOrderId}`, settle: 3500 },
			{ id: "APP-P-055-team-products", route: () => "/cabinet/team/products", settle: 3500 },
			{ id: "APP-P-056-team-team", route: () => "/cabinet/team/team", settle: 3500 },
		];
		await runList(page, manifest, defs, "team", f);
	});
});

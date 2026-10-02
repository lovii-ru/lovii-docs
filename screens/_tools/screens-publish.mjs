#!/usr/bin/env node
/**
 * screens-publish.mjs — публикация новой версии скринов в живой каталог
 * lovii_docs/screens/ (append-only): раскладывает кадры по экранам
 * (папки APP-P-NNN-slug), кладёт meta.json, дописывает журнал _VERSIONS.md.
 * Старые версии не удаляются и не перезаписываются.
 *
 * Запуск (из любой директории; пример — из корня воркспейса):
 *   node .cluster/app-pages-shots/tools/screens-publish.mjs \
 *     --from  .cluster/app-pages-shots/raw \
 *     --to    lovii_docs/screens \
 *     --version auto            # или v2-2026-10-05
 *     [--only APP-P-046-msp-orders,APP-P-019-address-edit]
 *     [--note "правка T-0XX: …"] [--stand …] [--slice …] [--profile …]
 *
 * Источник данных: manifest.json (или manifest-*.json) в каталоге --from.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
	const i = process.argv.indexOf(`--${name}`);
	return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const FROM = path.resolve(arg("from", path.join(HERE, "..", "raw")));
/** По умолчанию — родительская папка `_tools` (т.е. сам каталог screens/). */
const TO = path.resolve(arg("to", path.join(HERE, "..")));
const VERSION = arg("version", "auto");
const ONLY = (arg("only", "") || "")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);
const NOTE = arg("note", "");
const STAND = arg("stand", "app-staging.lovii.ru");
const SLICE = arg("slice", "cf33ef2 (origin/staging)");
const PROFILE = arg("profile", "+79119287478 (user 51)");
const TOOL = "Playwright 390×844 @2x, fullPage";

function loadManifest() {
	const merged = path.join(FROM, "manifest.json");
	if (fs.existsSync(merged)) return JSON.parse(fs.readFileSync(merged, "utf8"));
	const out = {};
	for (const f of fs.readdirSync(FROM).filter((x) => x.startsWith("manifest-") && x.endsWith(".json"))) {
		const data = JSON.parse(fs.readFileSync(path.join(FROM, f), "utf8"));
		for (const [id, e] of Object.entries(data)) {
			const isVariant = /\.(guest|as-is|history)\./.test(e.file ?? "");
			if (!out[id]) out[id] = { primary: null, variants: [] };
			if (isVariant) out[id].variants.push(e);
			else out[id].primary = e;
		}
	}
	return out;
}

function loadTitles() {
	try {
		const cov = JSON.parse(fs.readFileSync(path.join(HERE, "..", "coverage.json"), "utf8"));
		return Object.fromEntries((cov.rows ?? []).map((r) => [r.id, r.title]));
	} catch {
		return {};
	}
}

const titles = loadTitles();
const manifest = loadManifest();
let keys = Object.keys(manifest).sort();
if (ONLY.length) keys = keys.filter((k) => ONLY.some((o) => k === o || k.startsWith(o) || k.startsWith(`${o}-`)));
if (!keys.length) {
	console.error("Нечего публиковать: 0 экранов после фильтра");
	process.exit(2);
}

fs.mkdirSync(TO, { recursive: true });
const VERSIONS_MD = path.join(TO, "_VERSIONS.md");
if (!fs.existsSync(VERSIONS_MD)) {
	fs.writeFileSync(
		VERSIONS_MD,
		"# _VERSIONS.md — журнал версий скриншотов экранов\n\n" +
			"> Append-only: строки не удаляются; новая версия = новая папка `vN-YYYY-MM-DD/` + строка в конце этой таблицы.\n" +
			"> Правила и инструкция — `README.md` каталога.\n\n" +
			"| Дата | Экран | Версия | Каталог | Комментарий |\n|---|---|---|---|---|\n",
	);
}

const stateDesc = {
	"default.png": "основной кадр",
	"guest.png": "гостевой вид",
	"as-is.png": "как есть (сразу после входа)",
	"history.png": "вкладка «История»",
};

const today = new Date().toISOString().slice(0, 10);
const rows = [];
let published = 0;

for (const key of keys) {
	const rec = manifest[key];
	const primary = rec?.primary;
	if (!primary?.file || !fs.existsSync(path.join(FROM, primary.file))) {
		console.warn(`SKIP ${key}: нет primary-файла (${primary?.file ?? "—"})`);
		continue;
	}
	const screenDir = path.join(TO, key);
	const existing = fs.existsSync(screenDir) ? fs.readdirSync(screenDir).filter((d) => /^v\d+-/.test(d)) : [];
	let version = VERSION;
	if (version === "auto") {
		const maxN = existing.reduce((m, d) => Math.max(m, Number(/(\d+)/.exec(d.slice(1))?.[1] ?? 0)), 0);
		version = `v${maxN + 1}-${today}`;
	}
	const versionDir = path.join(screenDir, version);
	if (fs.existsSync(versionDir)) {
		console.warn(`SKIP ${key}: ${version} уже существует (ничего не перезаписываем)`);
		continue;
	}
	fs.mkdirSync(versionDir, { recursive: true });

	const filesToCopy = [[primary.file, "default.png"]];
	for (const v of rec.variants ?? []) {
		if (!v.file || !fs.existsSync(path.join(FROM, v.file))) continue;
		const base = `${key}.`;
		let name = "";
		if (v.file.startsWith(base) && v.file.endsWith(".png")) name = `${v.file.slice(base.length, -4)}.png`;
		if (!name) name = path.basename(v.file);
		filesToCopy.push([v.file, name]);
	}
	const states = {};
	for (const [src, name] of filesToCopy) {
		fs.copyFileSync(path.join(FROM, src), path.join(versionDir, name));
		states[name] = stateDesc[name] ?? (name === "default.png" ? "основной кадр" : "(вариант состояния)");
	}

	const date = /(\d{4}-\d{2}-\d{2})/.exec(version)?.[1] ?? today;
	const short = /^APP-P-\d+/.exec(key)?.[0];
	const meta = {
		id: key,
		title: titles[short] ?? key,
		version,
		date,
		stand: STAND,
		app_slice: SLICE,
		profile: PROFILE,
		tool: TOOL,
		route: primary.route ?? null,
		final_url: primary.finalUrl ?? null,
		states,
		notes: [primary.note, NOTE].filter(Boolean).join(" · ") || null,
	};
	fs.writeFileSync(path.join(versionDir, "meta.json"), JSON.stringify(meta, null, 2));

	rows.push(`| ${date} | ${key} | ${version} | \`${key}/${version}/\` | ${NOTE || primary.note || "—"} |`);
	published++;
}

fs.appendFileSync(VERSIONS_MD, `${rows.join("\n")}\n`);
console.log(`Опубликовано: ${published} экранов → ${TO}`);
console.log(rows.join("\n"));

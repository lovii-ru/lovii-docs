#!/usr/bin/env node
/**
 * merge-and-thumbs.mjs — сборка результатов съёмки:
 *  1) merge manifest-*.json → manifest.json (primary/variants логика)
 *  2) веб-превью в thumbs/ (sips: ширина 420px, JPEG q80)
 *  3) coverage.json — сводка по 60 карточкам для галереи и отчёта
 *
 * Запуск (из любой директории): node .cluster/app-pages-shots/tools/merge-and-thumbs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Пути резолвятся от расположения скрипта (запуск из любой директории). */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const RAW = path.join(ROOT, "raw");
const THUMBS = path.join(ROOT, "thumbs");
fs.mkdirSync(THUMBS, { recursive: true });

// --- 1. merge manifests ---
const files = fs.readdirSync(RAW).filter((f) => f.startsWith("manifest-") && f.endsWith(".json"));
const merged = {};
for (const f of files) {
	const section = f.replace(/^manifest-/, "").replace(/\.json$/, "");
	const data = JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8"));
	for (const [id, entry] of Object.entries(data)) {
		const e = { ...entry, section };
		if (e.status === "skipped-existing" && e.file && fs.existsSync(path.join(RAW, e.file))) {
			e.status = "ok";
			e.note = [e.note, "файл снят ранее (resume)"].filter(Boolean).join("; ");
		}
		if (e.file && !fs.existsSync(path.join(RAW, e.file))) {
			e.status = "missing-file";
		}
		const isVariant = /\.(guest|as-is|history)\./.test(entry.file ?? "");
		const key = e.id;
		if (!merged[key]) {
			merged[key] = { primary: null, variants: [] };
		}
		if (isVariant) {
			merged[key].variants.push(e);
		} else {
			// приоритет у не-вариантов; если таких несколько — последний победил (пересъёмка)
			merged[key].primary = e;
		}
	}
}
// если primary нет (только guest) — primary = первый variant
for (const k of Object.keys(merged)) {
	if (!merged[k].primary && merged[k].variants.length) {
		merged[k].primary = merged[k].variants[0];
	}
}
fs.writeFileSync(path.join(RAW, "manifest.json"), JSON.stringify(merged, null, 2));
console.log("manifest.json:", Object.keys(merged).length, "записей");

// --- 2. thumbs ---
function shootThumbs() {
	const pngs = fs.readdirSync(RAW).filter((f) => f.endsWith(".png"));
	let done = 0;
	for (const p of pngs) {
		const src = path.join(RAW, p);
		const dst = path.join(THUMBS, p.replace(/\.png$/, ".jpg"));
		if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(src).mtimeMs) continue;
		try {
			execFileSync("sips", ["--resampleWidth", "420", "-s", "format", "jpeg", "-s", "formatOptions", "80", src, "--out", dst], { stdio: "ignore" });
			done++;
		} catch (e) {
			console.warn("thumb fail:", p, String(e).slice(0, 120));
		}
	}
	console.log("thumbs сделано:", done, "| всего:", pngs.length);
}
shootThumbs();

// --- 3. coverage ---
const cards = [];
const indexPath = "/Users/best/LOVII/lovii_docs/canon/APP_PAGES/_INDEX.md";
const idx = fs.readFileSync(indexPath, "utf8");
for (const line of idx.split("\n")) {
	const m = line.match(/^\| (APP-P-\d{3}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/);
	if (m) cards.push({ id: m[1], title: m[2].trim(), type: m[3].trim(), route: m[4].trim() });
}
const manifestKeys = Object.keys(merged);
const rows = cards.map((c) => {
	const key = manifestKeys.find((k) => k === c.id || k.startsWith(`${c.id}-`));
	const r = key ? merged[key] : undefined;
	const p = r?.primary;
	return {
		...c,
		manifestKey: key ?? null,
		status: p?.status ?? "no-shot",
		file: p?.file ?? null,
		finalUrl: p?.finalUrl ?? null,
		bytes: p?.bytes ?? null,
		note: p?.note ?? null,
		variants: (r?.variants ?? []).map((v) => v.file).filter(Boolean),
	};
});
const stats = {
	total: rows.length,
	withShot: rows.filter((r) => r.file).length,
	ok: rows.filter((r) => r.status === "ok").length,
	redirectCards: rows.filter((r) => (r.note ?? "").startsWith("redirect")).length,
	missing: rows.filter((r) => !r.file).map((r) => r.id),
};
fs.writeFileSync(path.join(ROOT, "coverage.json"), JSON.stringify({ stats, rows }, null, 2));
console.log("coverage:", JSON.stringify(stats));
console.log("DONE");

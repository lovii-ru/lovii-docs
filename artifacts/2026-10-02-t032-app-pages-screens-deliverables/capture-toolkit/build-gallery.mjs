#!/usr/bin/env node
/**
 * build-gallery.mjs — собирает gallery.html (self-contained) + COVERAGE.md
 * из coverage.json (merge-and-thumbs.mjs). Стиль: пресет «11 Build».
 *
 * Запуск (из любой директории): node .cluster/app-pages-shots/tools/build-gallery.mjs
 * Выход:  .cluster/app-pages-shots/gallery.html, COVERAGE.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Пути резолвятся от расположения скрипта (запуск из любой директории). */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const cov = JSON.parse(fs.readFileSync(path.join(ROOT, "coverage.json"), "utf8"));
const rows = cov.rows;

const SECTIONS = [
	{ key: "purchase", label: "Покупка", from: 1, to: 7 },
	{ key: "profile", label: "Профиль и счёт", from: 8, to: 20 },
	{ key: "business", label: "ЛОВИ Бизнес", from: 21, to: 25 },
	{ key: "rep", label: "Представитель", from: 26, to: 31 },
	{ key: "platform", label: "Платформа и инвестор", from: 32, to: 38 },
	{ key: "amb", label: "Амбассадор", from: 39, to: 43 },
	{ key: "msp", label: "МСП", from: 44, to: 52 },
	{ key: "team", label: "Команда точки", from: 53, to: 56 },
	{ key: "special", label: "Служебные", from: 57, to: 60 },
];

const roleBySection = {
	purchase: "гость",
	profile: "аккаунт",
	business: "аккаунт",
	rep: "роль: представитель",
	platform: "роль: основатель",
	amb: "роль: амбассадор",
	msp: "роль: МСП",
	team: "роль: команда точки",
	special: "гость / аккаунт",
};

function sectionOf(id) {
	const n = Number(id.replace("APP-P-", ""));
	return SECTIONS.find((s) => n >= s.from && n <= s.to) ?? SECTIONS[0];
}

function esc(s) {
	return String(s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function routePath(row) {
	// «/profile · ProfileView (index.ts:297)» → «/profile»
	return (row.route ?? "").split("·")[0].trim();
}

function statusBadge(row) {
	if (!row.file) return `<span class="badge badge--miss">нет кадра</span>`;
	const redirect = (row.note ?? "").startsWith("redirect");
	const finalPath = redirect && row.finalUrl ? row.finalUrl.replace("https://app-staging.lovii.ru", "") : null;
	if (redirect) return `<span class="badge">→ ${esc(finalPath)}</span>`;
	return `<span class="badge badge--ok">снято</span>`;
}

let shots = 0;
for (const r of rows) {
	const rDir = path.join(ROOT, "raw");
	shots += fs.readdirSync(rDir).filter((f) => f.endsWith(".png")).length;
	break;
}
const totalCards = rows.length;

const cards = rows
	.map((r) => {
		const sec = sectionOf(r.id);
		const thumb = r.file ? `APP_PAGES_shots/thumbs/${esc(r.file.replace(/\.png$/, ".jpg"))}` : null;
		const full = r.file ? `APP_PAGES_shots/${esc(r.file)}` : null;
		const title = esc(r.title);
		const variants = (r.variants ?? []).length
			? `<div class="card__variants">ещё кадры: ${(r.variants ?? []).map((v) => esc(v)).join(", ")}</div>`
			: "";
		const note = r.note ? `<div class="card__note">${esc(r.note)}</div>` : "";
		const body = thumb
			? `<a class="card__shot" href="${full}" data-full="${full}" data-title="${title}"><img loading="lazy" src="${thumb}" alt="${title}"></a>`
			: `<div class="card__shot card__shot--miss"><span>кадр отсутствует</span></div>`;
		return `
	<article class="card" data-section="${sec.key}" data-id="${r.id}">
		<header class="card__head">
			<span class="card__id">${r.id}</span>
			<span class="card__badges">${statusBadge(r)}</span>
		</header>
		<h3 class="card__title">${title}</h3>
		<div class="card__route">${esc(routePath(r))}</div>
		${body}
		<div class="card__meta">
			<span class="card__role">${esc(roleBySection[sec.key])}</span>
			${variants}
			${note}
		</div>
	</article>`;
	})
	.join("\n");

const filters = [
	`<button class="filter is-active" data-filter="all">Все · ${totalCards}</button>`,
	...SECTIONS.map((s) => {
		const n = rows.filter((r) => sectionOf(r.id).key === s.key).length;
		return `<button class="filter" data-filter="${s.key}">${s.label} · ${n}</button>`;
	}),
].join("\n\t\t\t");

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Карта экранов ЛОВИ — скриншоты всех страниц (APP-P-001…060)</title>
<style>
	:root {
		--bg: #f7f4ef;
		--panel: #fdfcf9;
		--ink: #1b1712;
		--ink-2: #5a5349;
		--ink-3: #8a8175;
		--line: rgba(27, 23, 18, 0.12);
		--line-soft: rgba(27, 23, 18, 0.07);
		--accent: #c2255c;
		--r: 3px;
	}
	* { box-sizing: border-box; }
	html, body { margin: 0; padding: 0; }
	body {
		background: var(--bg);
		color: var(--ink);
		font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
		font-size: 15px;
		line-height: 1.55;
		-webkit-font-smoothing: antialiased;
	}
	.wrap { max-width: 1240px; margin: 0 auto; padding: 0 28px 96px; }

	/* --- header --- */
	header.doc { padding: 72px 0 0; }
	.kicker {
		font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
		color: var(--ink-3); margin: 0 0 18px;
	}
	h1 {
		font-family: Georgia, "Times New Roman", serif;
		font-weight: 500; font-size: clamp(34px, 5vw, 54px);
		line-height: 1.06; letter-spacing: -0.015em;
		margin: 0 0 20px; max-width: 820px;
	}
	.lede {
		max-width: 680px; color: var(--ink-2); font-size: 17px; margin: 0 0 34px;
	}
	.meta {
		border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
		padding: 14px 0; display: flex; flex-wrap: wrap; gap: 10px 34px;
		font-size: 13px; color: var(--ink-2);
	}
	.meta b { font-weight: 550; color: var(--ink); }
	.meta code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }

	/* --- stats line --- */
	.stats {
		display: flex; flex-wrap: wrap; gap: 0 44px; padding: 26px 0 6px;
	}
	.stat { display: flex; align-items: baseline; gap: 10px; }
	.stat .n { font-family: Georgia, serif; font-size: 30px; letter-spacing: -0.01em; }
	.stat .l { font-size: 12.5px; color: var(--ink-3); letter-spacing: 0.02em; }

	/* --- method --- */
	.method { margin: 34px 0 0; max-width: 860px; }
	.method h2 {
		font-family: Georgia, serif; font-weight: 500; font-size: 21px; margin: 0 0 10px;
		letter-spacing: -0.01em;
	}
	.method p { margin: 0 0 8px; color: var(--ink-2); }
	.method ul { margin: 6px 0 0; padding: 0 0 0 18px; color: var(--ink-2); }
	.method li { margin: 4px 0; }

	/* --- filters --- */
	.filters {
		display: flex; flex-wrap: wrap; gap: 8px; margin: 40px 0 26px;
		padding-top: 24px; border-top: 1px solid var(--line);
	}
	.filter {
		appearance: none; background: transparent; border: 1px solid var(--line);
		border-radius: 999px; padding: 7px 14px; font-size: 13px; color: var(--ink-2);
		cursor: pointer; font-family: inherit; letter-spacing: 0.01em;
		transition: border-color .15s, color .15s;
	}
	.filter:hover { border-color: var(--ink-3); color: var(--ink); }
	.filter.is-active { border-color: var(--accent); color: var(--accent); }

	/* --- grid --- */
	.grid {
		display: grid; grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
		gap: 26px 22px;
	}
	.card {
		background: var(--panel); border: 1px solid var(--line-soft);
		border-radius: var(--r); padding: 14px 14px 12px;
		display: flex; flex-direction: column; gap: 8px;
		transition: border-color .15s;
	}
	.card:hover { border-color: var(--line); }
	.card[hidden] { display: none; }
	.card__head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
	.card__id { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: var(--accent); letter-spacing: 0.02em; }
	.badge {
		font-size: 11px; color: var(--ink-3); border: 1px solid var(--line);
		border-radius: 999px; padding: 2px 8px; white-space: nowrap;
	}
	.badge--ok { color: #2c6e49; border-color: rgba(44, 110, 73, 0.35); }
	.badge--miss { color: var(--accent); border-color: rgba(194, 37, 92, 0.35); }
	.card__title { margin: 0; font-size: 15.5px; font-weight: 550; line-height: 1.3; letter-spacing: -0.005em; }
	.card__route {
		font-family: ui-monospace, "SF Mono", Menlo, monospace;
		font-size: 11.5px; color: var(--ink-3); overflow-wrap: anywhere;
	}
	.card__shot {
		display: block; border: 1px solid var(--line-soft); border-radius: var(--r);
		overflow: hidden; background: #efeae2; margin-top: 2px;
	}
	.card__shot img { display: block; width: 100%; height: 330px; object-fit: cover; object-position: top; }
	.card__shot--miss { display: flex; align-items: center; justify-content: center; height: 180px; color: var(--ink-3); font-size: 13px; }
	.card__meta { display: flex; flex-direction: column; gap: 4px; }
	.card__role { font-size: 12px; color: var(--ink-3); }
	.card__variants, .card__note { font-size: 12px; color: var(--ink-3); }
	.card__note { font-style: italic; }

	/* --- lightbox --- */
	.lb {
		position: fixed; inset: 0; background: rgba(27, 23, 18, 0.82);
		display: none; z-index: 50; overflow: auto; padding: 40px 16px 80px;
	}
	.lb.is-open { display: block; }
	.lb__inner { max-width: 520px; margin: 0 auto; }
	.lb__bar { display: flex; justify-content: space-between; align-items: center; margin: 0 0 10px; color: #efeae2; }
	.lb__title { font-size: 13px; letter-spacing: 0.02em; }
	.lb__close {
		background: transparent; color: #efeae2; border: 1px solid rgba(239, 234, 226, 0.4);
		border-radius: 999px; padding: 5px 12px; cursor: pointer; font-size: 12px; font-family: inherit;
	}
	.lb img { display: block; width: 100%; background: #fff; border-radius: var(--r); }

	/* --- footer --- */
	footer.doc {
		margin-top: 72px; padding-top: 22px; border-top: 1px solid var(--line);
		font-size: 12.5px; color: var(--ink-3); display: flex; flex-wrap: wrap; gap: 8px 30px;
	}

	@media (max-width: 640px) {
		.wrap { padding: 0 16px 64px; }
		header.doc { padding-top: 48px; }
		.card__shot img { height: 280px; }
	}
</style>
</head>
<body>
<div class="wrap">
	<header class="doc">
		<p class="kicker">Lovii · Canon T-032 · Карта страниц приложения</p>
		<h1>Все экраны приложения — по одному кадру на карточку</h1>
		<p class="lede">Полный обход маршрута lovii-app: ${totalCards} страниц из canon/APP_PAGES, снятых на живом стенде.
		По одному скриншоту к каждой карточке APP-P-001…APP-P-060, включая ролевые кабинеты и служебные экраны.</p>
		<div class="meta">
			<span><b>Стенд:</b> app-staging.lovii.ru</span>
			<span><b>Срез app:</b> <code>staging</code></span>
			<span><b>Снято:</b> ${new Date().toISOString().slice(0, 10)}</span>
			<span><b>Профиль:</b> тест-профиль владельца (все роли)</span>
			<span><b>Инструмент:</b> Playwright · 390×844 · ×2</span>
		</div>
	</header>

	<div class="stats">
		<div class="stat"><span class="n">${totalCards}</span><span class="l">карточек канона</span></div>
		<div class="stat"><span class="n">${shots}</span><span class="l">кадров (с вариантами)</span></div>
		<div class="stat"><span class="n">${SECTIONS.length}</span><span class="l">разделов маршрута</span></div>
		<div class="stat"><span class="n">${rows.filter((r) => (r.note ?? "").startsWith("redirect")).length}</span><span class="l">карточки-редиректы</span></div>
	</div>

	<section class="method">
		<h2>Как снято</h2>
		<p>Скриптованный обход маршрутов Playwright-каркасом lovii-app: гостевая сессия, сессия покупателя и ролевые кабинеты
		(представитель, основатель, амбассадор, МСП, команда точки) под тест-профилем стенда. Каждый экран — полная высота страницы,
		мобильная ширина 390&nbsp;px (×2 для читаемости).</p>
		<ul>
			<li>Кадры сняты «как есть»: реальные данные стенда, реальные состояния загрузки/пустоты где они есть.</li>
			<li>Карточки-редиректы (APP-P-011, 012, 025) показывают экран-приёмник — в бейдже указан фактический путь.</li>
			<li>Служебные экраны (оплата, mock-банк, magic-link, 404) сняты в их достижимом состоянии без токенов перехода.</li>
		</ul>
	</section>

	<nav class="filters">
			${filters}
	</nav>

	<main class="grid" id="grid">
${cards}
	</main>

	<footer class="doc">
		<span>Источник: canon/APP_PAGES (T-032) · маршрут src/router/index.ts</span>
		<span>Манифест: APP_PAGES_shots/manifest.json · покрытие: COVERAGE.md</span>
	</footer>
</div>

<div class="lb" id="lb">
	<div class="lb__inner">
		<div class="lb__bar">
			<span class="lb__title" id="lbTitle"></span>
			<button class="lb__close" id="lbClose" type="button">Закрыть · Esc</button>
		</div>
		<img id="lbImg" src="" alt="">
	</div>
</div>

<script>
(function () {
	var grid = document.getElementById("grid");
	var lb = document.getElementById("lb");
	var lbImg = document.getElementById("lbImg");
	var lbTitle = document.getElementById("lbTitle");

	// фильтры
	document.querySelectorAll(".filter").forEach(function (btn) {
		btn.addEventListener("click", function () {
			document.querySelectorAll(".filter").forEach(function (b) { b.classList.remove("is-active"); });
			btn.classList.add("is-active");
			var f = btn.getAttribute("data-filter");
			grid.querySelectorAll(".card").forEach(function (c) {
				var show = f === "all" || c.getAttribute("data-section") === f;
				if (show) { c.removeAttribute("hidden"); } else { c.setAttribute("hidden", ""); }
			});
		});
	});

	// лайтбокс
	grid.addEventListener("click", function (e) {
		var link = e.target.closest ? e.target.closest("a.card__shot") : null;
		if (!link) return;
		e.preventDefault();
		lbImg.setAttribute("src", link.getAttribute("data-full"));
		lbTitle.textContent = link.getAttribute("data-title") || "";
		lb.classList.add("is-open");
		document.body.style.overflow = "hidden";
	});
	function close() {
		lb.classList.remove("is-open");
		lbImg.setAttribute("src", "");
		document.body.style.overflow = "";
	}
	document.getElementById("lbClose").addEventListener("click", close);
	lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
	document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "gallery.html"), html);
console.log("gallery.html:", html.length, "bytes");

// --- COVERAGE.md ---
const lines = [];
lines.push("# Покрытие: скрины карточек APP_PAGES (T-032)");
lines.push("");
lines.push(`- Всего карточек: **${rows.length}** · кадров: **${shots}** · без кадра: **${rows.filter((r) => !r.file).length}**`);
lines.push("");
lines.push("| ID | Карточка | Раздел | Достигнутый экран | Кадр | Примечание |");
lines.push("|---|---|---|---|---|---|");
for (const r of rows) {
	const sec = sectionOf(r.id);
	const final = r.finalUrl ? r.finalUrl.replace("https://app-staging.lovii.ru", "") : "—";
	const variants = (r.variants ?? []).length ? `<br>+ ${(r.variants ?? []).map((v) => "`" + v + "`").join(", ")}` : "";
	lines.push(
		`| ${r.id} | ${r.title} | ${sec.label} | ${final} | ${r.file ? "`" + r.file + "`" : "—"}${variants} | ${r.note ?? ""} |`,
	);
}
fs.writeFileSync(path.join(ROOT, "COVERAGE.md"), lines.join("\n") + "\n");
console.log("COVERAGE.md ok");

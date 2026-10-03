#!/usr/bin/env node
/**
 * build-library.mjs — сборка единой библиотеки экранов из живых данных.
 *
 * Источники (read-only):
 *   screens/<APP-P-slug>/<vN-YYYY-MM-DD>/*.png + meta.json   — источник истины (append-only, T-032)
 *   screens-gallery/manifest.json                            — заголовки/группы страниц (T-032)
 *   screens-gallery/states.json                              — коды логики кадров состояний (T-034)
 *   canon/APP_PAGES/APP-M-*.md                               — модалки (карточки канона)
 *   library.template.html                                    — шаблон страницы библиотеки
 *
 * Выход (перезаписывается целиком при каждом запуске):
 *   manifest.json   — единый манифест: страницы + все версии + все кадры-развёртки + модалки
 *   library.html    — автономная страница библиотеки (манифест зашит внутрь, работает офлайн)
 *
 * Запуск: node build-library.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // screens-library/
const DOCS = dirname(ROOT);                                   // lovii_docs/
const SCREENS = join(DOCS, 'screens');
const GALLERY = join(DOCS, 'screens-gallery');
const PAGES_CANON = join(DOCS, 'canon', 'APP_PAGES');

const pagesManifest = JSON.parse(readFileSync(join(GALLERY, 'manifest.json'), 'utf8'));
const statesManifest = JSON.parse(readFileSync(join(GALLERY, 'states.json'), 'utf8'));
const pageInfo = new Map(pagesManifest.items.map(i => [i.slug, i]));
// states.json: код логики по пути кадра (screens/APP-P-049-msp-loyalty/v2-2026-10-03/step2-combo-FIXED.png)
const stateCode = new Map(statesManifest.items.map(i => [i.img.replace(/^\.\.\//, ''), i]));

const titleFromMeta = (slug) => {
  try {
    const dirs = readdirSync(join(SCREENS, slug)).filter(d => /^v\d+-/.test(d)).sort();
    const meta = JSON.parse(readFileSync(join(SCREENS, slug, dirs.at(-1), 'meta.json'), 'utf8'));
    return meta.title ?? slug;
  } catch { return slug; }
};

const items = [];
for (const slug of readdirSync(SCREENS, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith('APP-P-'))
  .map(d => d.name)
  .sort()) {
  const id = slug.match(/^APP-P-\d+/)[0];
  const info = pageInfo.get(slug) ?? {};
  const versions = [];
  for (const vdir of readdirSync(join(SCREENS, slug), { withFileTypes: true })
    .filter(d => d.isDirectory() && /^v\d+-\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map(d => d.name)
    .sort()) {
    const vdirPath = join(SCREENS, slug, vdir);
    let meta = {};
    try { meta = JSON.parse(readFileSync(join(vdirPath, 'meta.json'), 'utf8')); } catch { /* нет meta — не блокируем */ }
    const frames = readdirSync(vdirPath)
      .filter(f => f.endsWith('.png'))
      .sort()
      .map(f => {
        const state = f.replace(/\.png$/, '');
        const rel = `screens/${slug}/${vdir}/${f}`;
        const st = stateCode.get(rel);
        return {
          state,
          is_default: state === 'default',
          img: `../${rel}`,
          code: st?.code ?? meta.states?.[f] ?? null,
          note: st?.title ?? null,
        };
      });
    versions.push({
      version: vdir,
      date: meta.date ?? vdir.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '',
      route: meta.route ?? null,
      stand: meta.stand ?? null,
      app_slice: meta.app_slice ?? null,
      notes: meta.notes ?? null,
      frames,
    });
  }
  if (!versions.length) continue;
  const last = versions.at(-1);
  items.push({
    id,
    kind: 'page',
    slug,
    title: info.title ? info.title.replace(/^APP-P-\d+ — /, '') : titleFromMeta(slug),
    group: info.group ?? 'Прочее',
    card_local: existsSync(join(PAGES_CANON, `${slug}.md`)) ? `../canon/APP_PAGES/${slug}.md` : null,
    versions,
    current_version: last.version,
  });
}

// Модалки APP-M: карточки канона есть, кадров пока нет
for (const f of readdirSync(PAGES_CANON).filter(f => /^APP-M-\d+.*\.md$/.test(f)).sort()) {
  const slug = f.replace(/\.md$/, '');
  let title = slug;
  try {
    const head = readFileSync(join(PAGES_CANON, f), 'utf8').split('\n').find(l => l.startsWith('# '));
    if (head) title = head.replace(/^#\s*/, '');
  } catch { /* пусто */ }
  items.push({ id: slug.match(/^APP-M-\d+/)[0], kind: 'modal', slug, title, group: 'Модалки', card_local: `../canon/APP_PAGES/${f}`, versions: [], current_version: null });
}

// порядок групп как в каноне T-032
const GROUP_ORDER = ['Витрина', 'Корзина и заказы', 'Профиль и кошелёк', 'Кабинеты (МСП/амбассадор)', 'Служебные', 'Модалки', 'Прочее'];
items.sort((a, b) => a.id.localeCompare(b.id));
const groups = [...new Set(items.map(i => i.group))].sort((a, b) => (GROUP_ORDER.indexOf(a) + 99) % 100 - ((GROUP_ORDER.indexOf(b) + 99) % 100));

const manifest = {
  generated: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  source: 'screens/ (append-only) + screens-gallery/{manifest,states}.json + canon/APP_PAGES',
  build: 'node screens-library/_tools/build-library.mjs',
  counts: {
    pages: items.filter(i => i.kind === 'page').length,
    modals: items.filter(i => i.kind === 'modal').length,
    versions: items.reduce((s, i) => s + i.versions.length, 0),
    frames: items.reduce((s, i) => s + i.versions.reduce((t, v) => t + v.frames.length, 0), 0),
  },
  groups,
  items,
};
writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const template = readFileSync(join(ROOT, '_tools', 'library.template.html'), 'utf8');
writeFileSync(join(ROOT, 'library.html'), template.replace('/*__MANIFEST__*/null', JSON.stringify(manifest)));

console.log(`OK: страниц ${manifest.counts.pages}, модалок ${manifest.counts.modals}, версий ${manifest.counts.versions}, кадров ${manifest.counts.frames}`);
console.log(`Группы: ${groups.join(' · ')}`);

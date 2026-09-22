#!/usr/bin/env node
/*
 * Генерирует examples/campaigns/*.json из шаблонов демо (compile(defaults)).
 * Запуск: node docs/lovii-loyalty-constructor/examples/build-examples.mjs
 * Файлы — источник для golden-тестов и валидации против schema/campaign.schema.json.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATE_BY_ID } from '../../prototype/templates.js';
import { TEMPLATE_CTX, PARTNERS, CATALOG } from '../../prototype/demo-data.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'campaigns');
mkdirSync(outDir, { recursive: true });

const nameOf = (sku) => (CATALOG.find(p => p.sku === sku) || {}).name || sku;

// файл → [шаблон, переопределения параметров]
const EXAMPLES = {
  'lm-01-threshold.json': ['lm-01', {}],
  'lm-02-bundle.json': ['lm-02', {}],
  'lm-03-addon.json': ['lm-03', { offer_name: nameOf('cd8') }],
  'lm-04-cashback-flat.json': ['lm-04', { mode: 'flat', percent: 5 }],
  'lm-04-cashback-ladder.json': ['lm-04', { mode: 'ladder' }],
  'lm-04-cashback-category.json': ['lm-04', { mode: 'by_category', categories: [{ category: 'dessert', percent: 10 }, { category: 'coffee', percent: 3 }], ttl_days: 45 }],
  'lm-05-happy-hours.json': ['lm-05', {}],
  'lm-06-stamps.json': ['lm-06', {}],
  'lm-07-tiers.json': ['lm-07', {}],
  'lm-08-subscription.json': ['lm-08', { plan_id: 'coffee10' }],
  'lm-09-challenge.json': ['lm-09', {}],
  'lm-10-welcome.json': ['lm-10', {}],
  'lm-11-referral.json': ['lm-11', {}],
  'lm-12-cross-promo.json': ['lm-12', { partner_name: PARTNERS[0].name }],
  'lm-13-coupon.json': ['lm-13', { code: 'DAILY15', category: 'breakfast' }],
  'lm-14-winback.json': ['lm-14', {}],
  'lm-15-birthday.json': ['lm-15', {}],
  'lm-16-instant-win.json': ['lm-16', {}],
  'lm-17-gift-card.json': ['lm-17', {}],
  'lm-18-review.json': ['lm-18', {}],
};

let n = 0;
for (const [file, [tid, over]] of Object.entries(EXAMPLES)) {
  const t = TEMPLATE_BY_ID[tid];
  const params = { ...t.defaults(TEMPLATE_CTX), ...over };
  const spec = t.compile(params);
  writeFileSync(join(outDir, file), JSON.stringify(spec, null, 2) + '\n');
  n++;
}
console.log(`written ${n} campaign examples → ${outDir}`);

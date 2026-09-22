#!/usr/bin/env node
/*
 * Golden-тесты движка лояльности.
 *
 *   node examples/run-golden.mjs            — прогнать все кейсы examples/testcases/*.json
 *   node examples/run-golden.mjs --update   — перезаписать expected результатами референсного движка
 *   node examples/run-golden.mjs lm-01      — только кейсы, чьё имя файла содержит подстроку
 *
 * Формат кейса:
 * {
 *   "id": "...", "title": "...", "kind": "quote" | "scheduler",
 *   "campaigns": [{ "campaign_id", "version", "status", "published_at", "spec_file" | "spec", "spec_patch", "budget_used_minor", "uses_total" }],
 *   "settings": {...}, "context": {...},              // для quote
 *   "customers": [{ "customer", "state" }], "now": "…", // для scheduler
 *   "expected": {...}                                  // канонический результат без volatile-полей
 * }
 * Сравнение: JSON с отсортированными ключами, без quote_id / expires_at / engine_version.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quote, runScheduler } from '../../prototype/engine.js';

const here = dirname(fileURLToPath(import.meta.url));
const casesDir = join(here, 'testcases');
const args = process.argv.slice(2);
const update = args.includes('--update');
const filter = args.find(a => !a.startsWith('--'));

const VOLATILE = new Set(['quote_id', 'engine_version']);
const VOLATILE_TOP = new Set(['expires_at']); // срок quote; expires_at лотов/купонов — детерминированы от context.now

export function canonical(value, depth = 0) {
  if (Array.isArray(value)) return value.map(v => canonical(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (VOLATILE.has(k) || (depth === 0 && VOLATILE_TOP.has(k)) || value[k] === undefined) continue;
      out[k] = canonical(value[k], depth + 1);
    }
    return out;
  }
  return value;
}

function deepMerge(target, patch) {
  if (Array.isArray(patch) || patch === null || typeof patch !== 'object') return patch;
  const out = { ...(target || {}) };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(out[k], v);
  return out;
}

function loadCampaigns(tc, file) {
  return (tc.campaigns || []).map(c => {
    let spec = c.spec;
    if (c.spec_file) spec = JSON.parse(readFileSync(resolve(dirname(file), c.spec_file), 'utf8'));
    if (c.spec_patch) spec = deepMerge(spec, c.spec_patch);
    const { spec_file, spec_patch, ...rest } = c;
    return { version: 1, status: 'active', published_at: '2026-09-01T00:00:00+03:00', ...rest, spec };
  });
}

function diffPaths(a, b, path = '', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) diffPaths(a[k], b[k], path ? `${path}.${k}` : k, out);
    return out;
  }
  out.push(`${path || '$'}: expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`);
  return out;
}

function run(tc, file) {
  const campaigns = loadCampaigns(tc, file);
  if (tc.kind === 'scheduler') {
    const customers = JSON.parse(JSON.stringify(tc.customers));
    const issued = runScheduler({ campaigns, customers, now: tc.now, merchant_id: tc.merchant_id, settings: tc.settings });
    return { issued, customers };
  }
  return quote({ campaigns, context: tc.context, settings: tc.settings || {} });
}

const files = readdirSync(casesDir).filter(f => f.endsWith('.json') && !f.startsWith('_') && (!filter || f.includes(filter))).sort();
let passed = 0, failed = 0, updated = 0;
for (const f of files) {
  const file = join(casesDir, f);
  const tc = JSON.parse(readFileSync(file, 'utf8'));
  let actual;
  try { actual = canonical(run(tc, file)); } catch (e) { failed++; console.log(`✗ ${f}: exception ${e.stack}`); continue; }
  if (update) { tc.expected = actual; writeFileSync(file, JSON.stringify(tc, null, 2) + '\n'); updated++; console.log(`↻ ${f} updated`); continue; }
  const expected = canonical(tc.expected || {});
  const diffs = diffPaths(actual, expected);
  if (diffs.length === 0) { passed++; console.log(`✓ ${f}`); }
  else { failed++; console.log(`✗ ${f}`); diffs.slice(0, 12).forEach(d => console.log(`    ${d}`)); if (diffs.length > 12) console.log(`    … +${diffs.length - 12}`); }
}
if (update) console.log(`\n${updated} case(s) updated`);
else { console.log(`\n${passed} passed, ${failed} failed, ${files.length} total`); process.exit(failed ? 1 : 0); }

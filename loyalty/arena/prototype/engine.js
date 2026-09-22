/*
 * LOVII Loyalty Engine — референсная реализация конвейера quote/commit
 * из docs/lovii-loyalty-constructor/03-rules-engine.md.
 *
 * Чистый ES-модуль без зависимостей: работает в браузере (демо) и в Node ≥ 18
 * (golden-тесты: docs/lovii-loyalty-constructor/examples/run-golden.mjs).
 *
 * Не продакшн-код: нет БД, транзакций и API. Но поведение (порядок стадий,
 * округления, стекинг, лимиты, подсказки, объяснения) — нормативное: целевая
 * реализация обязана давать те же результаты на golden-кейсах.
 *
 * Детерминизм: движок не обращается к часам и ГСЧ. Время — context.now,
 * случайность — sha256(order_id + ":" + campaign_id).
 */

export const ENGINE_VERSION = '1.0.0';

export const DEFAULT_SETTINGS = Object.freeze({
  max_total_discount_pct: 30,       // потолок суммарной скидки класса «цена», % от gross
  max_merchant_cashback_pct: 20,    // потолок суммарного процентного промо-кэшбэка ТСП
  max_coupons_per_order: 1,
  max_points_share_pct: 50,         // какую долю чека можно оплатить баллами
  accrue_on: 'paid_money',          // paid_money | total
  platform_base_pct: 5,             // базовый кэшбэк платформы (0 = выключен)
  platform_base_title: 'Кэшбэк LOVII',
  exclude_categories_from_rewards: ['gift_card'],
  quote_ttl_min: 15,
});

export const SKIP_REASONS = Object.freeze([
  'schedule', 'window', 'audience', 'holdout', 'limit_per_customer', 'limit_total', 'budget',
  'condition:<idx>', 'stacking:<group>:<winner_id>', 'coupon_invalid', 'staff_excluded',
  'guest', 'no_effect', 'cap', 'stamp_interval', 'coupon_required',
]);

const PRICE_ACTIONS = new Set(['discount', 'free_item', 'redeem_subscription_unit']);
const REWARD_ACTIONS = new Set(['accrue_points', 'stamp', 'challenge_progress', 'random_reward', 'coupon_issue', 'notify', 'tier_assign']);

// ───────────────────────────── утилиты ─────────────────────────────

export function sha256Hex(message) {
  // Компактная синхронная SHA-256 (FIPS 180-4) для детерминированных хэшей.
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = new TextEncoder().encode(String(message));
  const bitLen = bytes.length * 8;
  const padLen = ((bytes.length + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(padLen - 4, bitLen >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(x => x.toString(16).padStart(8, '0')).join('');
}

/** Первые 32 бита sha256 как беззнаковое число. */
export function hash32(str) { return parseInt(sha256Hex(str).slice(0, 8), 16) >>> 0; }

/** Детерминированный «случайный» u ∈ [0,1) для розыгрышей: sha256(order_id:campaign_id). */
export function seededUnit(orderId, campaignId) { return hash32(`${orderId || ''}:${campaignId}`) / 2 ** 32; }

/** Контрольная группа: hash(customer_id:campaign_id) mod 100 < holdout_pct. */
export function inHoldout(customerId, campaignId, pct) {
  if (!pct || !customerId) return false;
  return hash32(`${customerId}:${campaignId}`) % 100 < pct;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Детерминированный код купона LV-XXXXXXXX (40 бит из sha256). */
export function couponCode(seed) {
  const hex = sha256Hex(seed).slice(0, 10);
  let n = BigInt('0x' + hex), out = '';
  for (let i = 0; i < 8; i++) { out = CODE_ALPHABET[Number(n & 31n)] + out; n >>= 5n; }
  return 'LV-' + out;
}

export const moneyPct = (minor, pct) => Math.floor(minor * pct / 100);
export const pointsPct = (minor, pct) => Math.floor(minor * pct / 10000);
export const pointsFromMinor = (minor) => Math.floor(minor / 100);

export function fmtRub(minor) {
  const rub = Math.floor(Math.abs(minor) / 100), kop = Math.abs(minor) % 100;
  const s = rub.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return (minor < 0 ? '−' : '') + s + (kop ? ',' + String(kop).padStart(2, '0') : '') + '\u00a0₽';
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// ───────────────────────────── время ─────────────────────────────

function tzParts(date, timeZone) {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
    const p = {};
    for (const part of f.formatToParts(date)) p[part.type] = part.value;
    const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
    return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mi: +p.minute, ss: +p.second, weekday: wd };
  } catch (e) {
    const d = date;
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mi: d.getUTCMinutes(), ss: d.getUTCSeconds(), weekday: ((d.getUTCDay() + 6) % 7) + 1 };
  }
}

function tzOffsetMinutes(date, timeZone) {
  const p = tzParts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mi, p.ss);
  return Math.round((asUtc - date.getTime()) / 60000);
}

const pad2 = (n) => String(n).padStart(2, '0');

/** ISO-8601 с локальным смещением зоны, напр. 2026-09-22T09:40:00+03:00 */
export function formatInTz(date, timeZone) {
  const p = tzParts(date, timeZone);
  const off = tzOffsetMinutes(date, timeZone);
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T${pad2(p.hh)}:${pad2(p.mi)}:${pad2(p.ss)}${sign}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
}

function isoWeekKey(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${pad2(week)}`;
}

export function localContext(nowIso, timeZone) {
  const date = new Date(nowIso);
  const p = tzParts(date, timeZone);
  return {
    date: `${p.y}-${pad2(p.m)}-${pad2(p.d)}`,
    time: `${pad2(p.hh)}:${pad2(p.mi)}`,
    weekday: p.weekday,
    week: isoWeekKey(p.y, p.m, p.d),
    month: `${p.y}-${pad2(p.m)}`,
  };
}

function addDaysIso(nowIso, days, timeZone) {
  const d = new Date(new Date(nowIso).getTime() + days * 86400000);
  return formatInTz(d, timeZone);
}

function minutesBetween(aIso, bIso) { return Math.abs(new Date(aIso) - new Date(bIso)) / 60000; }

// ───────────────────────────── корзина ─────────────────────────────

function normalizeItems(items) {
  return (items || []).map((it, idx) => ({
    idx,
    sku: String(it.sku),
    name: it.name || it.sku,
    category: it.category || null,
    price_minor: Math.max(0, Math.floor(Number(it.price_minor) || 0)),
    qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
    tags: Array.isArray(it.tags) ? it.tags.slice() : [],
    discount_minor: 0,     // накопленная скидка по строке (копейки)
    locked_units: 0,       // единицы, уже получившие to_price/free/subscription
    added: !!it.added,     // добавлено движком (free_item.add_if_missing)
  }));
}

export function matchItem(item, filter) {
  if (!filter) return true;
  if (filter.sku && Array.isArray(filter.sku.in) && !filter.sku.in.includes(item.sku)) return false;
  if (filter.category && Array.isArray(filter.category.in) && !filter.category.in.includes(item.category)) return false;
  if (filter.tags) {
    if (Array.isArray(filter.tags.any) && !filter.tags.any.some(t => item.tags.includes(t))) return false;
    if (Array.isArray(filter.tags.all) && !filter.tags.all.every(t => item.tags.includes(t))) return false;
  }
  if (Array.isArray(filter.exclude_sku) && filter.exclude_sku.includes(item.sku)) return false;
  if (filter.min_price_minor != null && item.price_minor < filter.min_price_minor) return false;
  return true;
}

const lineAmount = (l) => l.price_minor * l.qty;
const lineNet = (l) => lineAmount(l) - l.discount_minor;
const grossOf = (lines) => lines.reduce((s, l) => s + lineAmount(l), 0);
const discountOf = (lines) => lines.reduce((s, l) => s + l.discount_minor, 0);

/** Свободные (не «закрытые») единицы, подходящие под фильтр; дешёвые первыми, затем по порядку строк. */
function freeUnits(lines, filter) {
  const units = [];
  for (const l of lines) {
    if (!matchItem(l, filter)) continue;
    const free = l.qty - l.locked_units;
    for (let i = 0; i < free; i++) units.push({ line: l, price: l.price_minor });
  }
  units.sort((a, b) => a.price - b.price || a.line.idx - b.line.idx);
  return units;
}

function matchingQty(lines, filter) { return lines.filter(l => matchItem(l, filter)).reduce((s, l) => s + l.qty, 0); }
function matchingAmount(lines, filter) { return lines.filter(l => matchItem(l, filter)).reduce((s, l) => s + lineAmount(l), 0); }

// ───────────────────────────── условия ─────────────────────────────

function cmp(a, op, b) {
  switch (op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '>': return a != null && a > b;
    case '>=': return a != null && a >= b;
    case '<': return a != null && a < b;
    case '<=': return a != null && a <= b;
    case 'in': return Array.isArray(b) && b.includes(a);
    case 'not_in': return Array.isArray(b) && !b.includes(a);
    case 'between': return Array.isArray(b) && a != null && a >= b[0] && a <= b[1];
    case 'contains':
      if (Array.isArray(a)) return a.includes(b);
      if (typeof a === 'string') return a.includes(String(b));
      return false;
    default: return false;
  }
}

function resolveField(field, env) {
  const [root, ...rest] = field.split('.');
  const key = rest.join('.');
  switch (root) {
    case 'basket':
      switch (key) {
        case 'gross_total': return env.gross;
        case 'after_discounts': return env.after_discounts;
        case 'paid_money': return env.paid_money;
        case 'items': return env.lines;
        case 'item_count': return env.lines.reduce((s, l) => s + l.qty, 0);
        case 'eligible_amount': return matchingAmount(env.lines, env.filter);
      }
      return undefined;
    case 'customer': return env.customer ? env.customer[key] : undefined;
    case 'context': return env.ctx[key];
    case 'coupon': return env.coupon ? env.coupon[key] : (key === 'valid' ? false : null);
    case 'stamps': { const card = rest[0]; return (env.state.stamps && env.state.stamps[card] && env.state.stamps[card].count) || 0; }
    case 'subscription': { const plan = rest[1]; return activeSubscription(env.state, plan, env.nowIso) != null; }
    case 'referral': return !!(env.referral && env.referral.qualified);
  }
  return undefined;
}

function activeSubscription(state, planId, nowIso) {
  const subs = (state && state.subscriptions) || [];
  return subs.find(s => s.plan_id === planId && (s.units_left == null || s.units_left > 0) && (!s.expires_at || new Date(s.expires_at) > new Date(nowIso))) || null;
}

/** Возвращает true/false. env: { lines, gross, after_discounts, paid_money, customer, ctx, coupon, state, nowIso, filter } */
export function evalCondition(cond, env) {
  if (!cond) return true;
  if (Array.isArray(cond.any)) return cond.any.some(c => evalCondition(c, env));
  if (Array.isArray(cond.all)) return cond.all.every(c => evalCondition(c, env));
  if (cond.not) return !evalCondition(cond.not, env);
  const { field, op } = cond;
  if (field === 'basket.items') {
    const filter = cond.match || {};
    const qty = matchingQty(env.lines, filter);
    switch (op) {
      case 'any': return qty >= (cond.min_qty || 1);
      case 'all': return env.lines.length > 0 && env.lines.every(l => matchItem(l, filter));
      case 'count_gte': return qty >= (cond.value != null ? cond.value : (cond.min_qty || 1));
      case 'sum_gte': return matchingAmount(env.lines, filter) >= (cond.value || 0);
      case 'contains': return env.lines.some(l => l.sku === cond.value);
      default: return false;
    }
  }
  const val = resolveField(field, env);
  if (field === 'customer.segments') {
    const arr = Array.isArray(val) ? val : [];
    if (op === 'any' || op === 'in') return (cond.value || []).some(v => arr.includes(v));
    if (op === 'all') return (cond.value || []).every(v => arr.includes(v));
    if (op === 'not_in') return !(cond.value || []).some(v => arr.includes(v));
  }
  return cmp(val, op, cond.value);
}

/** Индекс первого невыполненного условия или -1. */
function firstFailedCondition(conditions, env) {
  for (let i = 0; i < (conditions || []).length; i++) if (!evalCondition(conditions[i], env)) return i;
  return -1;
}

// ───────────────────────────── отбор кампаний ─────────────────────────────

function inWindow(windows, ctx) {
  if (!windows || windows.length === 0) return true;
  return windows.some(w => {
    if (!w.days.includes(ctx.weekday)) return false;
    if (w.to > w.from) return ctx.time >= w.from && ctx.time < w.to;
    return ctx.time >= w.from || ctx.time < w.to; // окно через полночь
  });
}

function periodKey(period, ctx) {
  switch (period) {
    case 'day': return ctx.date;
    case 'week': return ctx.week;
    case 'month': return ctx.month;
    default: return 'campaign';
  }
}

export function counterKey(campaignId, period, ctx) { return `${campaignId}:${period}:${periodKey(period, ctx)}`; }

function preselect(c, spec, input, ctx, customer, state) {
  const now = new Date(input.context.now);
  const sch = spec.schedule || {};
  if (sch.starts_at && new Date(sch.starts_at) > now) return 'schedule';
  if (sch.ends_at && new Date(sch.ends_at) < now) return 'schedule';
  if (!inWindow(sch.windows, ctx)) return 'window';
  const au = spec.audience || {};
  if (customer) {
    if (customer.is_staff && au.exclude_staff !== false) return 'staff_excluded';
    if (Array.isArray(au.exclude_customer_ids) && au.exclude_customer_ids.includes(customer.id)) return 'audience';
    if (Array.isArray(au.include_customer_ids) && au.include_customer_ids.length && !au.include_customer_ids.includes(customer.id)) return 'audience';
    const segs = au.segments && au.segments.length ? au.segments : ['all'];
    if (!segs.includes('all') && !segs.some(s => (customer.segments || []).includes(s))) return 'audience';
    if (Array.isArray(au.statuses) && au.statuses.length && !au.statuses.includes(customer.status)) return 'audience';
    if (Array.isArray(au.tiers) && au.tiers.length && !au.tiers.includes(customer.tier)) return 'audience';
    if (inHoldout(customer.id, c.campaign_id, au.holdout_pct)) return 'holdout';
  } else {
    // гость: только публичные скидки без наград
    const segs = au.segments && au.segments.length ? au.segments : ['all'];
    if (!segs.includes('all') || (au.statuses && au.statuses.length) || (au.tiers && au.tiers.length)) return 'audience';
    const hasReward = (spec.actions || []).some(a => REWARD_ACTIONS.has(a.type) && a.type !== 'notify');
    if (hasReward) return 'guest';
  }
  const lim = spec.limits || {};
  if (lim.per_customer && customer) {
    const used = (state.counters || {})[counterKey(c.campaign_id, lim.per_customer.period, ctx)] || 0;
    if (used >= lim.per_customer.count) return 'limit_per_customer';
  }
  if (lim.total_uses != null && (c.uses_total || 0) >= lim.total_uses) return 'limit_total';
  if (lim.budget_total_minor != null && (c.budget_used_minor || 0) >= lim.budget_total_minor) return 'budget';
  if (lim.budget_daily_minor != null && (c.budget_used_today_minor || 0) >= lim.budget_daily_minor) return 'budget';
  return null;
}

// ───────────────────────────── купоны ─────────────────────────────

function normCode(code) { return String(code || '').trim().toUpperCase().replace(/\s+/g, ''); }

function resolveCoupon(input, campaigns, state, nowIso) {
  const code = normCode(input.context.coupon_code);
  if (!code) return { code: null, valid: false, campaign_id: null, virtual: null };
  const owned = (state.coupons || []).find(cp => normCode(cp.code) === code);
  if (owned) {
    if (owned.used) return { code, valid: false, reason: 'used', campaign_id: owned.campaign_id || null, virtual: null };
    if (owned.expires_at && new Date(owned.expires_at) < new Date(nowIso)) return { code, valid: false, reason: 'expired', campaign_id: owned.campaign_id || null, virtual: null };
    if (owned.redeemer_merchant_id && owned.redeemer_merchant_id !== input.context.merchant_id) return { code, valid: false, reason: 'wrong_merchant', campaign_id: null, virtual: null };
    if (owned.inline) {
      return {
        code, valid: true, campaign_id: `coupon:${code}`,
        virtual: {
          campaign_id: `coupon:${code}`, version: 1, status: 'active', published_at: owned.issued_at || '1970-01-01T00:00:00Z', is_coupon: true,
          spec: {
            spec_version: '1.0', mechanic: 'coupon', name: owned.title || `Купон ${code}`, priority: owned.priority != null ? owned.priority : 150,
            stacking: owned.stacking || { group: 'basket_discount', mode: 'exclusive' },
            trigger: { type: 'purchase' },
            conditions: [{ field: 'coupon.valid', op: '==', value: true }].concat(owned.inline.conditions || []),
            actions: owned.inline.actions, content: { title: owned.title || `Купон ${code}` }, meta: { template_id: owned.template_id || 'lm-13', issued_by: owned.issued_by || null },
          },
        },
      };
    }
    if (owned.campaign_id && campaigns.some(c => c.campaign_id === owned.campaign_id)) return { code, valid: true, campaign_id: owned.campaign_id, virtual: null, personal: true };
    return { code, valid: false, reason: 'not_found', campaign_id: null, virtual: null };
  }
  for (const c of campaigns) {
    const codes = (((c.spec.trigger || {}).params || {}).coupon || {}).codes || [];
    if (codes.map(normCode).includes(code)) return { code, valid: true, campaign_id: c.campaign_id, virtual: null, public: true };
  }
  return { code, valid: false, reason: 'not_found', campaign_id: null, virtual: null };
}

// ───────────────────────────── действия класса «цена» ─────────────────────────────

function applyDiscount(action, lines, ctxCap) {
  // Возвращает { discount_minor, items:[{sku, qty, discount_minor}], details } или null (нет эффекта)
  const items = [];
  const filter = action.filter;
  const pushItem = (line, qty, amount) => { if (amount > 0) { line.discount_minor += amount; items.push({ sku: line.sku, qty, discount_minor: amount }); } };
  let total = 0;

  if (action.scope === 'basket') {
    const base = lines.reduce((s, l) => s + lineNet(l), 0);
    let amt = action.mode === 'percent' ? moneyPct(base, action.value) : Math.min(Math.floor(action.value), base);
    if (action.max_amount_minor != null) amt = Math.min(amt, action.max_amount_minor);
    amt = Math.min(amt, ctxCap.remaining);
    if (amt <= 0) return null;
    // распределяем пропорционально по строкам (остаток — на самую дорогую строку)
    let left = amt;
    const sorted = lines.filter(l => lineNet(l) > 0).sort((a, b) => lineNet(b) - lineNet(a) || a.idx - b.idx);
    sorted.forEach((l, i) => {
      const share = i === sorted.length - 1 ? left : Math.min(left, Math.floor(amt * lineNet(l) / base));
      left -= share; pushItem(l, l.qty, share);
    });
    total = amt;
    return { discount_minor: total, items, details: { scope: 'basket', mode: action.mode, value: action.value } };
  }

  if (action.scope === 'items' && (action.mode === 'percent' || action.mode === 'fixed')) {
    const eligible = lines.filter(l => matchItem(l, filter) && lineNet(l) > 0);
    if (!eligible.length) return null;
    if (action.mode === 'percent') {
      for (const l of eligible) {
        let amt = moneyPct(lineNet(l), action.value);
        if (action.max_amount_minor != null) amt = Math.min(amt, Math.max(0, action.max_amount_minor - total));
        amt = Math.min(amt, ctxCap.remaining - total);
        pushItem(l, l.qty, amt); total += amt;
      }
    } else {
      let left = Math.min(Math.floor(action.value), ctxCap.remaining);
      if (action.max_amount_minor != null) left = Math.min(left, action.max_amount_minor);
      for (const l of eligible) { const amt = Math.min(left, lineNet(l)); pushItem(l, l.qty, amt); total += amt; left -= amt; if (left <= 0) break; }
    }
    return total > 0 ? { discount_minor: total, items, details: { scope: 'items', mode: action.mode, value: action.value } } : null;
  }

  if ((action.scope === 'item' || action.scope === 'items') && (action.mode === 'to_price' || action.mode === 'cheapest_free')) {
    const units = freeUnits(lines, filter);
    if (!units.length) return null;
    const maxQty = action.max_qty || 1;
    const chosen = action.mode === 'cheapest_free' ? units.slice(0, maxQty) : units.slice(0, maxQty);
    const perLine = new Map();
    for (const u of chosen) {
      const amt = action.mode === 'cheapest_free' ? u.price : Math.max(0, u.price - Math.floor(action.value));
      const capped = Math.min(amt, ctxCap.remaining - total);
      if (capped <= 0 && amt > 0) break;
      u.line.locked_units += 1; total += capped;
      const rec = perLine.get(u.line) || { qty: 0, amount: 0 }; rec.qty += 1; rec.amount += capped; perLine.set(u.line, rec);
    }
    for (const [line, rec] of perLine) pushItem(line, rec.qty, rec.amount);
    return total > 0 ? { discount_minor: total, items, details: { scope: action.scope, mode: action.mode, value: action.value, units: chosen.length } } : null;
  }

  if (action.scope === 'bundle' && action.bundle && Array.isArray(action.bundle.groups)) {
    const maxSets = action.bundle.max_sets || 1;
    let sets = 0;
    const setItems = [];
    while (sets < maxSets) {
      // пробуем собрать набор из свободных единиц: для каждой группы — самые дешёвые подходящие
      const picked = [];
      let ok = true;
      const tmpLocked = new Map();
      for (const g of action.bundle.groups) {
        const units = freeUnits(lines, g.filter).filter(u => (tmpLocked.get(u.line) || 0) < u.line.qty - u.line.locked_units);
        // учитываем уже выбранные в этом наборе единицы
        const avail = [];
        for (const u of units) {
          const used = tmpLocked.get(u.line) || 0;
          if (used < u.line.qty - u.line.locked_units) { avail.push(u); tmpLocked.set(u.line, used + 1); }
          if (avail.length === g.qty) break;
        }
        if (avail.length < g.qty) { ok = false; break; }
        picked.push(...avail);
      }
      if (!ok) break;
      const sum = picked.reduce((s, u) => s + u.price, 0);
      let amt = 0;
      if (action.mode === 'fixed') amt = Math.max(0, sum - Math.floor(action.value));
      else if (action.mode === 'percent') amt = moneyPct(sum, action.value);
      else if (action.mode === 'cheapest_free') amt = Math.min(...picked.map(u => u.price));
      else if (action.mode === 'to_price') amt = Math.max(0, sum - Math.floor(action.value));
      amt = Math.min(amt, ctxCap.remaining - total);
      for (const u of picked) u.line.locked_units += 1;
      // скидку набора относим на самую дорогую единицу набора (детерминированно)
      const top = picked.slice().sort((a, b) => b.price - a.price || a.line.idx - b.line.idx)[0];
      pushItem(top.line, 1, amt);
      total += amt; sets += 1; setItems.push(picked.map(u => u.line.sku));
      if (amt <= 0) break;
    }
    return sets > 0 && total > 0 ? { discount_minor: total, items, details: { scope: 'bundle', mode: action.mode, value: action.value, sets, components: setItems } } : null;
  }
  return null;
}

function applyFreeItem(action, lines, ctxCap, catalog) {
  if (action.requires_purchase_of) {
    const need = freeUnits(lines, action.requires_purchase_of);
    if (!need.length) return null;
  }
  const qty = action.qty || 1;
  let units = [];
  if (action.sku) units = freeUnits(lines, { sku: { in: [action.sku] } });
  else units = freeUnits(lines, action.filter);
  if (action.requires_purchase_of) {
    // подарок не может быть той же единицей, что и основание (напр. «десерт к напитку»)
    const baseUnits = new Set(freeUnits(lines, action.requires_purchase_of).map(u => u.line));
    const overlap = units.every(u => baseUnits.has(u.line));
    if (overlap && units.length <= 1 && [...baseUnits].length <= 1) return null;
  }
  if (!units.length && action.sku && action.add_if_missing) {
    const cat = (catalog || []).find(p => p.sku === action.sku);
    lines.push({ idx: lines.length, sku: action.sku, name: cat ? cat.name : action.sku, category: cat ? cat.category : null, price_minor: 0, qty, tags: cat ? (cat.tags || []) : [], discount_minor: 0, locked_units: qty, added: true });
    return { discount_minor: 0, items: [{ sku: action.sku, qty, discount_minor: 0 }], details: { added: true, sku: action.sku, qty, list_price_minor: cat ? cat.price_minor : 0 }, cost_minor: cat ? cat.price_minor * qty : 0 };
  }
  if (!units.length) return null;
  const chosen = (action.pick === 'most_expensive' ? units.slice().reverse() : units).slice(0, qty);
  let total = 0; const perLine = new Map();
  for (const u of chosen) {
    const amt = Math.min(u.price, ctxCap.remaining - total);
    u.line.locked_units += 1; total += amt;
    const rec = perLine.get(u.line) || { qty: 0, amount: 0 }; rec.qty += 1; rec.amount += amt; perLine.set(u.line, rec);
  }
  const items = [];
  for (const [line, rec] of perLine) { line.discount_minor += rec.amount; items.push({ sku: line.sku, qty: rec.qty, discount_minor: rec.amount }); }
  return { discount_minor: total, items, details: { free_units: chosen.map(u => u.line.sku) } };
}

function applySubscriptionUnit(action, lines, state, nowIso) {
  const sub = activeSubscription(state, action.plan_id, nowIso);
  if (!sub) return null;
  const unitsWanted = Math.min(action.units || 1, sub.units_left != null ? sub.units_left : Infinity);
  if (sub.daily_limit != null && (sub.used_today || 0) >= sub.daily_limit) return null;
  const units = freeUnits(lines, action.filter || sub.filter);
  if (!units.length) return null;
  const chosen = units.slice(0, Math.max(1, unitsWanted));
  let total = 0; const perLine = new Map();
  for (const u of chosen) { u.line.locked_units += 1; total += u.price; const r = perLine.get(u.line) || { qty: 0, amount: 0 }; r.qty += 1; r.amount += u.price; perLine.set(u.line, r); }
  const items = [];
  for (const [line, rec] of perLine) { line.discount_minor += rec.amount; items.push({ sku: line.sku, qty: rec.qty, discount_minor: rec.amount }); }
  return { discount_minor: total, items, details: { plan_id: action.plan_id, units_used: chosen.length, units_left_after: sub.units_left != null ? sub.units_left - chosen.length : null }, cost_minor: 0 };
}

// ───────────────────────────── действия класса «награда» ─────────────────────────────

function accrualBase(action, settings, env) {
  const base = action.base || settings.accrue_on || 'paid_money';
  if (base === 'eligible_amount') {
    const elig = matchingAmount(env.lines, action.filter);
    return env.gross > 0 ? Math.floor(elig * env.reward_base / env.gross) : 0;
  }
  if (base === 'total') return Math.max(0, env.reward_base + (env.paid_money < env.after_discounts ? env.after_discounts - env.paid_money : 0));
  return env.reward_base;
}

function computeAccrual(action, settings, env) {
  let points = 0; const details = { mode: action.mode };
  const base = accrualBase(action, settings, env);
  details.base_minor = base;
  switch (action.mode) {
    case 'percent': points = pointsPct(base, action.percent || 0); details.percent = action.percent; break;
    case 'fixed': points = Math.floor(action.amount || 0); break;
    case 'ladder': {
      const steps = (action.steps || []).slice().sort((a, b) => a.from_minor - b.from_minor);
      const step = steps.filter(s => base >= s.from_minor).pop();
      details.step = step ? step.from_minor : null; details.percent = step ? step.percent : 0;
      const next = steps.find(s => base < s.from_minor);
      if (next) details.next_step = { from_minor: next.from_minor, percent: next.percent, remaining_minor: next.from_minor - base };
      points = step ? pointsPct(base, step.percent) : 0; break;
    }
    case 'by_category': {
      details.by_category = {};
      for (const [cat, pct] of Object.entries(action.categories || {})) {
        const elig = matchingAmount(env.lines, { category: { in: [cat] } });
        const scaled = env.gross > 0 ? Math.floor(elig * env.reward_base / env.gross) : 0;
        const p = pointsPct(scaled, pct); if (p > 0) details.by_category[cat] = p; points += p;
      }
      break;
    }
    case 'multiplier': {
      const extra = Math.max(0, (action.multiplier || 1) - 1);
      points = Math.floor(pointsPct(base, settings.platform_base_pct) * extra); details.multiplier = action.multiplier; break;
    }
  }
  if (action.cap != null) { if (points > action.cap) details.capped_at = action.cap; points = Math.min(points, action.cap); }
  return { points, details };
}

function pickRandomReward(action, c, input, state, ctx) {
  const table = action.table || [];
  const u = seededUnit(input.context.order_id, c.campaign_id);
  const totalW = table.reduce((s, t) => s + t.weight, 0);
  let acc = 0, idx = table.findIndex(t => { acc += t.weight / totalW; return u < acc; });
  if (idx < 0) idx = table.length - 1;
  const dayKey = (i) => `${c.campaign_id}:prize:${i}:${ctx.date}`;
  const exhausted = (i) => table[i].daily_limit != null && ((state.counters || {})[dayKey(i)] || 0) >= table[i].daily_limit;
  let chosen = idx;
  if (exhausted(chosen)) {
    let found = -1;
    for (let k = 1; k <= table.length; k++) { const j = (chosen + k) % table.length; if (!exhausted(j)) { found = j; break; } }
    chosen = found >= 0 ? found : Math.max(0, table.findIndex(t => t.fallback));
  }
  return { index: chosen, u: Number(u.toFixed(6)), entry: table[chosen] };
}

// ───────────────────────────── QUOTE ─────────────────────────────

/**
 * quote({ campaigns, context, settings, options })
 *  campaigns: [{ campaign_id, version, status, published_at, spec, budget_used_minor, budget_used_today_minor, uses_total }]
 *  context:   см. 03 §4 (merchant_id, order_id, channel, now, customer|null, items, coupon_code, redeem_points, state, catalog)
 *  settings:  переопределения DEFAULT_SETTINGS
 *  options:   { issue_quote_id: bool }
 */
export function quote(input) {
  const settings = { ...DEFAULT_SETTINGS, ...(input.settings || {}) };
  const context = input.context;
  const customer = context.customer || null;
  // движок не мутирует вход: состояние клонируется
  const state = JSON.parse(JSON.stringify({ stamps: {}, counters: {}, subscriptions: [], challenges: {}, coupons: [], lots: [], ...(context.state || {}) }));
  const timeZone = context.timezone || (input.campaigns.find(c => c.spec.schedule && c.spec.schedule.timezone) || { spec: { schedule: {} } }).spec.schedule.timezone || 'Europe/Moscow';
  const nowIso = context.now;
  const ctx = { ...localContext(nowIso, timeZone), channel: context.channel || 'qr', now: nowIso, timezone: timeZone };
  const lines = normalizeItems(context.items);
  const gross = grossOf(lines);
  const catalog = context.catalog || [];

  const explain = [];
  const applied = [];
  const hints = [];
  const stampsOut = [];
  const notifications = [];
  const couponsIssued = [];
  const deferred = [];
  const skipped = new Map(); // campaign_id -> reason
  const applyCost = new Map(); // campaign_id -> cost_minor

  const activeCampaigns = (input.campaigns || []).filter(c => !c.status || c.status === 'active');
  const coupon = resolveCoupon(input, activeCampaigns, state, nowIso);
  const pool = activeCampaigns.slice();
  if (coupon.virtual) pool.push(coupon.virtual);

  const candidates = pool
    .filter(c => (c.spec.trigger || {}).type === 'purchase')
    .sort((a, b) => (b.spec.priority != null ? b.spec.priority : 100) - (a.spec.priority != null ? a.spec.priority : 100) || String(a.published_at || '').localeCompare(String(b.published_at || '')));

  const baseEnv = () => ({ lines, gross, after_discounts: gross, paid_money: gross, customer, ctx, state, nowIso, referral: context.referral });

  // 1. select
  const selected = [];
  for (const c of candidates) {
    const spec = c.spec;
    const couponBound = (((spec.trigger || {}).params || {}).coupon) != null || c.is_coupon || (spec.conditions || []).some(k => k.field && k.field.startsWith('coupon.'));
    let reason = preselect(c, spec, input, ctx, customer, state);
    if (!reason && couponBound && !(coupon.valid && coupon.campaign_id === c.campaign_id)) reason = coupon.code ? 'coupon_invalid' : 'coupon_required';
    if (reason) { skipped.set(c.campaign_id, reason); continue; }
    selected.push(c);
  }

  const couponEnvFor = (c) => (coupon.valid && coupon.campaign_id === c.campaign_id) ? { code: coupon.code, valid: true } : { code: coupon.code, valid: false };
  const winners = {}; // stacking group -> campaign_id
  const stackingOf = (c, action) => (action.stacking || c.spec.stacking || { group: 'custom', mode: 'stackable' });
  const blockedGroups = new Set();     // группы, заблокированные через stacking.blocks
  const winnersBlocked = new Map();    // группа -> кто заблокировал
  const conditionFails = new Map();    // campaign_id -> { idx, cond, env } | { ladder_next }

  function checkStacking(c, action) {
    const st = stackingOf(c, action);
    if (blockedGroups.has(st.group)) return `stacking:${st.group}:${winnersBlocked.get(st.group)}`;
    if (st.mode === 'exclusive' && winners[st.group] && winners[st.group] !== c.campaign_id) return `stacking:${st.group}:${winners[st.group]}`;
    return null;
  }
  function markApplied(c, action) {
    const st = stackingOf(c, action);
    if (!winners[st.group]) winners[st.group] = c.campaign_id;
    for (const g of (st.blocks || [])) { blockedGroups.add(g); winnersBlocked.set(g, c.campaign_id); }
  }

  // 2. PRICE
  const cap = { remaining: moneyPct(gross, settings.max_total_discount_pct) };
  const priceOrder = (a) => a.type === 'redeem_subscription_unit' ? 0 : (a.type === 'discount' && a.scope === 'basket') ? 2 : 1;
  const priceQueue = [];
  for (const c of selected) {
    (c.spec.actions || []).forEach((a, i) => { if (PRICE_ACTIONS.has(a.type)) priceQueue.push({ c, a, i }); });
    // отложенная награда карточки штампов (pending_reward) — применяется как ценовое действие
    (c.spec.actions || []).forEach((a, i) => {
      if (a.type === 'stamp' && state.stamps[a.card] && state.stamps[a.card].pending_reward && a.reward && PRICE_ACTIONS.has(a.reward.type)) {
        const reward = { ...a.reward };
        if (!reward.filter && !reward.sku) reward.filter = a.filter;
        priceQueue.push({ c, a: reward, i, pending_stamp_card: a.card });
      }
    });
  }
  priceQueue.sort((x, y) => priceOrder(x.a) - priceOrder(y.a) || selected.indexOf(x.c) - selected.indexOf(y.c) || x.i - y.i);
  const priceApplied = new Set();
  for (const { c, a, i, pending_stamp_card } of priceQueue) {
    if (skipped.has(c.campaign_id)) continue;
    const env = { ...baseEnv(), coupon: couponEnvFor(c), filter: a.filter };
    const fail = pending_stamp_card ? -1 : firstFailedCondition(c.spec.conditions, env);
    if (fail >= 0) { skipped.set(c.campaign_id, `condition:${fail}`); conditionFails.set(c.campaign_id, { idx: fail, cond: c.spec.conditions[fail], env }); continue; }
    const stackReason = checkStacking(c, a);
    if (stackReason) { skipped.set(c.campaign_id, stackReason); continue; }
    let res = null;
    if (a.type === 'discount') res = applyDiscount(a, lines, cap);
    else if (a.type === 'free_item') res = applyFreeItem(a, lines, cap, catalog);
    else if (a.type === 'redeem_subscription_unit') res = applySubscriptionUnit(a, lines, state, nowIso);
    if (!res) { if (!priceApplied.has(c.campaign_id)) skipped.set(c.campaign_id, cap.remaining <= 0 ? 'cap' : 'no_effect'); continue; }
    cap.remaining -= res.discount_minor;
    const cost = res.cost_minor != null ? res.cost_minor : res.discount_minor;
    applyCost.set(c.campaign_id, (applyCost.get(c.campaign_id) || 0) + cost);
    applied.push({
      campaign_id: c.campaign_id, campaign_version: c.version || 1, mechanic: c.spec.mechanic, title: (c.spec.content || {}).title || c.spec.name,
      action_type: a.type, action_index: i, discount_minor: res.discount_minor, points: 0, ttl_days: null,
      funding: c.spec.mechanic === 'platform_base' ? 'platform' : (c.spec.meta && c.spec.meta.funded_by) || 'merchant', items: res.items,
      details: pending_stamp_card ? { ...res.details, stamp_card_reward: pending_stamp_card } : res.details, cost_minor: cost,
    });
    priceApplied.add(c.campaign_id); skipped.delete(c.campaign_id); markApplied(c, a);
    if (pending_stamp_card) state.stamps[pending_stamp_card] = { ...state.stamps[pending_stamp_card], pending_reward: false, reward_applied_now: true };
  }

  const discountTotal = discountOf(lines);
  const afterDiscounts = gross - discountTotal;

  // 3. REDEEM
  const balance = customer ? (customer.points_balance != null ? customer.points_balance : (state.lots || []).reduce((s, l) => s + (l.amount_left || 0), 0)) : 0;
  const shareMinor = moneyPct(afterDiscounts, settings.max_points_share_pct);
  const redeemMax = customer ? Math.min(balance, pointsFromMinor(shareMinor)) : 0;
  const requested = Math.max(0, Math.floor(context.redeem_points || 0));
  const redeemed = Math.min(requested, redeemMax);
  const paidMoney = afterDiscounts - redeemed * 100;
  const lotsToRedeem = [];
  if (redeemed > 0) {
    const lots = (state.lots || []).filter(l => (l.amount_left || 0) > 0).map(l => ({ ...l }));
    const rank = (l) => l.expires_at ? (l.merchant_id === context.merchant_id ? 0 : 1) : 2;
    lots.sort((a, b) => rank(a) - rank(b) || String(a.expires_at || '9999').localeCompare(String(b.expires_at || '9999')) || String(a.lot_id || '').localeCompare(String(b.lot_id || '')));
    let left = redeemed;
    for (const l of lots) { if (left <= 0) break; const take = Math.min(left, l.amount_left); lotsToRedeem.push({ lot_id: l.lot_id || null, label: l.label || 'Баллы', points: take, expires_at: l.expires_at || null }); left -= take; }
    if (left > 0) lotsToRedeem.push({ lot_id: null, label: 'Баллы LOVII', points: left, expires_at: null });
  }

  // база для наград: оплачено деньгами минус исключённые категории (сертификаты)
  const excluded = lines.filter(l => (settings.exclude_categories_from_rewards || []).includes(l.category)).reduce((s, l) => s + lineNet(l), 0);
  const rewardBase = Math.max(0, paidMoney - excluded);

  // 4. REWARD
  const rewardEnvBase = { lines, gross, after_discounts: afterDiscounts, paid_money: paidMoney, reward_base: rewardBase, customer, ctx, state, nowIso, referral: context.referral };
  let merchantPctPoints = 0;
  const merchantPctCap = pointsPct(rewardBase, settings.max_merchant_cashback_pct);
  for (const c of selected) {
    if (!customer) { if (!priceApplied.has(c.campaign_id) && !skipped.has(c.campaign_id)) skipped.set(c.campaign_id, 'guest'); continue; }
    const rewardActions = (c.spec.actions || []).map((a, i) => ({ a, i })).filter(({ a }) => REWARD_ACTIONS.has(a.type));
    if (!rewardActions.length) continue;
    if (skipped.has(c.campaign_id) && !priceApplied.has(c.campaign_id) && String(skipped.get(c.campaign_id)).startsWith('condition:')) {
      // условия могли не пройти на gross, но пройти на paid — пересчитываем ниже
    } else if (skipped.has(c.campaign_id) && !priceApplied.has(c.campaign_id)) continue;
    const env = { ...rewardEnvBase, coupon: couponEnvFor(c), filter: (rewardActions[0].a.filter) };
    const fail = firstFailedCondition(c.spec.conditions, env);
    if (fail >= 0) { skipped.set(c.campaign_id, `condition:${fail}`); conditionFails.set(c.campaign_id, { idx: fail, cond: c.spec.conditions[fail], env }); continue; }
    let anyApplied = priceApplied.has(c.campaign_id);
    for (const { a, i } of rewardActions) {
      if (a.type === 'notify') {
        notifications.push({ campaign_id: c.campaign_id, channel: a.channel, template: a.template, params: a.params || {} });
        applied.push({ campaign_id: c.campaign_id, campaign_version: c.version || 1, mechanic: c.spec.mechanic, title: (c.spec.content || {}).title || c.spec.name, action_type: 'notify', action_index: i, discount_minor: 0, points: 0, ttl_days: null, funding: 'merchant', details: { channel: a.channel, template: a.template }, cost_minor: 0 });
        anyApplied = true; skipped.delete(c.campaign_id); continue;
      }
      if (a.type === 'tier_assign') continue;
      const stackReason = checkStacking(c, a);
      if (stackReason) { if (!anyApplied) skipped.set(c.campaign_id, stackReason); continue; }
      const entry = { campaign_id: c.campaign_id, campaign_version: c.version || 1, mechanic: c.spec.mechanic, title: (c.spec.content || {}).title || c.spec.name, action_type: a.type, action_index: i, discount_minor: 0, points: 0, ttl_days: null, funding: a.funding || 'merchant', details: {}, cost_minor: 0 };
      let ok = false;
      if (a.type === 'accrue_points') {
        if (a.filter && matchingQty(lines, a.filter) === 0) { if (!anyApplied) skipped.set(c.campaign_id, 'no_effect'); continue; }
        const { points, details } = computeAccrual(a, settings, { ...env, filter: a.filter });
        let pts = points;
        if (a.funding !== 'platform' && a.mode !== 'fixed') {
          const room = Math.max(0, merchantPctCap - merchantPctPoints);
          if (pts > room) { details.capped_by_settings = true; pts = room; }
          merchantPctPoints += pts;
        }
        if (details.next_step) conditionFails.set(c.campaign_id, { ladder_next: details.next_step });
        if (pts <= 0) { if (!anyApplied) skipped.set(c.campaign_id, 'no_effect'); continue; }
        entry.points = pts; entry.ttl_days = a.ttl_days || null; entry.details = details;
        entry.details.to = a.to || 'customer'; entry.details.lot_label = a.lot_label || entry.title;
        entry.details.expires_at = a.ttl_days ? addDaysIso(nowIso, a.ttl_days, timeZone) : null;
        entry.cost_minor = a.funding === 'platform' ? 0 : pts * 100;
        if ((a.to || 'customer') !== 'customer') deferred.push({ ...entry, reason: `to:${a.to}` });
        ok = true;
      } else if (a.type === 'stamp') {
        const card = state.stamps[a.card] || null;
        const units = a.filter ? matchingQty(lines, a.filter) : 1;
        if (units === 0) { if (!anyApplied) skipped.set(c.campaign_id, 'no_effect'); continue; }
        if (a.min_paid_money_minor != null && paidMoney < a.min_paid_money_minor) { if (!anyApplied) skipped.set(c.campaign_id, 'condition:min_paid'); continue; }
        if (card && card.last_at && a.min_interval_minutes && minutesBetween(card.last_at, nowIso) < a.min_interval_minutes) { if (!anyApplied) skipped.set(c.campaign_id, 'stamp_interval'); continue; }
        const before = card ? (card.count || 0) : (a.start_bonus || 0);
        const add = Math.min((a.count || 1) * units, a.max_per_order || 1);
        let after = before + add;
        const completed = after >= a.target;
        entry.details = { card: a.card, before, after: Math.min(after, a.target), target: a.target, completed, added: add };
        stampsOut.push({ card: a.card, before, after: Math.min(after, a.target), target: a.target, completed });
        if (completed && a.reward) {
          if (a.reward.type === 'accrue_points') {
            const { points } = computeAccrual(a.reward, settings, { ...env, filter: a.reward.filter });
            entry.details.reward = { type: 'accrue_points', points, applied: 'now' }; entry.points = points; entry.ttl_days = a.reward.ttl_days || null;
            entry.details.lot_label = a.reward.lot_label || `Награда: ${entry.title}`; entry.details.expires_at = a.reward.ttl_days ? addDaysIso(nowIso, a.reward.ttl_days, timeZone) : null; entry.details.to = 'customer';
            entry.cost_minor = points * 100;
          } else {
            entry.details.reward = { type: a.reward.type, applied: 'next_order' };
          }
          entry.details.next_card_count = a.start_bonus || 0;
        }
        ok = true;
      } else if (a.type === 'challenge_progress') {
        const ch = state.challenges[a.challenge] || { value: 0, started_at: nowIso, skus: [], weeks: [] };
        let value = ch.value || 0;
        const expired = ch.started_at && (new Date(nowIso) - new Date(ch.started_at)) / 86400000 > a.window_days;
        if (expired) value = 0;
        let inc = a.increment || 1;
        if (a.metric === 'amount') inc = paidMoney;
        else if (a.metric === 'unique_sku') { const known = new Set(expired ? [] : (ch.skus || [])); inc = lines.filter(l => matchItem(l, a.filter) && !known.has(l.sku)).map(l => l.sku).filter((v, i, arr) => arr.indexOf(v) === i).length; }
        else if (a.metric === 'streak_weeks') { inc = (ch.weeks || []).includes(ctx.week) && !expired ? 0 : 1; }
        if (inc === 0) { if (!anyApplied) skipped.set(c.campaign_id, 'no_effect'); continue; }
        const after = value + inc;
        const completed = after >= a.target;
        entry.details = { challenge: a.challenge, metric: a.metric, before: value, after: Math.min(after, a.target), target: a.target, completed, window_days: a.window_days, restarted: !!expired };
        if (completed && a.reward) {
          if (a.reward.type === 'accrue_points') { const { points } = computeAccrual(a.reward, settings, { ...env, filter: a.reward.filter }); entry.points = points; entry.ttl_days = a.reward.ttl_days || null; entry.details.reward = { type: 'accrue_points', points, applied: 'now' }; entry.details.lot_label = a.reward.lot_label || `Челлендж: ${entry.title}`; entry.details.expires_at = a.reward.ttl_days ? addDaysIso(nowIso, a.reward.ttl_days, timeZone) : null; entry.details.to = 'customer'; entry.cost_minor = points * 100; }
          else entry.details.reward = { type: a.reward.type, applied: 'next_order' };
        }
        ok = true;
      } else if (a.type === 'random_reward') {
        const pick = pickRandomReward(a, c, input, state, ctx);
        const prize = pick.entry;
        entry.details = { index: pick.index, u: pick.u, label: prize.label || null, prize_type: prize.action.type };
        if (prize.action.type === 'accrue_points') {
          const { points } = computeAccrual(prize.action, settings, { ...env, filter: prize.action.filter });
          entry.points = points; entry.ttl_days = prize.action.ttl_days || null; entry.details.lot_label = prize.label || entry.title; entry.details.expires_at = prize.action.ttl_days ? addDaysIso(nowIso, prize.action.ttl_days, timeZone) : null; entry.details.to = 'customer'; entry.cost_minor = points * 100;
        } else {
          // товар/скидка — купоном на следующий визит
          const code = couponCode(`${context.order_id || ''}:${c.campaign_id}:${i}:prize`);
          couponsIssued.push({ code, campaign_id: null, title: prize.label || entry.title, inline: { conditions: [], actions: [prize.action] }, ttl_days: 7, expires_at: addDaysIso(nowIso, 7, timeZone), to: 'customer', redeemer_merchant_id: context.merchant_id, issued_by: c.campaign_id, template_id: 'lm-16' });
          entry.details.coupon_code = code;
        }
        ok = true;
      } else if (a.type === 'coupon_issue') {
        const weekKey = `${c.campaign_id}:coupon_out:${ctx.week}`;
        if (a.max_per_customer_per_week != null && ((state.counters || {})[weekKey] || 0) >= a.max_per_customer_per_week) { if (!anyApplied) skipped.set(c.campaign_id, 'limit_per_customer'); continue; }
        const code = couponCode(`${context.order_id || ''}:${c.campaign_id}:${i}`);
        const cp = { code, campaign_id: a.redeem_campaign_id || null, title: (c.spec.content && c.spec.content.title) || c.spec.name, inline: a.inline || null, ttl_days: a.ttl_days, expires_at: addDaysIso(nowIso, a.ttl_days, timeZone), to: a.to || 'customer', redeemer_merchant_id: a.redeemer_merchant_id || context.merchant_id, issued_by: c.campaign_id, template_id: (c.spec.meta || {}).template_id || null };
        couponsIssued.push(cp);
        entry.details = { coupon_code: code, redeemer_merchant_id: cp.redeemer_merchant_id, expires_at: cp.expires_at, to: cp.to };
        entry.funding = a.redeemer_merchant_id && a.redeemer_merchant_id !== context.merchant_id ? 'partner' : 'merchant';
        ok = true;
      }
      if (ok) { applied.push(entry); anyApplied = true; skipped.delete(c.campaign_id); markApplied(c, a); applyCost.set(c.campaign_id, (applyCost.get(c.campaign_id) || 0) + entry.cost_minor); }
    }
  }

  // 5. platform base cashback
  if (customer && settings.platform_base_pct > 0 && rewardBase > 0) {
    const pts = pointsPct(rewardBase, settings.platform_base_pct);
    const title = `${settings.platform_base_title} ${String(settings.platform_base_pct).replace('.', ',')}\u00a0%`;
    if (pts > 0) applied.push({ campaign_id: 'platform_base', campaign_version: 1, mechanic: 'platform_base', title, action_type: 'accrue_points', action_index: 0, discount_minor: 0, points: pts, ttl_days: null, funding: 'platform', details: { mode: 'percent', percent: settings.platform_base_pct, base_minor: rewardBase, to: 'customer', lot_label: settings.platform_base_title, expires_at: null }, cost_minor: 0 });
    explain.push({ campaign_id: 'platform_base', name: title, result: pts > 0 ? 'applied' : 'skipped', reason: pts > 0 ? undefined : 'no_effect' });
  }

  // 6. hints
  const inBasket = new Set(lines.map(l => l.sku));
  const cheapestFrom = (pred) => catalog.filter(p => pred(p)).sort((a, b) => a.price_minor - b.price_minor || String(a.sku).localeCompare(String(b.sku)))[0] || null;
  const suggest = (remaining, filter) => {
    const pick = cheapestFrom(p => p.price_minor >= remaining && !inBasket.has(p.sku) && (p.is_available !== false) && matchItem({ ...p, tags: p.tags || [] }, filter));
    return pick ? { sku: pick.sku, name: pick.name, price_minor: pick.price_minor, qty: 1, category: pick.category || null } : null;
  };
  const rewardText = (c) => (c.spec.content && (c.spec.content.badge || c.spec.content.title)) || c.spec.name;
  const titleText = (c) => (c.spec.content && c.spec.content.title) || c.spec.name;
  const fmtPct = (p) => String(p).replace('.', ',') + '\u00a0%';
  /** Фраза о награде в родительном падеже для «До … осталось …» */
  const rewardPhrase = (c) => {
    const a = (c.spec.actions || [])[0] || {};
    if (a.type === 'accrue_points' && a.mode === 'fixed') return `+${a.amount} ${plural(a.amount, 'балла', 'баллов', 'баллов')}`;
    if (a.type === 'accrue_points' && a.mode === 'percent') return `кэшбэка ${fmtPct(a.percent)}`;
    if (a.type === 'accrue_points') return 'повышенного кэшбэка';
    if (a.type === 'discount' && a.mode === 'percent') return `скидки ${fmtPct(a.value)}`;
    if (a.type === 'discount' && a.mode === 'fixed') return `скидки ${fmtRub(a.value)}`;
    if (a.type === 'discount') return 'скидки';
    if (a.type === 'free_item') return 'подарка';
    if (a.type === 'random_reward') return 'розыгрыша';
    if (a.type === 'coupon_issue') return 'купона';
    return `«${titleText(c)}»`;
  };
  for (const c of selected) {
    const info = conditionFails.get(c.campaign_id);
    const skipReason = skipped.get(c.campaign_id);
    // порог чека / лестница
    let threshold = null, current = null;
    if (info && info.cond && info.cond.field && ['basket.paid_money', 'basket.after_discounts', 'basket.gross_total'].includes(info.cond.field) && ['>=', '>'].includes(info.cond.op)) {
      threshold = info.cond.value + (info.cond.op === '>' ? 1 : 0); current = resolveField(info.cond.field, info.env);
    } else if (info && info.cond && Array.isArray(info.cond.all)) {
      const t = info.cond.all.find(k => k.field && ['basket.paid_money', 'basket.after_discounts'].includes(k.field) && ['>=', '>'].includes(k.op) && !evalCondition(k, info.env));
      if (t) { threshold = t.value + (t.op === '>' ? 1 : 0); current = resolveField(t.field, info.env); }
    } else if (info && info.ladder_next) { threshold = info.ladder_next.from_minor; current = info.ladder_next.from_minor - info.ladder_next.remaining_minor; }
    if (threshold != null && current != null) {
      const remaining = threshold - current;
      if (remaining > 0 && remaining <= Math.max(Math.floor(0.4 * threshold), 30000)) {
        const item = suggest(remaining, null);
        const goal = info.ladder_next ? `кэшбэка ${fmtPct(info.ladder_next.percent)}` : rewardPhrase(c);
        hints.push({ type: 'threshold_progress', campaign_id: c.campaign_id, text: `До ${goal} осталось ${fmtRub(remaining)}` + (item ? ` — добавьте ${item.name} ${fmtRub(item.price_minor)}` : ''), remaining_minor: remaining, progress: { current, target: threshold }, suggested_item: item || undefined });
      }
    }
    // штампы
    const stampAction = (c.spec.actions || []).find(a => a.type === 'stamp');
    if (stampAction && customer) {
      const st = stampsOut.find(s => s.card === stampAction.card);
      if (st && !st.completed) {
        const rem = st.target - st.after;
        hints.push({ type: 'stamps', campaign_id: c.campaign_id, text: `Ещё ${rem} ${plural(rem, 'покупка', 'покупки', 'покупок')} — и ${titleText(c).replace(/^./, ch => ch.toLowerCase())}`, progress: { current: st.after, target: st.target } });
      } else if (!st && skipReason && (skipReason.startsWith('condition:') || skipReason === 'no_effect')) {
        const card = state.stamps[stampAction.card];
        const cur = card ? card.count || 0 : (stampAction.start_bonus || 0);
        const item = suggest(1, stampAction.filter);
        hints.push({ type: 'stamps', campaign_id: c.campaign_id, text: (item ? `Добавьте ${item.name} — получите штамп` : 'Штамп за покупку из акции') + ` (${cur}/${stampAction.target})`, progress: { current: cur, target: stampAction.target }, suggested_item: item || undefined });
      }
    }
    // набор: не хватает компонента
    const bundleAction = (c.spec.actions || []).find(a => a.type === 'discount' && a.scope === 'bundle');
    if (bundleAction && skipReason && (skipReason === 'no_effect' || skipReason.startsWith('condition:'))) {
      const groups = bundleAction.bundle.groups;
      const have = groups.map(g => matchingQty(lines, g.filter) >= g.qty);
      if (have.some(Boolean) && !have.every(Boolean)) {
        const missing = groups[have.indexOf(false)];
        const item = suggest(0, missing.filter);
        hints.push({ type: 'bundle_missing_component', campaign_id: c.campaign_id, text: `Добавьте ${item ? item.name : (missing.name || 'компонент набора')} — и «${rewardText(c)}» станет дешевле`, suggested_item: item || undefined, details: { missing_group: missing.name || null } });
      }
    }
    // апселл
    if (c.spec.mechanic === 'addon' && skipReason === 'no_effect') {
      const act = (c.spec.actions || []).find(a => a.type === 'discount' && a.mode === 'to_price');
      const sku = act && act.filter && act.filter.sku && act.filter.sku.in ? act.filter.sku.in[0] : null;
      const prod = catalog.find(p => p.sku === sku);
      if (prod) hints.push({ type: 'addon_offer', campaign_id: c.campaign_id, text: `Добавьте ${prod.name} за ${fmtRub(act.value)} вместо ${fmtRub(prod.price_minor)}`, suggested_item: { sku: prod.sku, name: prod.name, price_minor: prod.price_minor, qty: 1, category: prod.category || null }, special_price_minor: act.value });
    }
  }
  // купон в кошельке, который можно применить здесь
  if (customer && !coupon.code) {
    const avail = (state.coupons || []).filter(cp => !cp.used && (!cp.expires_at || new Date(cp.expires_at) >= new Date(nowIso)) && (!cp.redeemer_merchant_id || cp.redeemer_merchant_id === context.merchant_id) && (cp.inline || activeCampaigns.some(c => c.campaign_id === cp.campaign_id)));
    for (const cp of avail.slice(0, 2)) hints.push({ type: 'coupon_available', campaign_id: cp.campaign_id || `coupon:${normCode(cp.code)}`, text: `У вас есть купон «${cp.title || cp.code}» — применить?`, details: { code: cp.code, expires_at: cp.expires_at || null } });
  }
  // сгорающие баллы
  if (customer && redeemed === 0) {
    const soon = (state.lots || []).filter(l => l.amount_left > 0 && l.expires_at && (new Date(l.expires_at) - new Date(nowIso)) / 86400000 <= 7);
    const pts = soon.reduce((s, l) => s + l.amount_left, 0);
    if (pts > 0) hints.push({ type: 'points_expiring', campaign_id: null, text: `${pts} ${plural(pts, 'балл', 'балла', 'баллов')} сгорит скоро — спишите сейчас`, details: { points: pts, expires_at: soon.map(l => l.expires_at).sort()[0] } });
  }

  // 7. explain
  const explainMain = [];
  for (const c of candidates) {
    const isApplied = applied.some(a => a.campaign_id === c.campaign_id);
    explainMain.push({ campaign_id: c.campaign_id, name: c.spec.name, result: isApplied ? 'applied' : 'skipped', reason: isApplied ? undefined : (skipped.get(c.campaign_id) || 'no_effect') });
  }

  // 8. result
  const lots = applied.filter(a => a.action_type !== 'notify' && a.points > 0 && (a.details.to || 'customer') === 'customer').map(a => ({ label: a.details.lot_label || a.title, points: a.points, expires_at: a.details.expires_at || null, funding: a.funding, campaign_id: a.campaign_id }));
  const pointsToAccrue = lots.reduce((s, l) => s + l.points, 0);
  const result = {
    engine_version: ENGINE_VERSION,
    gross_total_minor: gross,
    discount_total_minor: discountTotal,
    after_discounts_minor: afterDiscounts,
    points_redeemed: redeemed,
    points_redeem_max: redeemMax,
    paid_money_minor: paidMoney,
    reward_base_minor: rewardBase,
    points_to_accrue: pointsToAccrue,
    lots_to_accrue: lots,
    lots_to_redeem: lotsToRedeem,
    applied: applied.map(a => ({ ...a })),
    hints,
    stamps: stampsOut,
    coupon: coupon.code ? { code: coupon.code, valid: coupon.valid, reason: coupon.valid ? undefined : (coupon.reason || 'not_found'), campaign_id: coupon.campaign_id } : null,
    coupons_issued: couponsIssued,
    notifications,
    deferred,
    lines: lines.map(l => ({ sku: l.sku, name: l.name, category: l.category, qty: l.qty, price_minor: l.price_minor, discount_minor: l.discount_minor, final_minor: lineNet(l), added: l.added || undefined })),
    cost_minor: [...applyCost.values()].reduce((s, v) => s + v, 0),
    explain: explainMain.concat(explain),
    local: { date: ctx.date, time: ctx.time, weekday: ctx.weekday, timezone: timeZone },
  };
  if (input.options && input.options.issue_quote_id) {
    result.quote_id = sha256Hex(`${context.order_id || ''}:${nowIso}:${JSON.stringify(context.items)}`).slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    result.expires_at = formatInTz(new Date(new Date(nowIso).getTime() + settings.quote_ttl_min * 60000), timeZone);
  }
  return result;
}

// ───────────────────────────── COMMIT (модель состояния) ─────────────────────────────

/**
 * commit({ campaigns, context, settings }, quoteResult) → { state, customer, campaigns, order }
 * Чистая функция: возвращает новые копии состояния клиента и кампаний после оплаты чека.
 * Идемпотентность по order_id: если state.orders содержит order_id — возвращает без изменений.
 */
export function commit(input, result) {
  const context = input.context;
  const nowIso = context.now;
  const timeZone = result.local ? result.local.timezone : 'Europe/Moscow';
  const ctx = localContext(nowIso, timeZone);
  const state = JSON.parse(JSON.stringify({ stamps: {}, counters: {}, subscriptions: [], challenges: {}, coupons: [], lots: [], orders: [], ...(context.state || {}) }));
  const customer = context.customer ? { ...context.customer } : null;
  const campaigns = (input.campaigns || []).map(c => ({ ...c }));
  const orderId = context.order_id || `ord_${sha256Hex(nowIso + JSON.stringify(context.items)).slice(0, 10)}`;
  if (state.orders.some(o => o.order_id === orderId)) return { state, customer, campaigns, order: state.orders.find(o => o.order_id === orderId), idempotent: true };

  const touched = new Set();
  for (const a of result.applied) {
    if (a.campaign_id === 'platform_base' || a.campaign_id.startsWith('coupon:')) continue;
    touched.add(a.campaign_id);
    const camp = campaigns.find(c => c.campaign_id === a.campaign_id);
    if (camp) {
      camp.budget_used_minor = (camp.budget_used_minor || 0) + (a.cost_minor || 0);
      camp.budget_used_today_minor = (camp.budget_used_today_minor || 0) + (a.cost_minor || 0);
      const lim = camp.spec.limits || {};
      if ((lim.budget_total_minor != null && camp.budget_used_minor >= lim.budget_total_minor) || (lim.budget_daily_minor != null && camp.budget_used_today_minor >= lim.budget_daily_minor)) camp.status = 'paused_budget';
    }
    if (a.action_type === 'stamp') {
      const d = a.details;
      state.stamps[d.card] = d.completed ? { count: d.next_card_count || 0, last_at: nowIso, pending_reward: d.reward && d.reward.applied === 'next_order', completed_cards: ((state.stamps[d.card] || {}).completed_cards || 0) + 1 } : { ...(state.stamps[d.card] || {}), count: d.after, last_at: nowIso, pending_reward: false };
    }
    if (a.details && a.details.stamp_card_reward) state.stamps[a.details.stamp_card_reward] = { ...(state.stamps[a.details.stamp_card_reward] || {}), pending_reward: false };
    if (a.action_type === 'challenge_progress') {
      const d = a.details;
      const prev = state.challenges[d.challenge] || {};
      state.challenges[d.challenge] = d.completed ? { value: 0, started_at: null, skus: [], weeks: [], completed_count: (prev.completed_count || 0) + 1, pending_reward: d.reward && d.reward.applied === 'next_order' } : { value: d.after, started_at: d.restarted || !prev.started_at ? nowIso : prev.started_at, skus: [...new Set([...(d.restarted ? [] : prev.skus || []), ...result.lines.map(l => l.sku)])], weeks: [...new Set([...(d.restarted ? [] : prev.weeks || []), ctx.week])] };
    }
    if (a.action_type === 'random_reward') { const k = `${a.campaign_id}:prize:${a.details.index}:${ctx.date}`; state.counters[k] = (state.counters[k] || 0) + 1; }
    if (a.action_type === 'coupon_issue') { const k = `${a.campaign_id}:coupon_out:${ctx.week}`; state.counters[k] = (state.counters[k] || 0) + 1; }
    if (a.action_type === 'redeem_subscription_unit') {
      const sub = state.subscriptions.find(s => s.plan_id === a.details.plan_id);
      if (sub && sub.units_left != null) sub.units_left -= a.details.units_used;
      if (sub) sub.used_today = (sub.used_today || 0) + a.details.units_used;
    }
  }
  for (const cid of touched) {
    const camp = campaigns.find(c => c.campaign_id === cid);
    if (camp) camp.uses_total = (camp.uses_total || 0) + 1;
    for (const period of ['day', 'week', 'month', 'campaign']) { const k = counterKey(cid, period, ctx); state.counters[k] = (state.counters[k] || 0) + 1; }
  }
  // списание лотов
  for (const r of result.lots_to_redeem) {
    let left = r.points;
    for (const l of state.lots) {
      if (left <= 0) break;
      if (r.lot_id ? l.lot_id === r.lot_id : (!l.expires_at)) { const take = Math.min(left, l.amount_left); l.amount_left -= take; left -= take; }
    }
    if (left > 0) { const base = state.lots.find(l => !l.expires_at); if (base) base.amount_left -= left; else state.lots.push({ lot_id: 'lot_base', label: 'Баллы LOVII', amount: 0, amount_left: -left, expires_at: null, funding: 'platform', merchant_id: null }); }
  }
  // начисление лотов
  result.lots_to_accrue.forEach((l, i) => {
    state.lots.push({ lot_id: `lot_${sha256Hex(`${orderId}:${l.campaign_id}:${i}`).slice(0, 8)}`, label: l.label, amount: l.points, amount_left: l.points, expires_at: l.expires_at, funding: l.funding, merchant_id: l.funding === 'platform' ? null : context.merchant_id, campaign_id: l.campaign_id, order_id: orderId, accrued_at: nowIso });
  });
  // купоны
  if (result.coupon && result.coupon.valid) { const cp = state.coupons.find(x => normCode(x.code) === result.coupon.code); if (cp) { cp.used = true; cp.used_at = nowIso; cp.used_order_id = orderId; } }
  for (const cp of result.coupons_issued) if ((cp.to || 'customer') === 'customer') state.coupons.push({ ...cp, issued_at: nowIso, used: false });
  // профиль
  if (customer) {
    customer.orders_at_merchant = (customer.orders_at_merchant || 0) + 1;
    customer.days_since_last_purchase = 0;
    customer.visits_30d = (customer.visits_30d || 0) + 1;
    customer.spent_90d = (customer.spent_90d || 0) + result.paid_money_minor;
    customer.points_balance = state.lots.reduce((s, l) => s + l.amount_left, 0);
    customer.segments = (customer.segments || []).filter(s => s !== 'sleeping' && s !== 'new');
    if (!customer.segments.includes('regular') && customer.orders_at_merchant >= 2) customer.segments.push('regular');
    if (customer.orders_at_merchant === 1) customer.segments.push('new');
  }
  const order = { order_id: orderId, committed_at: nowIso, merchant_id: context.merchant_id, customer_id: customer ? customer.id : null, gross_total_minor: result.gross_total_minor, discount_total_minor: result.discount_total_minor, points_redeemed: result.points_redeemed, paid_money_minor: result.paid_money_minor, points_accrued: result.points_to_accrue, cost_minor: result.cost_minor, applied: result.applied.map(a => ({ campaign_id: a.campaign_id, action_type: a.action_type, points: a.points, discount_minor: a.discount_minor })), lines: result.lines };
  state.orders.push(order);
  return { state, customer, campaigns, order, idempotent: false };
}

// ───────────────────────────── ПЛАНИРОВЩИК (inactivity / birthday) ─────────────────────────────

/**
 * runScheduler({ campaigns, customers:[{customer, state}], now, merchant_id }) → [{ customer_id, campaign_id, issued:{lots, coupons, notifications} }]
 * Идемпотентность: ключ `${campaign_id}:sched:${customer_id}:${period}` в state.counters.
 */
export function runScheduler({ campaigns, customers, now, merchant_id, settings }) {
  const cfg = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const out = [];
  for (const c of (campaigns || []).filter(c => !c.status || c.status === 'active')) {
    const t = c.spec.trigger || {};
    if (!['inactivity', 'birthday'].includes(t.type)) continue;
    const timeZone = (c.spec.schedule && c.spec.schedule.timezone) || 'Europe/Moscow';
    const ctx = localContext(now, timeZone);
    for (const rec of customers) {
      const customer = rec.customer; const state = rec.state;
      if (!customer) continue;
      const reason = preselect(c, c.spec, { context: { now } }, { ...ctx, channel: 'system' }, customer, state);
      if (reason) continue;
      const p = t.params || {};
      if (t.type === 'inactivity' && !(customer.days_since_last_purchase != null && customer.days_since_last_purchase >= (p.days || 30))) continue;
      if (t.type === 'inactivity' && p.min_orders != null && (customer.orders_at_merchant || 0) < p.min_orders) continue;
      if (t.type === 'birthday' && !(customer.birthday_in_days != null && customer.birthday_in_days <= (p.days_before != null ? p.days_before : 5) && customer.birthday_in_days >= -((p.window_days || 10) - (p.days_before != null ? p.days_before : 5)))) continue;
      const env = { lines: [], gross: 0, after_discounts: 0, paid_money: 0, reward_base: 0, customer, ctx, state, nowIso: now, coupon: { valid: false, code: null } };
      if (firstFailedCondition(c.spec.conditions, env) >= 0) continue;
      const idemKey = `${c.campaign_id}:sched:${customer.id}:${t.type === 'birthday' ? ctx.date.slice(0, 4) : `${p.step || 0}`}`;
      if ((state.counters || {})[idemKey]) continue;
      const issued = { lots: [], coupons: [], notifications: [] };
      (c.spec.actions || []).forEach((a, i) => {
        if (a.type === 'accrue_points') {
          const { points } = computeAccrual(a, cfg, env);
          if (points > 0) issued.lots.push({ lot_id: `lot_${sha256Hex(`${idemKey}:${i}`).slice(0, 8)}`, label: a.lot_label || (c.spec.content || {}).title || c.spec.name, amount: points, amount_left: points, expires_at: a.ttl_days ? addDaysIso(now, a.ttl_days, timeZone) : null, funding: a.funding, merchant_id: merchant_id, campaign_id: c.campaign_id, accrued_at: now });
        } else if (a.type === 'coupon_issue') {
          const code = couponCode(`${idemKey}:${i}`);
          issued.coupons.push({ code, campaign_id: a.redeem_campaign_id || null, title: (c.spec.content || {}).title || c.spec.name, inline: a.inline || null, ttl_days: a.ttl_days, expires_at: addDaysIso(now, a.ttl_days, timeZone), to: 'customer', redeemer_merchant_id: a.redeemer_merchant_id || merchant_id, issued_by: c.campaign_id, issued_at: now, used: false, template_id: (c.spec.meta || {}).template_id || null });
        } else if (a.type === 'notify') {
          issued.notifications.push({ campaign_id: c.campaign_id, channel: a.channel, template: a.template, params: a.params || {} });
        }
      });
      state.counters = state.counters || {};
      state.counters[idemKey] = 1;
      state.lots = (state.lots || []).concat(issued.lots);
      state.coupons = (state.coupons || []).concat(issued.coupons);
      customer.points_balance = state.lots.reduce((s, l) => s + l.amount_left, 0);
      out.push({ customer_id: customer.id, campaign_id: c.campaign_id, issued });
    }
  }
  return out;
}

// ───────────────────────────── ОФФЕРЫ ДЛЯ ВИТРИНЫ ─────────────────────────────

/** Список предложений точки для клиента (карточка точки / «Акции рядом»). */
export function offersFor({ campaigns, customer, state, now, merchant_id }) {
  const out = [];
  for (const c of (campaigns || []).filter(c => !c.status || c.status === 'active')) {
    const spec = c.spec;
    if (spec.channels && spec.channels.showcase === false) continue;
    if (spec.mechanic === 'platform_base') continue;
    const timeZone = (spec.schedule && spec.schedule.timezone) || 'Europe/Moscow';
    const ctx = { ...localContext(now, timeZone), channel: 'qr' };
    const reason = preselect(c, spec, { context: { now } }, ctx, customer, state || {});
    if (reason && !['window', 'limit_per_customer', 'guest'].includes(reason)) continue;
    const content = spec.content || {};
    const offer = { campaign_id: c.campaign_id, mechanic: spec.mechanic, title: content.title || spec.name, badge: content.badge || null, subtitle: content.subtitle || null, terms: content.terms || null, active_now: !reason, trigger: (spec.trigger || {}).type };
    if (spec.schedule && spec.schedule.windows && spec.schedule.windows.length) {
      const w = spec.schedule.windows.find(w => w.days.includes(ctx.weekday) && ctx.time >= w.from && ctx.time < w.to);
      if (w) { const [h, m] = w.to.split(':').map(Number); const [ch, cm] = ctx.time.split(':').map(Number); offer.window_ends_in_min = (h * 60 + m) - (ch * 60 + cm); }
      offer.windows = spec.schedule.windows;
    }
    const stampAction = (spec.actions || []).find(a => a.type === 'stamp');
    if (stampAction) { const card = (state && state.stamps && state.stamps[stampAction.card]) || null; offer.progress = { current: card ? card.count || 0 : (stampAction.start_bonus || 0), target: stampAction.target, pending_reward: !!(card && card.pending_reward) }; }
    const chAction = (spec.actions || []).find(a => a.type === 'challenge_progress');
    if (chAction) { const ch = (state && state.challenges && state.challenges[chAction.challenge]) || null; offer.progress = { current: ch ? ch.value || 0 : 0, target: chAction.target }; }
    out.push(offer);
  }
  return out;
}

export default { quote, commit, runScheduler, offersFor, DEFAULT_SETTINGS, ENGINE_VERSION };

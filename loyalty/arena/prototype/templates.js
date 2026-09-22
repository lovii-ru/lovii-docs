/*
 * Шаблоны механик LM-01…LM-18 (docs/lovii-loyalty-constructor/02-mechanics-catalog.md).
 * Каждый шаблон: params_schema (форма мастера), defaults(ctx), compile(params) → Spec,
 * preview(params), estimate(params, stats). Интерфейс — 03-rules-engine.md §8.
 *
 * Расширения JSON Schema для генератора формы: x-widget (money|percent|int|days|minutes|text|select|bool|
 * category|categories|sku|merchant|rows|time|date), x-enumNames, x-columns (для rows), x-unit, x-help, x-pro.
 */

export const CATEGORY_LABELS = {
  coffee: 'кофе', tea: 'чай', bakery: 'выпечка', dessert: 'десерты', breakfast: 'завтраки', drinks: 'напитки',
  sets: 'сеты', rolls: 'роллы', care: 'уход', haircut: 'стрижка', nails: 'маникюр', flowers: 'букеты', gift_card: 'сертификаты',
};

export const GOALS = {
  check: 'Средний чек', frequency: 'Частота визитов', acquisition: 'Новые клиенты', reactivation: 'Вернуть уснувших', engagement: 'Вовлечение', prepay: 'Предоплата',
};

export const CATEGORY_SINGULAR = { coffee: 'кофе', tea: 'чай', bakery: 'выпечка', dessert: 'десерт', breakfast: 'завтрак', drinks: 'напиток', sets: 'сет', rolls: 'ролл', care: 'уход', haircut: 'стрижка', nails: 'маникюр', flowers: 'букет', gift_card: 'сертификат' };

const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
/** Идентификатор [a-z0-9_] из произвольного названия (транслитерация кириллицы). */
export const slug = (str) => String(str).toLowerCase().split('').map(ch => TRANSLIT[ch] != null ? TRANSLIT[ch] : ch).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';

const TZ = 'Europe/Moscow';
const rub = (minor) => Math.floor(minor / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0₽';
const pct = (p) => String(p).replace('.', ',') + '\u00a0%';
const catLabel = (c) => CATEGORY_LABELS[c] || c;
const catOne = (c) => CATEGORY_SINGULAR[c] || CATEGORY_LABELS[c] || c;
const roundTo = (minor, step) => Math.ceil(minor / step) * step;
const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return one; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few; return many; };
const pts = (n) => `${n} ${plural(n, 'балл', 'балла', 'баллов')}`;

// доля чеков ≥ T при среднем чеке avg (эвристика распределения чеков)
const shareAbove = (T, avg) => Math.min(1, Math.max(0.02, Math.exp(-0.85 * (T / Math.max(avg, 1)))));

const P = {
  money: (title, def, extra = {}) => ({ type: 'integer', title, default: def, minimum: 0, 'x-widget': 'money', ...extra }),
  percent: (title, def, extra = {}) => ({ type: 'number', title, default: def, minimum: 0, maximum: 100, 'x-widget': 'percent', ...extra }),
  int: (title, def, extra = {}) => ({ type: 'integer', title, default: def, minimum: 0, 'x-widget': 'int', ...extra }),
  days: (title, def, extra = {}) => ({ type: 'integer', title, default: def, minimum: 1, maximum: 730, 'x-widget': 'days', ...extra }),
  select: (title, values, names, def, extra = {}) => ({ type: 'string', title, enum: values, 'x-enumNames': names, default: def, 'x-widget': 'select', ...extra }),
  bool: (title, def, extra = {}) => ({ type: 'boolean', title, default: def, 'x-widget': 'bool', ...extra }),
  text: (title, def, extra = {}) => ({ type: 'string', title, default: def, 'x-widget': 'text', ...extra }),
  category: (title, def, extra = {}) => ({ type: 'string', title, default: def, 'x-widget': 'category', ...extra }),
  categories: (title, def, extra = {}) => ({ type: 'array', items: { type: 'string' }, title, default: def, 'x-widget': 'categories', ...extra }),
  sku: (title, def, extra = {}) => ({ type: 'string', title, default: def, 'x-widget': 'sku', ...extra }),
  rows: (title, columns, def, extra = {}) => ({ type: 'array', title, default: def, 'x-widget': 'rows', 'x-columns': columns, ...extra }),
  holdout: () => ({ type: 'integer', title: 'Контрольная группа', default: 10, minimum: 0, maximum: 50, 'x-widget': 'percent', 'x-help': 'Часть клиентов не увидит акцию — так мы честно измерим эффект.' }),
  budget: (def) => ({ type: 'integer', title: 'Бюджет кампании', default: def, minimum: 0, 'x-widget': 'money', 'x-help': 'При исчерпании кампания встанет на паузу. 0 — без ограничения.' }),
};

const WINDOW_PRESETS = { daily: [1, 2, 3, 4, 5, 6, 7], weekdays: [1, 2, 3, 4, 5], weekend: [6, 7] };
const WINDOW_NAMES = { daily: 'ежедневно', weekdays: 'будни', weekend: 'выходные' };
const windowColumns = [
  { key: 'days', title: 'Дни', widget: 'select', enum: ['daily', 'weekdays', 'weekend'], enumNames: ['Ежедневно', 'Будни', 'Выходные'] },
  { key: 'from', title: 'С', widget: 'time' }, { key: 'to', title: 'До', widget: 'time' },
];
const compileWindows = (rows) => (rows || []).map(r => ({ days: WINDOW_PRESETS[r.days] || WINDOW_PRESETS.daily, from: r.from, to: r.to }));
const windowsText = (rows) => (rows || []).map(r => `${WINDOW_NAMES[r.days] || 'ежедневно'} ${r.from}–${r.to}`).join(', ');

const base = (t, params, over) => ({
  spec_version: '1.0', mechanic: t.mechanic, name: over.name, priority: over.priority != null ? over.priority : 100,
  stacking: over.stacking, schedule: { starts_at: null, ends_at: null, timezone: TZ, windows: over.windows || [] },
  audience: { segments: over.segments || ['all'], statuses: over.statuses || [], tiers: [], exclude_staff: true, holdout_pct: over.holdout != null ? over.holdout : (params.holdout_pct != null ? params.holdout_pct : 0) },
  trigger: over.trigger || { type: 'purchase' }, conditions: over.conditions || [], actions: over.actions,
  limits: { per_customer: over.per_customer === undefined ? { count: 1, period: 'day' } : over.per_customer, total_uses: over.total_uses || null, budget_total_minor: params.budget_total_minor ? params.budget_total_minor : null, budget_daily_minor: over.budget_daily_minor || null },
  content: over.content, channels: { showcase: true, checkout: true, push: !!over.push, cashier: true },
  meta: { template_id: t.id, template_params: params, ...(over.meta || {}) },
});

const drinkFilter = (cats) => ({ category: { in: cats } });

export const TEMPLATES = [
  // ───────── LM-01 ─────────
  {
    id: 'lm-01', mechanic: 'threshold', title: 'Порог чека', short: '«До подарка осталось…»', goal: 'check', tier: 'free', stage: 'MVP', complexity: 'S', icon: '🎯',
    summary: 'Награда при чеке от суммы X. Главное — прогресс-бар и подсказка «добавьте круассан».',
    params_schema: { type: 'object', required: ['threshold_minor', 'reward_type'], properties: {
      threshold_minor: P.money('Порог чека', 45000, { 'x-help': 'Рекомендуем 1,2–1,6 × средний чек' }),
      reward_type: P.select('Тип награды', ['points', 'discount', 'free_item'], ['Промо-баллы', 'Скидка на чек', 'Товар в подарок'], 'points'),
      reward_points: P.int('Баллов', 60, { 'x-showIf': { reward_type: 'points' } }),
      discount_pct: P.percent('Скидка', 10, { 'x-showIf': { reward_type: 'discount' } }),
      free_sku: P.sku('Товар-подарок', 'cd3', { 'x-showIf': { reward_type: 'free_item' } }),
      ttl_days: P.days('Срок промо-баллов', 14, { 'x-showIf': { reward_type: 'points' } }),
      per_day: P.int('Срабатываний на клиента в день', 2, { minimum: 1, maximum: 5 }),
      holdout_pct: P.holdout(), budget_total_minor: P.budget(3000000),
    } },
    defaults: (ctx) => { const th = roundTo(ctx.avg_check_minor * 1.3, 5000); return { threshold_minor: th, reward_type: 'points', reward_points: Math.max(20, Math.round(th * 0.13 / 100 / 10) * 10), discount_pct: 10, free_sku: ctx.cheap_sku || 'cd3', ttl_days: 14, per_day: 2, holdout_pct: 10, budget_total_minor: 3000000 }; },
    compile(p) {
      const t = this;
      const rewardLabel = p.reward_type === 'points' ? `+${p.reward_points} б.` : p.reward_type === 'discount' ? `−${pct(p.discount_pct)}` : 'подарок';
      const title = p.reward_type === 'points' ? `От ${rub(p.threshold_minor)} — +${pts(p.reward_points)}` : p.reward_type === 'discount' ? `От ${rub(p.threshold_minor)} — скидка ${pct(p.discount_pct)}` : `От ${rub(p.threshold_minor)} — подарок`;
      const actions = p.reward_type === 'points' ? [{ type: 'accrue_points', mode: 'fixed', amount: p.reward_points, ttl_days: p.ttl_days, funding: 'merchant', lot_label: title }]
        : p.reward_type === 'discount' ? [{ type: 'discount', scope: 'basket', mode: 'percent', value: p.discount_pct }]
        : [{ type: 'free_item', sku: p.free_sku, qty: 1, add_if_missing: true }];
      const stacking = p.reward_type === 'points' ? { group: 'bonus', mode: 'exclusive' } : p.reward_type === 'discount' ? { group: 'basket_discount', mode: 'exclusive' } : { group: 'item_price', mode: 'stackable' };
      return base(t, p, { name: title, priority: 100, stacking, conditions: [{ field: p.reward_type === 'points' ? 'basket.paid_money' : 'basket.gross_total', op: '>=', value: p.threshold_minor }], actions,
        per_customer: { count: p.per_day || 2, period: 'day' },
        content: { title, badge: rewardLabel, subtitle: p.reward_type === 'points' ? `Промо-баллы действуют ${p.ttl_days} ${plural(p.ttl_days, 'день', 'дня', 'дней')}` : 'Применяется автоматически на кассе', cta: 'Добрать до порога', terms: 'Порог считается по сумме, оплаченной деньгами, после скидок. Не более двух срабатываний в день. При возврате чека награда аннулируется.' } });
    },
    preview: (p) => ({ title: p.reward_type === 'points' ? `От ${rub(p.threshold_minor)} — +${pts(p.reward_points)}` : `От ${rub(p.threshold_minor)} — награда`, badge: p.reward_type === 'points' ? `+${p.reward_points} б.` : '🎁', subtitle: 'До подарка осталось {remaining} ₽' }),
    estimate(p, s) {
      const share = shareAbove(p.threshold_minor, s.avg_check_minor) * 1.25; // «дотягиваются» + инкремент
      const eligible = Math.round(s.orders_month * Math.min(share, 0.6));
      const value = p.reward_type === 'points' ? p.reward_points * 100 * 0.7 : p.reward_type === 'discount' ? p.threshold_minor * p.discount_pct / 100 : (s.free_item_price_minor || 15000);
      return { cost_month_minor: Math.round(eligible * value), eligible_orders_month: eligible, note: `≈ ${Math.round(share * 100)}\u00a0% чеков пересекут порог`, risk: p.threshold_minor > s.avg_check_minor * 1.8 ? 'high' : 'low' };
    },
  },
  // ───────── LM-02 ─────────
  {
    id: 'lm-02', mechanic: 'bundle', title: 'Наборы и комбо', short: 'Кофе + круассан = 349 ₽', goal: 'check', tier: 'pro', stage: 'V2', complexity: 'M', icon: '🥐',
    summary: 'Правило на состав корзины: фикс. цена набора, % скидки или самый дешёвый бесплатно. Без перезаведения номенклатуры.',
    params_schema: { type: 'object', required: ['group_a', 'group_b', 'price_mode'], properties: {
      group_a: P.category('Якорь (категория)', 'coffee'), qty_a: P.int('Кол-во', 1, { minimum: 1, maximum: 5 }),
      group_b: P.category('Дополнение (категория)', 'bakery'), qty_b: P.int('Кол-во', 1, { minimum: 1, maximum: 5 }),
      price_mode: P.select('Цена набора', ['fixed', 'percent', 'cheapest_free'], ['Фиксированная цена', 'Скидка %', 'Самый дешёвый бесплатно'], 'fixed'),
      bundle_price_minor: P.money('Цена набора', 34900, { 'x-showIf': { price_mode: 'fixed' } }),
      discount_pct: P.percent('Скидка на набор', 15, { 'x-showIf': { price_mode: 'percent' } }),
      max_sets: P.int('Макс. наборов в чеке', 1, { minimum: 1, maximum: 5 }),
      windows: P.rows('Только в часы (пусто = всегда)', windowColumns, []),
      holdout_pct: P.holdout(),
    } },
    defaults: () => ({ group_a: 'coffee', qty_a: 1, group_b: 'bakery', qty_b: 1, price_mode: 'fixed', bundle_price_minor: 34900, discount_pct: 15, max_sets: 1, windows: [{ days: 'daily', from: '08:00', to: '11:00' }], holdout_pct: 10 }),
    compile(p) {
      const name = `${catLabel(p.group_a)} + ${catLabel(p.group_b)}`.replace(/^./, s => s.toUpperCase());
      const title = p.price_mode === 'fixed' ? `${name} = ${rub(p.bundle_price_minor)}` : p.price_mode === 'percent' ? `${name} — ${pct(p.discount_pct)}` : `${name}: дешёвый бесплатно`;
      const action = { type: 'discount', scope: 'bundle', mode: p.price_mode, value: p.price_mode === 'fixed' ? p.bundle_price_minor : p.price_mode === 'percent' ? p.discount_pct : 0,
        bundle: { groups: [{ name: catLabel(p.group_a), filter: { category: { in: [p.group_a] } }, qty: p.qty_a || 1 }, { name: catLabel(p.group_b), filter: { category: { in: [p.group_b] } }, qty: p.qty_b || 1 }], max_sets: p.max_sets || 1 } };
      return base(this, p, { name: title, priority: 150, stacking: { group: 'item_price', mode: 'exclusive' }, windows: compileWindows(p.windows),
        conditions: [{ field: 'basket.items', op: 'count_gte', match: { category: { in: [p.group_a] } }, value: p.qty_a || 1 }, { field: 'basket.items', op: 'count_gte', match: { category: { in: [p.group_b] } }, value: p.qty_b || 1 }],
        actions: [action], per_customer: null,
        content: { title, badge: 'Комбо', subtitle: p.windows && p.windows.length ? windowsText(p.windows) : 'Применяется автоматически', terms: 'Набор собирается из самых дешёвых подходящих позиций чека. При возврате компонента набор пересчитывается.' } });
    },
    preview: (p) => ({ title: `${catLabel(p.group_a)} + ${catLabel(p.group_b)}`, badge: 'Комбо', subtitle: p.price_mode === 'fixed' ? `за ${rub(p.bundle_price_minor)}` : p.price_mode === 'percent' ? `−${pct(p.discount_pct)}` : 'дешёвый бесплатно' }),
    estimate: (p, s) => { const attach = Math.round(s.orders_month * 0.18); const disc = p.price_mode === 'fixed' ? Math.max(0, (s.avg_check_minor * 1.2) - p.bundle_price_minor) : p.price_mode === 'percent' ? s.avg_check_minor * 1.2 * p.discount_pct / 100 : s.avg_check_minor * 0.45; return { cost_month_minor: Math.round(attach * disc), eligible_orders_month: attach, note: 'Ожидаемый attach rate дополнения ≈ 18 %', risk: 'low' }; },
  },
  // ───────── LM-03 ─────────
  {
    id: 'lm-03', mechanic: 'addon', title: 'Апселл на кассе', short: '«Добавьте чизкейк за 199 ₽»', goal: 'check', tier: 'free', stage: 'MVP', complexity: 'S', icon: '➕',
    summary: 'Если в чеке есть товар-триггер — предложить дополнение по спеццене. Одна подсказка на чек.',
    params_schema: { type: 'object', required: ['trigger_category', 'offer_sku', 'special_price_minor'], properties: {
      trigger_category: P.category('Триггер (категория в чеке)', 'coffee'),
      offer_sku: P.sku('Товар-предложение', 'cd8'),
      special_price_minor: P.money('Спеццена', 19900, { 'x-help': 'Не ниже себестоимости + 20 %' }),
      max_qty: P.int('Макс. штук по спеццене', 1, { minimum: 1, maximum: 3 }),
      holdout_pct: P.holdout(),
    } },
    defaults: (ctx) => ({ trigger_category: ctx.category || 'coffee', offer_sku: ctx.upsell_sku || 'cd8', special_price_minor: ctx.upsell_price_minor || 19900, max_qty: 1, holdout_pct: 10 }),
    compile(p) {
      const name = p.offer_name || p.offer_sku;
      const title = `${name} за ${rub(p.special_price_minor)} к ${catLabel(p.trigger_category)}`.replace(/^./, s => s.toUpperCase());
      return base(this, p, { name: title, priority: 140, stacking: { group: 'item_price', mode: 'stackable' },
        conditions: [{ field: 'basket.items', op: 'any', match: { category: { in: [p.trigger_category] } }, min_qty: 1 }],
        actions: [{ type: 'discount', scope: 'item', mode: 'to_price', value: p.special_price_minor, max_qty: p.max_qty || 1, filter: { sku: { in: [p.offer_sku] } } }],
        per_customer: null,
        content: { title, badge: 'Спеццена', subtitle: `Только вместе с ${catLabel(p.trigger_category)}`, cta: 'Добавить', terms: 'Спеццена действует на 1 шт. в чеке при наличии товара-триггера.' } });
    },
    preview: (p) => ({ title: `${p.offer_name || p.offer_sku} за ${rub(p.special_price_minor)}`, badge: 'Спеццена', subtitle: `к ${catLabel(p.trigger_category)}` }),
    estimate: (p, s) => { const take = Math.round(s.orders_month * 0.55 * 0.12); const disc = Math.max(0, (s.upsell_list_price_minor || 32000) - p.special_price_minor); return { cost_month_minor: take * disc, eligible_orders_month: take, note: 'Take rate предложения ≈ 12 % чеков с триггером; чек растёт на спеццену', risk: 'low' }; },
  },
  // ───────── LM-04 ─────────
  {
    id: 'lm-04', mechanic: 'cashback', title: 'Конструктор кэшбэка', short: 'Плоский · лестница · категории · статусы', goal: 'frequency', tier: 'free', stage: 'MVP', complexity: 'M', icon: '💸',
    summary: 'Повышенный кэшбэк промо-баллами поверх базового платформенного. Четыре режима.',
    params_schema: { type: 'object', required: ['mode'], properties: {
      mode: P.select('Режим', ['flat', 'ladder', 'by_category', 'by_status'], ['Плоский % на чек', 'Лестница по сумме (PRO)', 'По категориям (PRO)', 'Надбавка по статусу (PRO)'], 'flat'),
      percent: P.percent('Кэшбэк', 5, { 'x-showIf': { mode: ['flat', 'by_status'] }, 'x-help': 'При марже 60 % безопасно до 10 %' }),
      steps: P.rows('Ступени', [{ key: 'from_minor', title: 'Чек от', widget: 'money' }, { key: 'percent', title: '%', widget: 'percent' }], [{ from_minor: 30000, percent: 3 }, { from_minor: 60000, percent: 5 }, { from_minor: 100000, percent: 8 }], { 'x-showIf': { mode: 'ladder' } }),
      categories: P.rows('Категории', [{ key: 'category', title: 'Категория', widget: 'category' }, { key: 'percent', title: '%', widget: 'percent' }], [{ category: 'dessert', percent: 10 }, { category: 'coffee', percent: 3 }], { 'x-showIf': { mode: 'by_category' } }),
      status_min: P.select('Статус от', ['PASS', 'VIP'], ['PASS и VIP', 'Только VIP'], 'PASS', { 'x-showIf': { mode: 'by_status' } }),
      cap: P.int('Максимум баллов за чек', 300, { minimum: 0 }),
      ttl_days: P.days('Срок промо-баллов', 30),
      holdout_pct: P.holdout(),
    } },
    defaults: (ctx) => ({ mode: 'flat', percent: 5, steps: [{ from_minor: roundTo(ctx.avg_check_minor, 5000), percent: 3 }, { from_minor: roundTo(ctx.avg_check_minor * 2, 5000), percent: 5 }, { from_minor: roundTo(ctx.avg_check_minor * 3, 5000), percent: 8 }], categories: [{ category: ctx.margin_category || 'dessert', percent: 10 }, { category: ctx.category || 'coffee', percent: 3 }], status_min: 'PASS', cap: 300, ttl_days: 30, holdout_pct: 10 }),
    compile(p) {
      let action, title, badge, subtitle, statuses = [];
      const common = { type: 'accrue_points', base: 'paid_money', cap: p.cap || undefined, ttl_days: p.ttl_days, funding: 'merchant' };
      if (p.mode === 'flat') { action = { ...common, mode: 'percent', percent: p.percent }; title = `Кэшбэк ${pct(p.percent)} баллами`; badge = `+${pct(p.percent)}`; subtitle = 'Сверх базового кэшбэка LOVII'; }
      else if (p.mode === 'ladder') { const steps = (p.steps || []).slice().sort((a, b) => a.from_minor - b.from_minor); action = { ...common, mode: 'ladder', steps: steps.map(s => ({ from_minor: s.from_minor, percent: s.percent })) }; title = `Кэшбэк до ${pct(steps[steps.length - 1].percent)} — чем больше чек, тем выше`; badge = `до ${pct(steps[steps.length - 1].percent)}`; subtitle = steps.map(s => `от ${rub(s.from_minor)} — ${pct(s.percent)}`).join(' · '); }
      else if (p.mode === 'by_category') { const cats = {}; (p.categories || []).forEach(c => { cats[c.category] = c.percent; }); action = { ...common, mode: 'by_category', base: 'eligible_amount', categories: cats }; title = `Кэшбэк по категориям: ${(p.categories || []).map(c => `${catLabel(c.category)} ${pct(c.percent)}`).join(', ')}`; badge = `до ${pct(Math.max(...(p.categories || []).map(c => c.percent)))}`; subtitle = 'Начисляется на позиции категорий'; }
      else { action = { ...common, mode: 'percent', percent: p.percent }; statuses = p.status_min === 'VIP' ? ['VIP'] : ['PASS', 'VIP']; title = `+${pct(p.percent)} кэшбэка для ${p.status_min === 'VIP' ? 'VIP' : 'PASS и VIP'}`; badge = `+${pct(p.percent)} ${p.status_min}`; subtitle = 'Надбавка для статуса LOVII'; }
      Object.keys(action).forEach(k => action[k] === undefined && delete action[k]);
      action.lot_label = 'Кэшбэк точки';
      return base(this, p, { name: title, priority: 100, stacking: { group: 'cashback', mode: 'stackable' }, statuses, actions: [action], per_customer: { count: 5, period: 'day' },
        content: { title, badge, subtitle, terms: `Промо-баллы начисляются на сумму, оплаченную деньгами, и действуют ${p.ttl_days} ${plural(p.ttl_days, 'день', 'дня', 'дней')}. Максимум ${p.cap} баллов за чек.` } });
    },
    preview: (p) => ({ title: p.mode === 'flat' ? `Кэшбэк ${pct(p.percent)}` : p.mode === 'ladder' ? 'Кэшбэк-лестница' : p.mode === 'by_category' ? 'Кэшбэк по категориям' : `+${pct(p.percent)} для ${p.status_min}`, badge: p.mode === 'flat' || p.mode === 'by_status' ? `+${pct(p.percent)}` : 'до 10 %', subtitle: `баллы на ${p.ttl_days} дн.` }),
    estimate(p, s) {
      const gmv = s.orders_month * s.avg_check_minor;
      let rate = p.mode === 'flat' ? p.percent : p.mode === 'ladder' ? 4 : p.mode === 'by_category' ? 5 * 0.4 : p.percent * 0.35;
      const cost = Math.round(gmv * rate / 100 * 0.7);
      return { cost_month_minor: cost, eligible_orders_month: s.orders_month, note: `≈ ${pct(Math.round(rate * 0.7 * 10) / 10)} оборота при использовании 70 % баллов`, risk: rate > 10 ? 'high' : 'low' };
    },
  },
  // ───────── LM-05 ─────────
  {
    id: 'lm-05', mechanic: 'happy_hours', title: 'Счастливые часы', short: 'Вечерняя выпечка −30 %', goal: 'check', tier: 'free', stage: 'MVP', complexity: 'S', icon: '⏰',
    summary: 'Скидка или ×2 баллов только в заданные окна времени. Сглаживает спрос и списания.',
    params_schema: { type: 'object', required: ['windows', 'action_type'], properties: {
      windows: P.rows('Окна времени', windowColumns, [{ days: 'daily', from: '19:00', to: '21:00' }]),
      action_type: P.select('Что даём', ['discount', 'multiplier'], ['Скидка на категорию', 'Баллы ×N (множитель базового кэшбэка)'], 'discount'),
      category: P.category('Категория', 'bakery', { 'x-showIf': { action_type: 'discount' } }),
      discount_pct: P.percent('Скидка', 30, { 'x-showIf': { action_type: 'discount' } }),
      multiplier: P.select('Множитель', ['2', '3'], ['×2', '×3'], '2', { 'x-showIf': { action_type: 'multiplier' } }),
      show_timer: P.bool('Показывать таймер до конца окна', true),
    } },
    defaults: (ctx) => ({ windows: [{ days: 'daily', from: '19:00', to: '21:00' }], action_type: 'discount', category: ctx.evening_category || 'bakery', discount_pct: 30, multiplier: '2', show_timer: true }),
    compile(p) {
      const win = windowsText(p.windows);
      const isDisc = p.action_type === 'discount';
      const title = isDisc ? `${catLabel(p.category)} −${pct(p.discount_pct)} ${win}`.replace(/^./, s => s.toUpperCase()) : `Баллы ×${p.multiplier} ${win}`;
      const actions = isDisc ? [{ type: 'discount', scope: 'items', mode: 'percent', value: p.discount_pct, filter: { category: { in: [p.category] } } }] : [{ type: 'accrue_points', mode: 'multiplier', multiplier: Number(p.multiplier), base: 'paid_money', ttl_days: 30, funding: 'merchant', lot_label: `Баллы ×${p.multiplier}` }];
      return base(this, p, { name: title, priority: 110, stacking: isDisc ? { group: 'basket_discount', mode: 'exclusive' } : { group: 'cashback', mode: 'stackable' }, windows: compileWindows(p.windows), actions, per_customer: null, holdout: 0,
        content: { title, badge: isDisc ? `−${pct(p.discount_pct)}` : `×${p.multiplier}`, subtitle: win, terms: `Действует ${win} по времени точки. ${isDisc ? 'Скидка применяется к позициям категории автоматически.' : 'Множитель применяется к базовому кэшбэку LOVII, разницу начисляет точка.'}` }, meta: { show_timer: !!p.show_timer } });
    },
    preview: (p) => ({ title: p.action_type === 'discount' ? `${catLabel(p.category)} −${pct(p.discount_pct)}` : `Баллы ×${p.multiplier}`, badge: p.action_type === 'discount' ? `−${pct(p.discount_pct)}` : `×${p.multiplier}`, subtitle: windowsText(p.windows) }),
    estimate: (p, s) => { const share = 0.12; const orders = Math.round(s.orders_month * share); const cost = p.action_type === 'discount' ? orders * s.avg_check_minor * 0.5 * p.discount_pct / 100 : orders * s.avg_check_minor * 5 / 100 * (Number(p.multiplier) - 1) * 0.7; return { cost_month_minor: Math.round(cost), eligible_orders_month: orders, note: 'Считаем ≈ 12 % чеков в окне; часть — списания вместо утилизации', risk: 'low' }; },
  },
  // ───────── LM-06 ─────────
  {
    id: 'lm-06', mechanic: 'stamps', title: 'Штампы N+1', short: 'Каждый 6-й кофе бесплатно', goal: 'frequency', tier: 'free', stage: 'MVP', complexity: 'M', icon: '☕',
    summary: 'Цифровая карточка: штамп за покупку из группы, при N — награда. Стартовый штамп повышает завершение на 20–30 %.',
    params_schema: { type: 'object', required: ['categories', 'target'], properties: {
      categories: P.categories('Целевая группа', ['coffee', 'tea']),
      target: P.int('Штампов до награды', 6, { minimum: 2, maximum: 30 }),
      max_per_order: P.int('Штампов за чек', 1, { minimum: 1, maximum: 3 }),
      min_interval_minutes: P.int('Мин. интервал между штампами, мин', 120, { minimum: 0, maximum: 1440, 'x-widget': 'minutes' }),
      start_bonus: P.bool('Стартовый штамп «уже 1 из 6»', true),
      reward_type: P.select('Награда', ['free_item', 'discount', 'points'], ['Самый дешёвый из группы бесплатно', 'Скидка на следующий чек', 'Баллы'], 'free_item'),
      discount_pct: P.percent('Скидка', 50, { 'x-showIf': { reward_type: 'discount' } }),
      reward_points: P.int('Баллов', 200, { 'x-showIf': { reward_type: 'points' } }),
      card_ttl_days: P.days('Карточка сгорает без покупок через', 90),
      holdout_pct: P.holdout(),
    } },
    defaults: (ctx) => ({ categories: ctx.stamp_categories || ['coffee', 'tea'], target: 6, max_per_order: 1, min_interval_minutes: 120, start_bonus: true, reward_type: 'free_item', discount_pct: 50, reward_points: 200, card_ttl_days: 90, holdout_pct: 10 }),
    compile(p) {
      const filter = drinkFilter(p.categories);
      const ordinal = `${p.target}-й`;
      const groupName = p.categories.length === 1 ? catLabel(p.categories[0]) : 'напиток';
      const title = p.reward_type === 'free_item' ? `${ordinal} ${groupName} бесплатно` : p.reward_type === 'discount' ? `${ordinal} чек −${pct(p.discount_pct)}` : `${p.target} покупок — +${pts(p.reward_points)}`;
      const reward = p.reward_type === 'free_item' ? { type: 'free_item', filter, pick: 'cheapest', qty: 1 } : p.reward_type === 'discount' ? { type: 'discount', scope: 'basket', mode: 'percent', value: p.discount_pct } : { type: 'accrue_points', mode: 'fixed', amount: p.reward_points, ttl_days: 30, funding: 'merchant', lot_label: title };
      return base(this, p, { name: title, priority: 90, stacking: { group: 'stamp', mode: 'stackable' },
        conditions: [{ field: 'basket.items', op: 'any', match: filter, min_qty: 1 }],
        actions: [{ type: 'stamp', card: p.card_id || (p.categories[0] || 'card'), filter, count: 1, max_per_order: p.max_per_order || 1, min_interval_minutes: p.min_interval_minutes, target: p.target, start_bonus: p.start_bonus ? 1 : 0, card_ttl_days: p.card_ttl_days, reward }],
        per_customer: { count: 3, period: 'day' },
        content: { title, badge: `${ordinal} free`, subtitle: `Штамп за каждый ${groupName}`, terms: `1 штамп за чек с покупкой из группы, не чаще раза в ${Math.round(p.min_interval_minutes / 60)} ч. Награда применяется в следующем чеке. Карточка сгорает через ${p.card_ttl_days} дней без покупок.` } });
    },
    preview: (p) => ({ title: `${p.target}-й ${p.categories.length === 1 ? catLabel(p.categories[0]) : 'напиток'} бесплатно`, badge: `${p.target}-й free`, subtitle: `${p.start_bonus ? 1 : 0}/${p.target} уже есть` }),
    estimate: (p, s) => { const completions = Math.round(s.orders_month * 0.7 / p.target * 0.55); const value = p.reward_type === 'free_item' ? (s.cheap_item_price_minor || 15000) : p.reward_type === 'discount' ? s.avg_check_minor * p.discount_pct / 100 : p.reward_points * 100 * 0.7; return { cost_month_minor: completions * value, eligible_orders_month: Math.round(s.orders_month * 0.7), note: 'Завершают карточку ≈ 55 % начавших', risk: 'low' }; },
  },
  // ───────── LM-07 ─────────
  {
    id: 'lm-07', mechanic: 'tiers', title: 'Уровни точки', short: 'Bronze / Silver / Gold', goal: 'frequency', tier: 'pro', stage: 'V2', complexity: 'M', icon: '🏅',
    summary: 'Уровень клиента у точки по окну 90 дней с постоянными привилегиями. Мягкое понижение.',
    params_schema: { type: 'object', required: ['metric', 'levels'], properties: {
      metric: P.select('Метрика', ['visits_90d', 'spent_90d'], ['Визитов за 90 дней', 'Сумма за 90 дней'], 'visits_90d'),
      levels: P.rows('Уровни', [{ key: 'tier', title: 'Уровень', widget: 'text' }, { key: 'from', title: 'От', widget: 'int' }, { key: 'cashback_pct', title: 'Кэшбэк %', widget: 'percent' }], [{ tier: 'bronze', from: 0, cashback_pct: 0 }, { tier: 'silver', from: 2, cashback_pct: 3 }, { tier: 'gold', from: 4, cashback_pct: 7 }]),
      soft_downgrade_days: P.days('Мягкое понижение через', 30),
    } },
    defaults: () => ({ metric: 'visits_90d', levels: [{ tier: 'bronze', from: 0, cashback_pct: 0 }, { tier: 'silver', from: 2, cashback_pct: 3 }, { tier: 'gold', from: 4, cashback_pct: 7 }], soft_downgrade_days: 30 }),
    compile(p) {
      const top = p.levels[p.levels.length - 1];
      const title = `Уровни: ${p.levels.map(l => l.tier).join(' → ')}`;
      return base(this, p, { name: title, priority: 50, stacking: { group: 'custom', mode: 'stackable' },
        trigger: { type: 'tier_recalculated', params: { metric: p.metric, levels: p.levels.map(l => ({ tier: l.tier, from: l.from })), soft_downgrade_days: p.soft_downgrade_days } },
        actions: [{ type: 'tier_assign', tier: 'auto' }], per_customer: null, holdout: 0,
        content: { title, badge: 'Уровни', subtitle: `${top.tier}: +${pct(top.cashback_pct)} и приоритетная запись`, terms: 'Уровень пересчитывается ежедневно по последним 90 дням. Понижение — не раньше чем через 30 дней после предупреждения.' },
        meta: { notes: 'tier_assign.tier = "auto" — уровень по таблице trigger.params.levels. Привилегии уровней компилируются в сопутствующие кампании LM-04 с audience.tiers.', benefits: p.levels.map(l => ({ tier: l.tier, cashback_pct: l.cashback_pct })) } });
    },
    preview: (p) => ({ title: 'Уровни точки', badge: '🏅', subtitle: p.levels.map(l => `${l.tier} ${pct(l.cashback_pct)}`).join(' · ') }),
    estimate: (p, s) => ({ cost_month_minor: Math.round(s.orders_month * s.avg_check_minor * 0.3 * (p.levels[p.levels.length - 1].cashback_pct / 100) * 0.7), eligible_orders_month: Math.round(s.orders_month * 0.3), note: '≈ 30 % чеков делают клиенты верхних уровней', risk: 'low' }),
  },
  // ───────── LM-08 ─────────
  {
    id: 'lm-08', mechanic: 'subscription', title: 'Абонемент / подписка', short: '10 напитков за 1 800 ₽', goal: 'prepay', tier: 'pro', stage: 'V2', complexity: 'L', icon: '🎫',
    summary: 'Клиент покупает пакет единиц или период и списывает через QR. Деньги — вперёд.',
    params_schema: { type: 'object', required: ['plan_name', 'units', 'price_minor'], properties: {
      plan_name: P.text('Название', '10 напитков'), categories: P.categories('Что входит', ['coffee', 'tea']),
      units: P.int('Единиц в пакете', 10, { minimum: 1, maximum: 100 }), price_minor: P.money('Цена пакета', 180000),
      validity_days: P.days('Срок действия', 60), daily_limit: P.int('Лимит в день', 2, { minimum: 1, maximum: 10 }),
      giftable: P.bool('Можно подарить', true),
    } },
    defaults: (ctx) => ({ plan_name: '10 напитков', categories: ctx.stamp_categories || ['coffee', 'tea'], units: 10, price_minor: ctx.subscription_price_minor || 180000, validity_days: 60, daily_limit: 2, giftable: true }),
    compile(p) {
      const planId = `plan_${slug(p.plan_id || p.plan_name)}`;
      const title = `Абонемент: ${p.plan_name} за ${rub(p.price_minor)}`;
      return base(this, p, { name: title, priority: 200, stacking: { group: 'item_price', mode: 'stackable' },
        conditions: [{ field: `subscription.active.${planId}`, op: '==', value: true }, { field: 'basket.items', op: 'any', match: drinkFilter(p.categories), min_qty: 1 }],
        actions: [{ type: 'redeem_subscription_unit', plan_id: planId, units: 1, filter: drinkFilter(p.categories), cost_model: 'zero' }], per_customer: { count: p.daily_limit || 2, period: 'day' }, holdout: 0,
        content: { title, badge: 'Абонемент', subtitle: `${p.units} ${plural(p.units, 'единица', 'единицы', 'единиц')} · ${p.validity_days} дней · до ${p.daily_limit} в день`, cta: 'Купить абонемент', terms: `Абонемент действует ${p.validity_days} дней с покупки, не более ${p.daily_limit} списаний в день. Неиспользованный остаток возвращается по заявлению.` },
        meta: { plan: { plan_id: planId, name: p.plan_name, units: p.units, price_minor: p.price_minor, validity_days: p.validity_days, daily_limit: p.daily_limit, giftable: !!p.giftable, filter: drinkFilter(p.categories) } } });
    },
    preview: (p) => ({ title: `${p.plan_name} за ${rub(p.price_minor)}`, badge: 'Абонемент', subtitle: `${p.validity_days} дней` }),
    estimate: (p, s) => { const buyers = Math.max(3, Math.round(s.customers_active * 0.05)); return { cost_month_minor: Math.round(buyers * Math.max(0, s.avg_check_minor * p.units * 0.8 - p.price_minor)), eligible_orders_month: buyers, note: `≈ ${buyers} покупателей абонемента; предоплата ${rub(buyers * p.price_minor)} сразу`, risk: 'low' }; },
  },
  // ───────── LM-09 ─────────
  {
    id: 'lm-09', mechanic: 'challenge', title: 'Челленджи и серии', short: '3 визита за 7 дней → 300 баллов', goal: 'frequency', tier: 'pro', stage: 'V2', complexity: 'M', icon: '🏁',
    summary: 'Цель с дедлайном и прогрессом: визиты, сумма, разные позиции, недели подряд.',
    params_schema: { type: 'object', required: ['metric', 'target', 'window_days'], properties: {
      name: P.text('Название', 'Утренний ритуал'),
      metric: P.select('Что считаем', ['visits', 'amount', 'unique_sku', 'streak_weeks'], ['Визиты', 'Сумма покупок, ₽', 'Разные позиции', 'Недели подряд'], 'visits'),
      target: P.int('Цель', 3, { minimum: 1 }), window_days: P.days('Окно, дней', 7, { maximum: 90 }),
      category: P.category('Только категория (пусто = любая)', '', { 'x-optional': true }),
      windows: P.rows('Только в часы (пусто = всегда)', windowColumns, []),
      reward_points: P.int('Награда, баллов', 300), ttl_days: P.days('Срок баллов', 14),
      holdout_pct: P.holdout(),
    } },
    defaults: () => ({ name: 'Утренний ритуал', metric: 'visits', target: 3, window_days: 7, category: '', windows: [{ days: 'weekdays', from: '07:00', to: '11:00' }], reward_points: 300, ttl_days: 14, holdout_pct: 10 }),
    compile(p) {
      const metricText = { visits: `${p.target} ${plural(p.target, 'визит', 'визита', 'визитов')}`, amount: `${rub(p.target * 100)} покупок`, unique_sku: `${p.target} разных позиций`, streak_weeks: `${p.target} ${plural(p.target, 'неделя', 'недели', 'недель')} подряд` }[p.metric];
      const title = `${p.name}: ${metricText} за ${p.window_days} дн. → +${pts(p.reward_points)}`;
      const filter = p.category ? { category: { in: [p.category] } } : undefined;
      const conditions = p.category ? [{ field: 'basket.items', op: 'any', match: filter, min_qty: 1 }] : [];
      const action = { type: 'challenge_progress', challenge: `ch_${slug(p.name)}`, metric: p.metric, increment: 1, target: p.metric === 'amount' ? p.target * 100 : p.target, window_days: p.window_days, reward: { type: 'accrue_points', mode: 'fixed', amount: p.reward_points, ttl_days: p.ttl_days, funding: 'merchant', lot_label: p.name } };
      if (filter) action.filter = filter;
      return base(this, p, { name: title, priority: 80, stacking: { group: 'custom', mode: 'stackable' }, windows: compileWindows(p.windows), conditions, actions: [action], per_customer: { count: 1, period: 'day' },
        content: { title: `${p.name}`, badge: `+${p.reward_points} б.`, subtitle: `${metricText} за ${p.window_days} дн.${p.windows && p.windows.length ? ' · ' + windowsText(p.windows) : ''}`, terms: `Прогресс считается по чекам, оплаченным деньгами. Окно ${p.window_days} дней с первого засчитанного чека; при истечении прогресс обнуляется.` } });
    },
    preview: (p) => ({ title: p.name, badge: `+${p.reward_points} б.`, subtitle: `цель ${p.target} за ${p.window_days} дн.` }),
    estimate: (p, s) => { const finishers = Math.round(s.customers_active * 0.15); return { cost_month_minor: finishers * p.reward_points * 100 * 0.7, eligible_orders_month: finishers * p.target, note: '≈ 15 % активных клиентов доходят до цели', risk: 'low' }; },
  },
  // ───────── LM-10 ─────────
  {
    id: 'lm-10', mechanic: 'welcome', title: 'Приветственный бонус', short: '+100 баллов за первую покупку', goal: 'acquisition', tier: 'free', stage: 'MVP', complexity: 'S', icon: '👋',
    summary: 'Баллы со сроком за первую покупку — чтобы случился второй визит.',
    params_schema: { type: 'object', required: ['amount'], properties: {
      amount: P.int('Баллов', 100), min_check_minor: P.money('Мин. чек', 30000), ttl_days: P.days('Срок баллов', 10),
      holdout_pct: P.holdout(),
    } },
    defaults: (ctx) => ({ amount: Math.round(ctx.avg_check_minor * 0.3 / 100 / 10) * 10 || 100, min_check_minor: roundTo(ctx.avg_check_minor * 0.9, 5000), ttl_days: 10, holdout_pct: 10 }),
    compile(p) {
      const title = `+${pts(p.amount)} за первую покупку`;
      return base(this, p, { name: title, priority: 120, stacking: { group: 'bonus', mode: 'exclusive' }, segments: ['all'],
        conditions: [{ field: 'customer.orders_at_merchant', op: '==', value: 0 }, { field: 'basket.paid_money', op: '>=', value: p.min_check_minor }],
        actions: [{ type: 'accrue_points', mode: 'fixed', amount: p.amount, ttl_days: p.ttl_days, funding: 'merchant', lot_label: 'Приветственные баллы' }], per_customer: { count: 1, period: 'campaign' },
        content: { title, badge: `+${p.amount} б.`, subtitle: `Чек от ${rub(p.min_check_minor)} · баллы на ${p.ttl_days} дней`, terms: `Один раз для нового клиента точки при первой покупке от ${rub(p.min_check_minor)}, оплаченной деньгами.` } });
    },
    preview: (p) => ({ title: `+${pts(p.amount)} за первую покупку`, badge: `+${p.amount} б.`, subtitle: `от ${rub(p.min_check_minor)}` }),
    estimate: (p, s) => ({ cost_month_minor: Math.round((s.new_customers_month || 40) * p.amount * 100 * 0.7), eligible_orders_month: s.new_customers_month || 40, note: `≈ ${s.new_customers_month || 40} новых клиентов в месяц`, risk: 'low' }),
  },
  // ───────── LM-11 ─────────
  {
    id: 'lm-11', mechanic: 'referral', title: 'Реферал точки', short: 'Приведи друга — 500 баллов', goal: 'acquisition', tier: 'free', stage: 'MVP', complexity: 'M', icon: '🤝',
    summary: 'Друг делает квалифицирующую покупку — оба получают награду. Локальный слой поверх «Приведи друга» LOVII.',
    params_schema: { type: 'object', required: ['referrer_points', 'referee_type'], properties: {
      referrer_points: P.int('Пригласившему, баллов', 500), referee_type: P.select('Другу', ['points', 'discount'], ['Баллы', 'Скидка на первый чек'], 'points'),
      referee_points: P.int('Другу, баллов', 200, { 'x-showIf': { referee_type: 'points' } }), referee_discount_pct: P.percent('Скидка другу', 50, { 'x-showIf': { referee_type: 'discount' } }),
      min_check_minor: P.money('Мин. чек друга', 50000), payout: P.select('Выплата пригласившему', ['immediate', 'after_second'], ['Сразу после покупки друга', 'После 2-й покупки друга'], 'immediate'),
      monthly_limit: P.int('Приглашений в месяц на клиента', 10, { minimum: 1 }), ttl_days: P.days('Срок баллов', 30),
    } },
    defaults: (ctx) => ({ referrer_points: 500, referee_type: 'points', referee_points: 200, referee_discount_pct: 50, min_check_minor: roundTo(ctx.avg_check_minor * 1.5, 5000), payout: 'immediate', monthly_limit: 10, ttl_days: 30 }),
    compile(p) {
      const title = `Приведи друга — +${pts(p.referrer_points)}`;
      const refereeAction = p.referee_type === 'points' ? { type: 'accrue_points', mode: 'fixed', amount: p.referee_points, ttl_days: p.ttl_days, funding: 'merchant', to: 'referee', lot_label: 'Бонус за приглашение' }
        : { type: 'coupon_issue', to: 'referee', ttl_days: 30, inline: { conditions: [{ field: 'customer.orders_at_merchant', op: '<=', value: 1 }], actions: [{ type: 'discount', scope: 'basket', mode: 'percent', value: p.referee_discount_pct }] } };
      return base(this, p, { name: title, priority: 100, stacking: { group: 'bonus', mode: 'stackable' },
        trigger: { type: 'referral_qualified', params: { min_paid_money_minor: p.min_check_minor, payout: p.payout, invite_ttl_days: 30 } },
        conditions: [{ field: 'referral.qualified', op: '==', value: true }],
        actions: [{ type: 'accrue_points', mode: 'fixed', amount: p.referrer_points, ttl_days: p.ttl_days, funding: 'merchant', to: 'referrer', lot_label: 'Приведи друга' }, refereeAction], per_customer: { count: p.monthly_limit || 10, period: 'month' }, holdout: 0,
        content: { title, badge: `+${p.referrer_points} б.`, subtitle: p.referee_type === 'points' ? `Другу — +${pts(p.referee_points)}` : `Другу — скидка ${pct(p.referee_discount_pct)}`, cta: 'Поделиться', terms: `Награда после первой покупки друга от ${rub(p.min_check_minor)}, оплаченной деньгами. Самоприглашения и дубли аккаунтов не засчитываются. До ${p.monthly_limit} приглашений в месяц.` } });
    },
    preview: (p) => ({ title: `Приведи друга — +${pts(p.referrer_points)}`, badge: '🤝', subtitle: p.referee_type === 'points' ? `другу +${p.referee_points} б.` : `другу −${pct(p.referee_discount_pct)}` }),
    estimate: (p, s) => { const refs = Math.max(2, Math.round(s.customers_active * 0.04)); const val = p.referrer_points * 100 * 0.7 + (p.referee_type === 'points' ? p.referee_points * 100 * 0.7 : p.min_check_minor * p.referee_discount_pct / 100); return { cost_month_minor: Math.round(refs * val), eligible_orders_month: refs, note: `≈ ${refs} квалифицированных друзей в месяц (4 % активных клиентов)`, risk: 'low' }; },
  },
  // ───────── LM-12 ─────────
  {
    id: 'lm-12', mechanic: 'cross_promo', title: 'Кросс-промо соседей', short: 'Купон в «Слойку» после покупки', goal: 'acquisition', tier: 'pro', stage: 'V2', complexity: 'M', icon: '🏘️',
    summary: 'После покупки у вас клиент получает купон к соседу (и наоборот). Уникально для районной экосистемы LOVII.',
    params_schema: { type: 'object', required: ['partner_merchant_id', 'discount_pct'], properties: {
      partner_merchant_id: P.text('Партнёр', 'mrc_sloyka', { 'x-widget': 'merchant' }),
      discount_pct: P.percent('Скидка по купону у партнёра', 15), min_check_minor: P.money('Мин. чек у вас для выдачи', 30000),
      ttl_days: P.days('Срок купона', 5, { maximum: 30 }), daily_limit: P.int('Купонов в день', 30, { minimum: 1 }),
      funded_by: P.select('Кто платит за скидку', ['receiver', 'issuer', 'split'], ['Точка-получатель клиента', 'Точка, выдавшая купон', 'Пополам'], 'receiver'),
    } },
    defaults: () => ({ partner_merchant_id: 'mrc_sloyka', discount_pct: 15, min_check_minor: 30000, ttl_days: 5, daily_limit: 30, funded_by: 'receiver' }),
    compile(p) {
      const partnerName = p.partner_name || p.partner_merchant_id;
      const title = `Купон −${pct(p.discount_pct)} в «${partnerName}» после покупки`;
      return base(this, p, { name: title, priority: 60, stacking: { group: 'coupon_out', mode: 'stackable' },
        conditions: [{ field: 'basket.paid_money', op: '>=', value: p.min_check_minor }],
        actions: [{ type: 'coupon_issue', ttl_days: p.ttl_days, to: 'customer', redeemer_merchant_id: p.partner_merchant_id, max_per_customer_per_week: 1, inline: { conditions: [], actions: [{ type: 'discount', scope: 'basket', mode: 'percent', value: p.discount_pct }] } }],
        per_customer: { count: 1, period: 'week' }, total_uses: null, holdout: 0,
        content: { title, badge: `−${pct(p.discount_pct)} рядом`, subtitle: `Купон на ${p.ttl_days} дней в «${partnerName}»`, terms: `Купон выдаётся за чек от ${rub(p.min_check_minor)}, действует ${p.ttl_days} дней в точке-партнёре, 1 купон в неделю.` },
        meta: { partnership: { partner_merchant_id: p.partner_merchant_id, funded_by: p.funded_by, daily_limit: p.daily_limit } } });
    },
    preview: (p) => ({ title: `Купон −${pct(p.discount_pct)} у соседа`, badge: '🏘️', subtitle: `${p.ttl_days} дней` }),
    estimate: (p, s) => { const issued = Math.round(s.orders_month * 0.6); const redeemed = Math.round(issued * 0.12); return { cost_month_minor: p.funded_by === 'issuer' ? Math.round(redeemed * s.avg_check_minor * p.discount_pct / 100) : 0, eligible_orders_month: issued, note: `≈ ${redeemed} переходов к партнёру (redemption 12 %); зеркально — новые клиенты вам`, risk: 'low' }; },
  },
  // ───────── LM-13 ─────────
  {
    id: 'lm-13', mechanic: 'coupon', title: 'Промокоды и купоны', short: 'МИЯ15 — −15 % на сеты', goal: 'acquisition', tier: 'free', stage: 'MVP', complexity: 'S', icon: '🎟️',
    summary: 'Публичный код или персональные одноразовые. Транспорт для наград других механик.',
    params_schema: { type: 'object', required: ['code', 'reward_type'], properties: {
      code: P.text('Промокод', 'DAILY15'), kind: P.select('Тип', ['public', 'personal_batch'], ['Публичный', 'Пакет персональных'], 'public'),
      reward_type: P.select('Награда', ['discount', 'points', 'free_item'], ['Скидка', 'Баллы', 'Товар в подарок'], 'discount'),
      discount_pct: P.percent('Скидка', 15, { 'x-showIf': { reward_type: 'discount' } }), category: P.category('Только категория (пусто = весь чек)', '', { 'x-optional': true, 'x-showIf': { reward_type: 'discount' } }),
      points: P.int('Баллов', 150, { 'x-showIf': { reward_type: 'points' } }), free_sku: P.sku('Подарок', 'cd6', { 'x-showIf': { reward_type: 'free_item' } }),
      min_check_minor: P.money('Мин. чек', 30000), until: P.text('Действует до (дата)', '', { 'x-widget': 'date', 'x-optional': true }),
      per_customer: P.int('Раз на клиента', 1, { minimum: 1 }), total_uses: P.int('Всего использований', 500, { minimum: 1 }),
      blocks_cashback: P.bool('Купон отменяет промо-кэшбэк точки', false),
    } },
    defaults: (ctx) => ({ code: (ctx.code_prefix || 'DAILY') + '15', kind: 'public', reward_type: 'discount', discount_pct: 15, category: '', points: 150, free_sku: ctx.cheap_sku || 'cd6', min_check_minor: roundTo(ctx.avg_check_minor * 0.9, 5000), until: '', per_customer: 1, total_uses: 500, blocks_cashback: false }),
    compile(p) {
      const code = String(p.code).toUpperCase().trim();
      const what = p.reward_type === 'discount' ? `−${pct(p.discount_pct)}${p.category ? ' на ' + catLabel(p.category) : ''}` : p.reward_type === 'points' ? `+${pts(p.points)}` : 'подарок';
      const title = `Промокод ${code}: ${what}`;
      const action = p.reward_type === 'discount' ? (p.category ? { type: 'discount', scope: 'items', mode: 'percent', value: p.discount_pct, filter: { category: { in: [p.category] } } } : { type: 'discount', scope: 'basket', mode: 'percent', value: p.discount_pct })
        : p.reward_type === 'points' ? { type: 'accrue_points', mode: 'fixed', amount: p.points, ttl_days: 30, funding: 'merchant', lot_label: `Промокод ${code}` } : { type: 'free_item', sku: p.free_sku, qty: 1, add_if_missing: true };
      const stacking = { group: p.reward_type === 'points' ? 'bonus' : 'basket_discount', mode: 'exclusive', ...(p.blocks_cashback ? { blocks: ['cashback'] } : {}) };
      const spec = base(this, p, { name: title, priority: 130, stacking,
        trigger: { type: 'purchase', params: { coupon: { codes: [code], kind: p.kind || 'public' } } },
        conditions: [{ field: 'coupon.valid', op: '==', value: true }, { field: 'basket.gross_total', op: '>=', value: p.min_check_minor }],
        actions: [action], per_customer: { count: p.per_customer || 1, period: 'campaign' }, total_uses: p.total_uses || null, holdout: 0,
        content: { title, badge: code, subtitle: `Чек от ${rub(p.min_check_minor)}${p.until ? ' · до ' + p.until : ''}`, cta: 'Ввести код', terms: `Код вводится при оплате. ${p.per_customer || 1} раз на клиента, всего ${p.total_uses} использований. Не суммируется с другими скидками.` } });
      if (p.until) spec.schedule.ends_at = `${p.until}T23:59:59+03:00`;
      return spec;
    },
    preview: (p) => ({ title: `Промокод ${String(p.code).toUpperCase()}`, badge: String(p.code).toUpperCase(), subtitle: p.reward_type === 'discount' ? `−${pct(p.discount_pct)}` : p.reward_type === 'points' ? `+${p.points} б.` : 'подарок' }),
    estimate: (p, s) => { const uses = Math.min(p.total_uses || 500, Math.round(s.orders_month * 0.15)); const val = p.reward_type === 'discount' ? s.avg_check_minor * p.discount_pct / 100 : p.reward_type === 'points' ? p.points * 100 * 0.7 : 15000; return { cost_month_minor: Math.round(uses * val), eligible_orders_month: uses, note: `≈ ${uses} применений в месяц при печати QR у кассы`, risk: 'low' }; },
  },
  // ───────── LM-14 ─────────
  {
    id: 'lm-14', mechanic: 'winback', title: 'Win-back', short: 'Вернуть уснувших', goal: 'reactivation', tier: 'free', stage: 'MVP', complexity: 'M', icon: '💤',
    summary: 'Планировщик находит клиентов без покупок N дней и выдаёт стимул со сроком + уведомление.',
    params_schema: { type: 'object', required: ['days', 'reward_type'], properties: {
      days: P.days('Нет покупок дней', 45, { minimum: 14, maximum: 365 }), min_orders: P.int('Только если было покупок ≥', 2, { minimum: 1 }),
      reward_type: P.select('Стимул', ['points', 'coupon'], ['Промо-баллы', 'Купон на скидку'], 'points'),
      points: P.int('Баллов', 300, { 'x-showIf': { reward_type: 'points' } }), discount_pct: P.percent('Скидка по купону', 20, { 'x-showIf': { reward_type: 'coupon' } }),
      ttl_days: P.days('Срок стимула', 10, { maximum: 30 }), channel: P.select('Канал', ['push', 'inapp'], ['Пуш (с согласия)', 'Только в приложении'], 'push'),
      holdout_pct: P.holdout(), budget_total_minor: P.budget(2000000),
    } },
    defaults: (ctx) => ({ days: ctx.sleep_days || 45, min_orders: 2, reward_type: 'points', points: Math.round(ctx.avg_check_minor * 0.9 / 100 / 50) * 50 || 300, discount_pct: 20, ttl_days: 10, channel: 'push', holdout_pct: 10, budget_total_minor: 2000000 }),
    compile(p) {
      const title = p.reward_type === 'points' ? `Мы скучали: +${pts(p.points)} на ${p.ttl_days} дней` : `Мы скучали: −${pct(p.discount_pct)} на ${p.ttl_days} дней`;
      const reward = p.reward_type === 'points' ? { type: 'accrue_points', mode: 'fixed', amount: p.points, ttl_days: p.ttl_days, funding: 'merchant', lot_label: 'Мы скучали' }
        : { type: 'coupon_issue', ttl_days: p.ttl_days, to: 'customer', inline: { conditions: [], actions: [{ type: 'discount', scope: 'basket', mode: 'percent', value: p.discount_pct }] } };
      return base(this, p, { name: title, priority: 100, stacking: { group: 'bonus', mode: 'stackable' },
        trigger: { type: 'inactivity', params: { days: p.days, min_orders: p.min_orders, step: 1 } },
        conditions: [{ field: 'customer.orders_at_merchant', op: '>=', value: p.min_orders }, { field: 'customer.days_since_last_purchase', op: '>=', value: p.days }],
        actions: [reward, { type: 'notify', channel: p.channel, template: 'winback_step1', params: { reward: p.reward_type === 'points' ? `+${p.points} баллов` : `−${p.discount_pct} %`, ttl_days: p.ttl_days } }],
        per_customer: { count: 1, period: 'campaign' }, push: p.channel === 'push',
        content: { title, badge: p.reward_type === 'points' ? `+${p.points} б.` : `−${pct(p.discount_pct)}`, subtitle: `Для тех, кто не был ${p.days} дней`, terms: `Стимул выдаётся один раз клиентам без покупок ${p.days} и более дней, действует ${p.ttl_days} дней.`, push: { title: 'Мы скучали 💛', body: p.reward_type === 'points' ? `Вам начислено ${p.points} баллов — действуют ${p.ttl_days} дней` : `Скидка ${p.discount_pct} % ждёт вас ${p.ttl_days} дней` } } });
    },
    preview: (p) => ({ title: 'Мы скучали', badge: p.reward_type === 'points' ? `+${p.points} б.` : `−${pct(p.discount_pct)}`, subtitle: `не были ${p.days} дней` }),
    estimate: (p, s) => { const sleeping = s.sleeping_count || 60; const returned = Math.round(sleeping * 0.18); const val = p.reward_type === 'points' ? p.points * 100 : s.avg_check_minor * p.discount_pct / 100; return { cost_month_minor: Math.round(returned * val), eligible_orders_month: returned, note: `${sleeping} уснувших; вернутся ≈ 18 % (${returned})`, risk: 'low' }; },
  },
  // ───────── LM-15 ─────────
  {
    id: 'lm-15', mechanic: 'birthday', title: 'День рождения', short: 'Десерт в подарок к напитку', goal: 'reactivation', tier: 'free', stage: 'V2', complexity: 'S', icon: '🎂',
    summary: 'Подарок с окном ±7 дней вокруг даты из профиля (с согласия клиента).',
    params_schema: { type: 'object', required: ['gift_type'], properties: {
      days_before: P.int('Выдать за дней до', 5, { minimum: 0, maximum: 14 }), window_days: P.days('Окно действия, дней', 10, { maximum: 30 }),
      gift_type: P.select('Подарок', ['free_item', 'points'], ['Товар в подарок', 'Баллы'], 'free_item'),
      gift_category: P.category('Категория подарка', 'dessert', { 'x-showIf': { gift_type: 'free_item' } }),
      requires_category: P.category('При покупке из категории', 'coffee', { 'x-showIf': { gift_type: 'free_item' } }),
      points: P.int('Баллов', 300, { 'x-showIf': { gift_type: 'points' } }),
    } },
    defaults: (ctx) => ({ days_before: 5, window_days: 10, gift_type: 'free_item', gift_category: ctx.margin_category || 'dessert', requires_category: ctx.category || 'coffee', points: 300 }),
    compile(p) {
      const title = p.gift_type === 'free_item' ? `${catOne(p.gift_category)} в подарок ко дню рождения`.replace(/^./, s => s.toUpperCase()) : `+${pts(p.points)} ко дню рождения`;
      const reward = p.gift_type === 'free_item'
        ? { type: 'coupon_issue', ttl_days: p.window_days, to: 'customer', inline: { conditions: [{ field: 'basket.items', op: 'any', match: { category: { in: [p.requires_category] } }, min_qty: 1 }], actions: [{ type: 'free_item', filter: { category: { in: [p.gift_category] } }, pick: 'cheapest', qty: 1, requires_purchase_of: { category: { in: [p.requires_category] } } }] } }
        : { type: 'accrue_points', mode: 'fixed', amount: p.points, ttl_days: p.window_days, funding: 'merchant', lot_label: 'С днём рождения' };
      return base(this, p, { name: title, priority: 100, stacking: { group: 'bonus', mode: 'stackable' },
        trigger: { type: 'birthday', params: { days_before: p.days_before, window_days: p.window_days, requires_consent: 'birthday_use' } },
        conditions: [{ field: 'customer.birthday_in_days', op: '<=', value: p.days_before }],
        actions: [reward, { type: 'notify', channel: 'push', template: 'birthday_gift', params: { window_days: p.window_days } }], per_customer: { count: 1, period: 'campaign' }, push: true, holdout: 0,
        content: { title, badge: '🎂', subtitle: `Действует ${p.window_days} дней`, terms: `Подарок выдаётся раз в год при согласии на использование даты рождения${p.gift_type === 'free_item' ? `, при покупке из категории «${catLabel(p.requires_category)}»` : ''}.`, push: { title: 'С наступающим! 🎂', body: p.gift_type === 'free_item' ? `${catOne(p.gift_category)} в подарок к напитку — ${p.window_days} дней`.replace(/^./, s => s.toUpperCase()) : `${p.points} баллов в подарок` } } });
    },
    preview: (p) => ({ title: p.gift_type === 'free_item' ? `${catOne(p.gift_category)} в подарок`.replace(/^./, s => s.toUpperCase()) : `+${p.points} баллов`, badge: '🎂', subtitle: `окно ${p.window_days} дней` }),
    estimate: (p, s) => { const bd = Math.round(s.customers_active / 12 * 0.6); const val = p.gift_type === 'free_item' ? (s.gift_item_price_minor || 32000) * 0.5 : p.points * 100 * 0.8; return { cost_month_minor: Math.round(bd * val), eligible_orders_month: bd, note: `≈ ${bd} именинников в месяц с согласием`, risk: 'low' }; },
  },
  // ───────── LM-16 ─────────
  {
    id: 'lm-16', mechanic: 'instant_win', title: 'Мгновенный выигрыш', short: 'Колесо от 700 ₽', goal: 'engagement', tier: 'pro', stage: 'V2', complexity: 'M', icon: '🎡',
    summary: 'После чека ≥ X — случайная награда из таблицы с вероятностями. Всегда есть утешительная.',
    params_schema: { type: 'object', required: ['min_check_minor', 'table'], properties: {
      min_check_minor: P.money('Чек от', 70000),
      table: P.rows('Призы', [{ key: 'label', title: 'Приз', widget: 'text' }, { key: 'weight', title: 'Вес %', widget: 'int' }, { key: 'prize_type', title: 'Тип', widget: 'select', enum: ['points', 'free_item', 'discount_next'], enumNames: ['Баллы', 'Товар', 'Скидка на след.'] }, { key: 'value', title: 'Значение', widget: 'text' }, { key: 'daily_limit', title: 'Лимит/день', widget: 'int' }],
        [{ label: '+50 баллов', weight: 60, prize_type: 'points', value: '50', daily_limit: null }, { label: 'Эспрессо в подарок', weight: 30, prize_type: 'free_item', value: 'cd3', daily_limit: 20 }, { label: '−20 % на следующий', weight: 9, prize_type: 'discount_next', value: '20', daily_limit: 10 }, { label: 'Чизкейк бесплатно', weight: 1, prize_type: 'free_item', value: 'cd8', daily_limit: 2 }]),
      holdout_pct: P.holdout(),
    } },
    defaults: (ctx) => ({ min_check_minor: roundTo(ctx.avg_check_minor * 2, 10000), table: [{ label: '+50 баллов', weight: 60, prize_type: 'points', value: '50', daily_limit: null }, { label: 'Эспрессо в подарок', weight: 30, prize_type: 'free_item', value: ctx.cheap_sku || 'cd3', daily_limit: 20 }, { label: '−20 % на следующий', weight: 9, prize_type: 'discount_next', value: '20', daily_limit: 10 }, { label: 'Чизкейк бесплатно', weight: 1, prize_type: 'free_item', value: ctx.upsell_sku || 'cd8', daily_limit: 2 }], holdout_pct: 10 }),
    compile(p) {
      const title = `Крути колесо от ${rub(p.min_check_minor)}`;
      const table = (p.table || []).map((r, i) => {
        const entry = { weight: Number(r.weight), label: r.label, action: null };
        if (r.prize_type === 'points') entry.action = { type: 'accrue_points', mode: 'fixed', amount: Number(r.value), ttl_days: 14, funding: 'merchant', lot_label: 'Выигрыш' };
        else if (r.prize_type === 'free_item') entry.action = { type: 'free_item', sku: String(r.value), qty: 1, add_if_missing: true };
        else entry.action = { type: 'discount', scope: 'basket', mode: 'percent', value: Number(r.value) };
        if (r.daily_limit != null && r.daily_limit !== '') entry.daily_limit = Number(r.daily_limit);
        if (i === 0) entry.fallback = true;
        return entry;
      });
      const totalW = table.reduce((s, t) => s + t.weight, 0);
      return base(this, p, { name: title, priority: 70, stacking: { group: 'bonus', mode: 'exclusive' },
        conditions: [{ field: 'basket.paid_money', op: '>=', value: p.min_check_minor }],
        actions: [{ type: 'random_reward', seed: 'order_id', table }], per_customer: { count: 1, period: 'day' },
        content: { title, badge: '🎡', subtitle: `Шансы: ${table.map(t => `${t.label} ${Math.round(t.weight / totalW * 100)}\u00a0%`).join(', ')}`, cta: 'Крутить', terms: `Стимулирующее мероприятие. Участие — по факту покупки от ${rub(p.min_check_minor)}, без дополнительной платы. Вероятности и лимиты призов опубликованы. Товарные призы — купоном на следующий визит (7 дней).` } });
    },
    preview: (p) => ({ title: `Колесо от ${rub(p.min_check_minor)}`, badge: '🎡', subtitle: `${(p.table || []).length} призов` }),
    estimate(p, s) {
      const eligible = Math.round(s.orders_month * shareAbove(p.min_check_minor, s.avg_check_minor) * 1.2);
      const totalW = (p.table || []).reduce((a, t) => a + Number(t.weight), 0) || 1;
      const ev = (p.table || []).reduce((a, t) => a + Number(t.weight) / totalW * (t.prize_type === 'points' ? Number(t.value) * 100 * 0.7 : t.prize_type === 'free_item' ? (s.cheap_item_price_minor || 15000) * 0.6 : s.avg_check_minor * Number(t.value) / 100 * 0.3), 0);
      return { cost_month_minor: Math.round(eligible * ev), eligible_orders_month: eligible, note: `Мат. ожидание приза ≈ ${rub(Math.round(ev))} на участие`, risk: 'medium' };
    },
  },
  // ───────── LM-17 ─────────
  {
    id: 'lm-17', mechanic: 'gift_card', title: 'Подарочные сертификаты', short: '2 000 / 3 000 / 5 000 ₽', goal: 'prepay', tier: 'pro', stage: 'V2', complexity: 'L', icon: '🎁',
    summary: 'Электронный сертификат точки: покупка → подарок ссылкой → оплата покупок. Баланс — отдельный инструмент, не баллы.',
    params_schema: { type: 'object', required: ['denominations'], properties: {
      denominations: P.rows('Номиналы', [{ key: 'amount_minor', title: 'Номинал', widget: 'money' }], [{ amount_minor: 200000 }, { amount_minor: 300000 }, { amount_minor: 500000 }]),
      validity_days: P.days('Срок действия', 365), partial_use: P.bool('Частичное использование', true), top_up_allowed: P.bool('Доплата картой/баллами', true),
      cashback_on_gift_payment: P.bool('Начислять кэшбэк на оплату сертификатом', false),
    } },
    defaults: () => ({ denominations: [{ amount_minor: 200000 }, { amount_minor: 300000 }, { amount_minor: 500000 }], validity_days: 365, partial_use: true, top_up_allowed: true, cashback_on_gift_payment: false }),
    compile(p) {
      const noms = (p.denominations || []).map(d => rub(d.amount_minor));
      const title = `Подарочные сертификаты ${noms.join(' / ')}`;
      return base(this, p, { name: title, priority: 10, stacking: { group: 'custom', mode: 'stackable' },
        conditions: [{ field: 'basket.items', op: 'any', match: { category: { in: ['gift_card'] } }, min_qty: 1 }],
        actions: [{ type: 'notify', channel: 'inapp', template: 'gift_card_issued', params: { validity_days: p.validity_days } }], per_customer: null, holdout: 0,
        content: { title, badge: '🎁', subtitle: `Действует ${p.validity_days} дней · ${p.partial_use ? 'можно частями' : 'разово'}`, cta: 'Подарить', terms: `Сертификат — предоплата (аванс) за товары точки. Неиспользованный остаток возвращается по заявлению покупателя. ${p.cashback_on_gift_payment ? '' : 'На часть чека, оплаченную сертификатом, промо-баллы не начисляются.'}` },
        meta: { gift_card: { denominations_minor: (p.denominations || []).map(d => d.amount_minor), validity_days: p.validity_days, partial_use: !!p.partial_use, top_up_allowed: !!p.top_up_allowed, cashback_on_gift_payment: !!p.cashback_on_gift_payment }, notes: 'Балансы сертификатов — сущность gift_cards; в чеке оплата сертификатом уменьшает paid_money до расчёта наград (settings.exclude_categories_from_rewards).' } });
    },
    preview: (p) => ({ title: 'Сертификаты', badge: '🎁', subtitle: (p.denominations || []).map(d => rub(d.amount_minor)).join(' / ') }),
    estimate: (p, s) => { const sold = Math.max(2, Math.round(s.customers_active * 0.02)); const avg = (p.denominations || []).reduce((a, d) => a + d.amount_minor, 0) / Math.max(1, (p.denominations || []).length); return { cost_month_minor: 0, eligible_orders_month: sold, note: `≈ ${sold} сертификатов/мес → предоплата ${rub(Math.round(sold * avg))}; 10–20 % номинала обычно не используется`, risk: 'low' }; },
  },
  // ───────── LM-18 ─────────
  {
    id: 'lm-18', mechanic: 'review', title: 'Отзывы за баллы', short: '50 баллов за отзыв с фото', goal: 'engagement', tier: 'free', stage: 'V2', complexity: 'S', icon: '⭐',
    summary: 'После подтверждённой покупки — отзыв, после модерации — промо-баллы.',
    params_schema: { type: 'object', required: ['points'], properties: {
      points: P.int('Баллов за отзыв', 50), require_photo: P.bool('Обязательно фото', true), min_length: P.int('Мин. длина текста', 60, { minimum: 0 }),
      window_hours: P.int('Окно после покупки, ч', 72, { minimum: 1, maximum: 720 }), monthly_limit: P.int('Отзывов в месяц на клиента', 4, { minimum: 1 }), ttl_days: P.days('Срок баллов', 30),
    } },
    defaults: () => ({ points: 50, require_photo: true, min_length: 60, window_hours: 72, monthly_limit: 4, ttl_days: 30 }),
    compile(p) {
      const title = `+${pts(p.points)} за отзыв${p.require_photo ? ' с фото' : ''}`;
      return base(this, p, { name: title, priority: 40, stacking: { group: 'bonus', mode: 'stackable' },
        trigger: { type: 'review_approved', params: { require_photo: !!p.require_photo, min_length: p.min_length, window_hours: p.window_hours } },
        actions: [{ type: 'accrue_points', mode: 'fixed', amount: p.points, ttl_days: p.ttl_days, funding: 'merchant', lot_label: 'За отзыв' }], per_customer: { count: p.monthly_limit || 4, period: 'month' }, holdout: 0,
        content: { title, badge: `+${p.points} б.`, subtitle: `В течение ${p.window_hours} ч после покупки`, cta: 'Оставить отзыв', terms: `Баллы начисляются после модерации отзыва${p.require_photo ? ' с фото' : ''} длиной от ${p.min_length} символов, не более ${p.monthly_limit} в месяц. Отзыв публикуется в карточке точки.` } });
    },
    preview: (p) => ({ title: `+${p.points} баллов за отзыв`, badge: '⭐', subtitle: p.require_photo ? 'с фото' : 'текст' }),
    estimate: (p, s) => { const reviews = Math.round(s.orders_month * 0.05); return { cost_month_minor: reviews * p.points * 100 * 0.7, eligible_orders_month: reviews, note: `≈ 5 % чеков → ${reviews} отзывов/мес`, risk: 'low' }; },
  },
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));

/** Значения по умолчанию для полей, которых нет в params (напр. после смены режима). */
export function withDefaults(t, params, ctx) {
  const d = t.defaults(ctx || { category: 'coffee', avg_check_minor: 32000, margin_pct: 60 });
  return { ...d, ...(params || {}) };
}

export default TEMPLATES;

/*
 * Интерактивный прототип «Конструктор лояльности LOVII».
 * Поток: Механика → Настройка (форма из params_schema) → Клиент (витрина/кошелёк) → Касса (quote/commit).
 * Вся логика расчётов — в engine.js (эталонный движок из docs/lovii-loyalty-constructor/03-rules-engine.md).
 */
import { quote, commit, runScheduler, offersFor, inHoldout, fmtRub, plural, ENGINE_VERSION } from './engine.js';
import { TEMPLATES, TEMPLATE_BY_ID, withDefaults, GOALS } from './templates.js';
import { MERCHANT, TEMPLATE_CTX, CATALOG, CATEGORIES, PARTNERS, NOW, makeCustomers } from './demo-data.js';

// ───────────────────────────── состояние ─────────────────────────────

const STARTER = [
  ['lm-01', 'cmp_threshold'], ['lm-06', 'cmp_stamps'], ['lm-04', 'cmp_cashback'], ['lm-05', 'cmp_happy'],
  ['lm-13', 'cmp_coupon'], ['lm-14', 'cmp_winback'], ['lm-15', 'cmp_bday'],
];

const S = {
  step: 'mech',
  goal: 'all', stage: 'all',
  draft: null,            // { template, params, spec }
  campaigns: [],          // { campaign_id, version, status, published_at, spec, budget_used_minor, uses_total, enabled }
  customers: makeCustomers(),
  customerKey: 'regular',
  basket: [{ sku: 'cd1', qty: 2 }],
  coupon: '', redeem: 0, now: NOW, orderSeq: 1,
  q: null, orders: [], feed: [], cmpSeq: 0,
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const rub = (minor) => fmtRub(minor);
const pts = (n) => `${n} ${plural(n, 'балл', 'балла', 'баллов')}`;
const catName = (id) => (CATEGORIES.find(c => c.id === id) || { name: id }).name;
const skuName = (sku) => (CATALOG.find(c => c.sku === sku) || { name: sku }).name;
const dateRu = (iso) => iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }) : '';
const timeRu = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
const WEEKDAYS = ['', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const STAGE_LABEL = { MVP: 'MVP', V2: 'V2' };
const RISK = { low: ['низкий', 'ok'], medium: ['средний', 'warn'], high: ['высокий', 'bad'] };
const TRIGGER_LABEL = { inactivity: 'по неактивности (планировщик)', birthday: 'ко дню рождения (планировщик)', review_approved: 'после модерации отзыва', referral_qualified: 'после первой покупки друга', tier_recalculated: 'при пересчёте уровня (ночью)' };

const REASONS = {
  schedule: 'вне срока действия', window: 'вне окна времени', audience: 'клиент не в аудитории', holdout: 'контрольная группа (A/B)',
  limit_per_customer: 'лимит на клиента исчерпан', limit_total: 'общий лимит исчерпан', budget: 'бюджет исчерпан', coupon_invalid: 'купон недействителен',
  coupon_required: 'нужен промокод', staff_excluded: 'сотрудник точки', guest: 'гость без LOVII', no_effect: 'нет эффекта на этот чек', cap: 'достигнут потолок', stamp_interval: 'штамп уже был недавно',
};
function reasonText(r) {
  if (!r) return '';
  if (REASONS[r]) return REASONS[r];
  if (r.startsWith('condition:')) return 'условие не выполнено (#' + r.split(':')[1] + ')';
  if (r.startsWith('stacking:')) { const [, group, winner] = r.split(':'); const w = S.campaigns.find(c => c.campaign_id === winner); return `перекрыта «${w ? w.spec.name : winner}» (группа ${group})`; }
  return r;
}

// ───────────────────────────── кампании ─────────────────────────────

/** Имена для заголовков: шаблон знает только sku/id, названия подставляет приложение (как это делает кабинет точки). */
function enrich(params) {
  const p = { ...params };
  if (p.offer_sku) p.offer_name = skuName(p.offer_sku);
  if (p.partner_merchant_id) p.partner_name = (PARTNERS.find(x => x.merchant_id === p.partner_merchant_id) || { name: p.partner_merchant_id }).name;
  return p;
}
function compileSpec(template, params) { return template.compile(enrich(withDefaults(template, params, TEMPLATE_CTX))); }
function makeCampaign(template, params, id) {
  const spec = compileSpec(template, params);
  return { campaign_id: id, version: 1, status: 'active', published_at: NOW, spec, budget_used_minor: 0, budget_used_today_minor: 0, uses_total: 0, enabled: true, template_id: template.id };
}
function activeCampaigns() { return S.campaigns.filter(c => c.enabled).map(({ enabled, template_id, ...c }) => c); }
function seedCampaigns() {
  S.campaigns = STARTER.map(([tid, cid]) => { const t = TEMPLATE_BY_ID[tid]; return makeCampaign(t, t.defaults(TEMPLATE_CTX), cid); });
}
function currentCustomer() { return S.customers.find(c => c.key === S.customerKey); }
function contextFor(over = {}) {
  const rec = currentCustomer();
  const items = S.basket.map(b => ({ ...CATALOG.find(c => c.sku === b.sku), qty: b.qty }));
  return { merchant_id: MERCHANT.merchant_id, location_id: MERCHANT.location_id, order_id: `ord_${String(S.orderSeq).padStart(3, '0')}`, channel: 'qr', now: S.now,
    customer: rec.customer, items, coupon_code: S.coupon || null, redeem_points: S.redeem, state: rec.state, catalog: CATALOG, ...over };
}
function runQuote() {
  S.q = quote({ campaigns: activeCampaigns(), context: contextFor(), options: { issue_quote_id: true } });
  if (S.redeem > S.q.points_redeem_max) { S.redeem = S.q.points_redeem_max; S.q = quote({ campaigns: activeCampaigns(), context: contextFor(), options: { issue_quote_id: true } }); }
  return S.q;
}

// ───────────────────────────── UI: каркас ─────────────────────────────

const STEPS = [['mech', '1', 'Механика'], ['setup', '2', 'Настройка'], ['client', '3', 'Клиент'], ['pos', '4', 'Касса']];

function render() {
  const root = $('#lc');
  root.querySelectorAll('.lc-step').forEach(b => b.classList.toggle('on', b.dataset.step === S.step));
  root.querySelectorAll('.lc-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === S.step));
  ({ mech: renderMech, setup: renderSetup, client: renderClient, pos: renderPos })[S.step]();
  renderSide();
}
function go(step) { S.step = step; render(); const el = $('#lc'); if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

function toast(text, kind = '') {
  const box = $('#lc-toasts'); const el = document.createElement('div'); el.className = 'lc-toast ' + kind; el.innerHTML = text; box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4200);
}

// ───────────────────────────── 1. Механика ─────────────────────────────

function renderMech() {
  const el = $('[data-panel="mech"]');
  const goals = [['all', 'Все цели'], ...Object.entries(GOALS)];
  const list = TEMPLATES.filter(t => (S.goal === 'all' || t.goal === S.goal) && (S.stage === 'all' || t.stage === S.stage));
  el.innerHTML = `
    <div class="lc-toolbar">
      <div class="lc-chips" data-role="goal">${goals.map(([k, v]) => `<button class="lc-chip ${S.goal === k ? 'on' : ''}" data-goal="${k}">${esc(v)}</button>`).join('')}</div>
      <div class="lc-chips" data-role="stage">${[['all', 'MVP + V2'], ['MVP', 'Только MVP'], ['V2', 'Только V2']].map(([k, v]) => `<button class="lc-chip ${S.stage === k ? 'on' : ''}" data-stage="${k}">${esc(v)}</button>`).join('')}</div>
    </div>
    <div class="lc-grid">
      ${list.map(t => `
        <button class="lc-mech" data-template="${t.id}">
          <div class="lc-mech-top"><span class="lc-mech-ico">${t.icon}</span><span class="lc-tag ${t.stage === 'MVP' ? 'mvp' : 'v2'}">${STAGE_LABEL[t.stage]}</span>${t.tier === 'pro' ? '<span class="lc-tag pro">PRO</span>' : '<span class="lc-tag free">Free</span>'}</div>
          <div class="lc-mech-title">${esc(t.title)} <span class="lc-mech-id">${t.id.toUpperCase()}</span></div>
          <div class="lc-mech-short">${esc(t.short)}</div>
          <div class="lc-mech-sum">${esc(t.summary)}</div>
          <div class="lc-mech-foot"><span>Цель: ${esc(GOALS[t.goal])}</span><span>Сложность ${t.complexity}</span></div>
        </button>`).join('')}
    </div>
    <p class="lc-note">Каждая карточка — шаблон из каталога <a href="/docs/lovii-loyalty-constructor/02-mechanics-catalog.md">02-mechanics-catalog.md</a>: форма настройки строится из <code>params_schema</code>, а <code>compile()</code> собирает JSON-кампанию для движка правил.</p>`;
  el.querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => { S.goal = b.dataset.goal; renderMech(); }));
  el.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => { S.stage = b.dataset.stage; renderMech(); }));
  el.querySelectorAll('[data-template]').forEach(b => b.addEventListener('click', () => startDraft(b.dataset.template)));
}

function startDraft(templateId, params) {
  const t = TEMPLATE_BY_ID[templateId];
  S.draft = { template: t, params: params ? { ...params } : t.defaults(TEMPLATE_CTX), editId: null };
  go('setup');
}

// ───────────────────────────── 2. Настройка: форма из JSON Schema ─────────────────────────────

function visible(sch, params) {
  const cond = sch['x-showIf']; if (!cond) return true;
  return Object.entries(cond).every(([k, v]) => Array.isArray(v) ? v.includes(params[k]) : params[k] === v);
}
function control(key, sch, v, extraAttrs = '') {
  const w = sch['x-widget'] || (sch.enum ? 'select' : sch.type === 'boolean' ? 'bool' : 'text');
  const a = `data-k="${esc(key)}" data-w="${w}" ${extraAttrs}`;
  const opt = (vals, names, cur, empty) => (empty ? `<option value="" ${cur === '' || cur == null ? 'selected' : ''}>${esc(empty)}</option>` : '') + vals.map((x, i) => `<option value="${esc(x)}" ${String(cur) === String(x) ? 'selected' : ''}>${esc(names[i])}</option>`).join('');
  switch (w) {
    case 'money': return `<span class="lc-inp"><input type="number" ${a} value="${Math.round((v || 0) / 100)}" min="0" step="10"><em>₽</em></span>`;
    case 'percent': return `<span class="lc-inp"><input type="number" ${a} value="${v == null ? '' : v}" min="${sch.minimum != null ? sch.minimum : 0}" max="${sch.maximum != null ? sch.maximum : 100}" step="0.5"><em>%</em></span>`;
    case 'int': return `<span class="lc-inp"><input type="number" ${a} value="${v == null ? '' : v}" min="${sch.minimum != null ? sch.minimum : 0}" ${sch.maximum != null ? `max="${sch.maximum}"` : ''} step="1"><em>${esc(sch['x-unit'] || '')}</em></span>`;
    case 'days': return `<span class="lc-inp"><input type="number" ${a} value="${v == null ? '' : v}" min="1" max="730" step="1"><em>дн.</em></span>`;
    case 'minutes': return `<span class="lc-inp"><input type="number" ${a} value="${v == null ? '' : v}" min="0" max="1440" step="5"><em>мин</em></span>`;
    case 'select': return `<select ${a}>${opt(sch.enum, sch['x-enumNames'] || sch.enum, v)}</select>`;
    case 'bool': return `<label class="lc-switch"><input type="checkbox" ${a} ${v ? 'checked' : ''}><i></i></label>`;
    case 'category': return `<select ${a}>${opt(CATEGORIES.map(c => c.id), CATEGORIES.map(c => c.name), v || '', sch['x-optional'] || !v ? '— любая —' : null)}</select>`;
    case 'categories': return `<span class="lc-chips small">${CATEGORIES.map(c => `<label class="lc-chip ${(v || []).includes(c.id) ? 'on' : ''}"><input type="checkbox" ${a} value="${c.id}" ${(v || []).includes(c.id) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</span>`;
    case 'sku': return `<select ${a}>${opt(CATALOG.map(c => c.sku), CATALOG.map(c => `${c.name} · ${fmtRub(c.price_minor)}`), v)}</select>`;
    case 'merchant': return `<select ${a}>${opt(PARTNERS.map(p => p.merchant_id), PARTNERS.map(p => p.name), v)}</select>`;
    case 'time': return `<input type="time" ${a} value="${esc(v || '')}">`;
    case 'date': return `<input type="date" ${a} value="${esc(v || '')}">`;
    default: return `<input type="text" ${a} value="${esc(v == null ? '' : v)}">`;
  }
}
function rowsControl(key, sch, rows) {
  const cols = sch['x-columns'] || [];
  const cell = (col, r, i) => control(key, { 'x-widget': col.widget, enum: col.enum, 'x-enumNames': col.enumNames, minimum: col.min }, r[col.key], `data-row="${i}" data-col="${esc(col.key)}"`);
  return `<div class="lc-rows"><table><thead><tr>${cols.map(c => `<th>${esc(c.title)}</th>`).join('')}<th></th></tr></thead><tbody>
    ${(rows || []).map((r, i) => `<tr>${cols.map(c => `<td>${cell(c, r, i)}</td>`).join('')}<td><button class="lc-x" data-act="row-del" data-k="${esc(key)}" data-row="${i}" title="Удалить">×</button></td></tr>`).join('')}
  </tbody></table><button class="lc-link" data-act="row-add" data-k="${esc(key)}">+ добавить строку</button></div>`;
}
function renderForm(t, params) {
  const props = t.params_schema.properties || {};
  return Object.entries(props).filter(([, sch]) => visible(sch, params)).map(([key, sch]) => `
    <div class="lc-field ${sch['x-widget'] === 'rows' ? 'wide' : ''}">
      <label>${esc(sch.title)}${(t.params_schema.required || []).includes(key) ? '' : ''}${sch['x-pro'] ? ' <span class="lc-tag pro">PRO</span>' : ''}</label>
      ${sch['x-widget'] === 'rows' ? rowsControl(key, sch, params[key]) : control(key, sch, params[key])}
      ${sch['x-help'] ? `<small>${esc(sch['x-help'])}</small>` : ''}
    </div>`).join('');
}
function readControl(input) {
  const w = input.dataset.w; let v = input.value;
  if (w === 'money') return Math.max(0, Math.round(Number(v || 0) * 100));
  if (w === 'percent') return Math.max(0, Number(v || 0));
  if (['int', 'days', 'minutes'].includes(w)) return Math.max(0, Math.floor(Number(v || 0)));
  if (w === 'bool') return input.checked;
  return v;
}
function bindForm(formEl, onChange) {
  formEl.addEventListener('input', (e) => {
    const inp = e.target; if (!inp.dataset || !inp.dataset.k) return;
    const key = inp.dataset.k; const p = S.draft.params;
    if (inp.dataset.w === 'categories') { const set = new Set(p[key] || []); inp.checked ? set.add(inp.value) : set.delete(inp.value); p[key] = [...set]; onChange(true); return; }
    if (inp.dataset.row != null) { const rows = (p[key] || []).map(r => ({ ...r })); rows[Number(inp.dataset.row)][inp.dataset.col] = readControl(inp); p[key] = rows; onChange(false); return; }
    p[key] = readControl(inp);
    onChange(inp.tagName === 'SELECT' || inp.type === 'checkbox');
  });
  formEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const key = b.dataset.k; const sch = S.draft.template.params_schema.properties[key]; const rows = (S.draft.params[key] || []).slice();
    if (b.dataset.act === 'row-add') { const blank = {}; (sch['x-columns'] || []).forEach(c => { blank[c.key] = c.widget === 'money' || c.widget === 'int' || c.widget === 'percent' ? 0 : c.enum ? c.enum[0] : c.widget === 'time' ? '12:00' : ''; }); rows.push(blank); }
    if (b.dataset.act === 'row-del') rows.splice(Number(b.dataset.row), 1);
    S.draft.params[key] = rows; onChange(true);
  });
}

const SIM_BASKETS = [
  ['Капучино', [['cd1', 1]]], ['Капучино + круассан', [['cd1', 1], ['cd6', 1]]], ['Латте + чизкейк', [['cd2', 1], ['cd8', 1]]], ['Завтрак на двоих', [['cd10', 1], ['cd9', 1], ['cd1', 1], ['cd2', 1]]],
];
function simNowFor(spec) {
  const w = spec.schedule && spec.schedule.windows && spec.schedule.windows[0];
  if (!w) return S.now;
  const base = new Date(S.now); const dow = ((base.getUTCDay() + 6) % 7) + 1; // 1..7 по UTC ≈ Москва днём
  let shift = 0; while (!w.days.includes(((dow - 1 + shift) % 7) + 1) && shift < 7) shift++;
  const d = new Date(base.getTime() + shift * 86400000);
  return `${d.toISOString().slice(0, 10)}T${w.from}:00+03:00`;
}
function renderSimulation(spec, campaign) {
  const trig = (spec.trigger || {}).type;
  if (trig !== 'purchase') return `<div class="lc-sim-note">Механика срабатывает не на кассе, а ${esc(TRIGGER_LABEL[trig] || trig)}. Проверьте её на вкладке «Клиент» → «Запустить планировщик» или в разделе «Касса» после нужного события.</div>`;
  const rec = makeCustomers().find(c => c.key === 'regular'); // «чистая» Аня: 4 штампа, 1 250 баллов
  const now = simNowFor(spec);
  const baskets = spec.mechanic === 'gift_card' ? [['Сертификат 2 000 ₽', [['gc2000', 1]]], ...SIM_BASKETS.slice(0, 2)] : SIM_BASKETS;
  const rows = baskets.map(([name, items]) => {
    const ctx = contextFor({ now, customer: rec.customer, state: rec.state, redeem_points: 0, coupon_code: spec.mechanic === 'coupon' ? spec.trigger.params.coupon.codes[0] : null, items: items.map(([sku, qty]) => ({ ...CATALOG.find(c => c.sku === sku), qty })), order_id: 'ord_sim_' + name.length });
    const r = quote({ campaigns: [campaign], context: ctx });
    const ap = r.applied.filter(a => a.campaign_id === campaign.campaign_id);
    const ex = r.explain.find(x => x.campaign_id === campaign.campaign_id) || {};
    const hint = r.hints.find(h => h.campaign_id === campaign.campaign_id);
    const eff = ap.map(a => a.discount_minor ? `−${rub(a.discount_minor)}` : a.points ? `+${pts(a.points)}` : a.action_type === 'stamp' ? `штамп ${a.details.after}/${a.details.target}` : a.action_type === 'coupon_issue' ? 'купон' : a.action_type === 'random_reward' ? `приз: ${a.details.label}` : a.action_type === 'redeem_subscription_unit' ? 'списан из абонемента' : a.action_type).join(', ');
    return `<tr><td>${esc(name)}<small>${rub(r.gross_total_minor)}</small></td><td>${ex.result === 'applied' ? `<span class="lc-ok">применена</span> ${esc(eff)}` : `<span class="lc-skip">пропуск</span> <small>${esc(reasonText(ex.reason))}</small>`}</td><td><small>${esc(hint ? hint.text : '—')}</small></td></tr>`;
  }).join('');
  return `<table class="lc-sim"><thead><tr><th>Корзина</th><th>Результат</th><th>Подсказка клиенту</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="lc-sim-note">Симуляция для клиента «Аня» (${WEEKDAYS[new Date(now).getUTCDay() === 0 ? 7 : ((new Date(now).getUTCDay() + 6) % 7) + 1]} ${timeRu(now)}) только с этой кампанией; на кассе она будет конкурировать с остальными по правилам стекинга.</div>`;
}

function renderSetup() {
  const el = $('[data-panel="setup"]');
  if (!S.draft) { el.innerHTML = `<div class="lc-empty">Выберите механику на шаге 1.</div>`; return; }
  const { template: t } = S.draft;
  const params = withDefaults(t, S.draft.params, TEMPLATE_CTX); S.draft.params = params;
  let spec, err = null; try { spec = compileSpec(t, params); } catch (e) { err = e; }
  const est = spec ? t.estimate(params, MERCHANT.stats) : null;
  const pv = t.preview(params);
  const tmpCampaign = spec ? { campaign_id: S.draft.editId || 'cmp_draft', version: 1, status: 'active', published_at: NOW, spec } : null;
  const risk = est ? (RISK[est.risk] || RISK.low) : RISK.low;
  el.innerHTML = `
    <div class="lc-setup">
      <div class="lc-form-col">
        <div class="lc-setup-head"><span class="lc-mech-ico">${t.icon}</span><div><div class="lc-h">${esc(t.title)} <span class="lc-tag ${t.stage === 'MVP' ? 'mvp' : 'v2'}">${t.stage}</span></div><div class="lc-sub">${esc(t.summary)}</div></div></div>
        <form class="lc-form" id="lc-form" onsubmit="return false">${renderForm(t, params)}</form>
        ${err ? `<div class="lc-err">Ошибка компиляции: ${esc(err.message)}</div>` : ''}
        <div class="lc-actions">
          <button class="lc-btn primary" id="lc-publish" ${err ? 'disabled' : ''}>${S.draft.editId ? 'Сохранить изменения' : 'Опубликовать кампанию'}</button>
          <button class="lc-btn" id="lc-back">← К механикам</button>
        </div>
      </div>
      <div class="lc-preview-col">
        <div class="lc-card-h">Так увидит клиент</div>
        <div class="lv-phone small">
          <div class="lv-offer">
            <div class="lv-offer-badge">${esc(pv.badge || '')}</div>
            <div class="lv-offer-title">${esc(pv.title)}</div>
            <div class="lv-offer-sub">${esc((pv.subtitle || '').replace('{remaining}', '120'))}</div>
            ${spec && spec.content && spec.content.cta ? `<div class="lv-offer-cta">${esc(spec.content.cta)} →</div>` : ''}
          </div>
          ${spec && spec.content && spec.content.terms ? `<div class="lv-terms">${esc(spec.content.terms)}</div>` : ''}
        </div>
        ${est ? `
        <div class="lc-card-h">Оценка для «${esc(MERCHANT.name)}»</div>
        <div class="lc-est">
          <div><b>${rub(est.cost_month_minor)}</b><span>≈ расход в месяц</span></div>
          <div><b>${est.eligible_orders_month}</b><span>чеков затронет</span></div>
          <div><b class="${risk[1]}">${risk[0]}</b><span>риск для маржи</span></div>
        </div>
        <div class="lc-sim-note">${esc(est.note || '')} · средний чек ${rub(MERCHANT.stats.avg_check_minor)}, ${MERCHANT.stats.orders_month} чеков/мес, маржа ${MERCHANT.stats.margin_pct}%.</div>` : ''}
        ${tmpCampaign ? `<div class="lc-card-h">Симуляция на кассе</div>${renderSimulation(spec, tmpCampaign)}` : ''}
        ${spec ? `<details class="lc-json"><summary>JSON кампании (Spec v${esc(spec.spec_version)}) — то, что уйдёт в <code>POST /merchants/{id}/loyalty/campaigns</code></summary><pre>${esc(JSON.stringify(spec, null, 2))}</pre></details>` : ''}
      </div>
    </div>`;
  bindForm($('#lc-form', el), (rerender) => { if (rerender) renderSetup(); else refreshSetupPreview(); });
  $('#lc-back', el).addEventListener('click', () => go('mech'));
  $('#lc-publish', el).addEventListener('click', publishDraft);
}
let refreshTimer = null;
function refreshSetupPreview() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { const f = $('#lc-form'); const active = document.activeElement; const k = active && active.dataset ? [active.dataset.k, active.dataset.row, active.dataset.col].join('|') : null; renderSetup(); if (k) { const again = [...document.querySelectorAll('#lc-form [data-k]')].find(i => [i.dataset.k, i.dataset.row, i.dataset.col].join('|') === k); if (again) { again.focus(); try { again.setSelectionRange(again.value.length, again.value.length); } catch (e) { /* number input */ } } } }, 350); }

function publishDraft() {
  const { template: t, params, editId } = S.draft;
  if (editId) {
    const c = S.campaigns.find(x => x.campaign_id === editId);
    const spec = compileSpec(t, params);
    Object.assign(c, { spec, version: c.version + 1, published_at: S.now });
    toast(`Кампания «${esc(spec.name)}» обновлена (версия ${c.version})`, 'ok');
  } else {
    const id = `cmp_${t.mechanic}_${++S.cmpSeq}`;
    const c = makeCampaign(t, params, id); c.published_at = S.now;
    S.campaigns.push(c);
    toast(`Опубликовано: «${esc(c.spec.name)}». Проверьте витрину клиента и кассу.`, 'ok');
  }
  S.draft = null;
  go('client');
}

// ───────────────────────────── 3. Клиент ─────────────────────────────

function customerChips() {
  return `<div class="lc-chips" data-role="customer">${S.customers.map(c => `<button class="lc-chip ${S.customerKey === c.key ? 'on' : ''}" data-customer="${c.key}">${c.emoji} ${esc(c.label)}</button>`).join('')}</div>`;
}
function bindCustomerChips(el) { el.querySelectorAll('[data-customer]').forEach(b => b.addEventListener('click', () => { S.customerKey = b.dataset.customer; S.redeem = 0; S.coupon = ''; render(); })); }

function renderClient() {
  const el = $('[data-panel="client"]');
  const rec = currentCustomer(); const cust = rec.customer; const st = rec.state;
  const offers = cust ? offersFor({ campaigns: activeCampaigns(), customer: cust, state: st, now: S.now, merchant_id: MERCHANT.merchant_id }) : [];
  const lots = (st.lots || []).filter(l => l.amount_left > 0);
  const promo = lots.filter(l => l.expires_at);
  const coupons = (st.coupons || []).filter(c => !c.used);
  const hidden = cust ? S.campaigns.filter(c => c.enabled && c.spec.mechanic !== 'platform_base' && c.spec.audience && c.spec.audience.holdout_pct > 0 && inHoldout(cust.id, c.campaign_id, c.spec.audience.holdout_pct)) : [];
  el.innerHTML = `
    <div class="lc-client">
      <div class="lc-client-left">
        <div class="lc-card-h">Кто открыл приложение</div>
        ${customerChips()}
        ${cust ? `<div class="lc-kv">
          <div><span>Статус LOVII</span><b>${esc(cust.status)}</b></div><div><span>Покупок у точки</span><b>${cust.orders_at_merchant}</b></div>
          <div><span>Последняя покупка</span><b>${cust.days_since_last_purchase == null ? '—' : cust.days_since_last_purchase + ' дн. назад'}</b></div><div><span>До дня рождения</span><b>${cust.birthday_in_days} дн.</b></div>
          <div><span>Сегменты</span><b>${esc(cust.segments.join(', '))}${cust.is_staff ? ', staff' : ''}</b></div><div><span>ID</span><b>${esc(cust.id)}</b></div>
        </div>` : `<div class="lc-sim-note">Гость без аккаунта LOVII: видит цены и скидки, но баллы и штампы ему не начисляются — на кассе движок вернёт причину <code>guest</code>.</div>`}
        <div class="lc-card-h">Планировщик (cron 10:00)</div>
        <p class="lc-p">Win-back и день рождения срабатывают не на кассе, а по расписанию. Запустите планировщик за «сегодня» (${dateRu(S.now)}) — он пройдёт по всем клиентам точки и выдаст баллы/купоны тем, кто подходит.</p>
        <button class="lc-btn" id="lc-sched">▶ Запустить планировщик</button>
        ${S.feed.length ? `<div class="lc-card-h">Лента уведомлений</div><div class="lc-feed">${S.feed.slice(-6).reverse().map(f => `<div class="lc-feed-item"><b>${esc(f.to)}</b> <span>${esc(f.text)}</span><small>${esc(f.at)}</small></div>`).join('')}</div>` : ''}
        ${hidden.length ? `<div class="lc-sim-note">🧪 Для этого клиента в контрольной группе (holdout): ${hidden.map(c => `«${esc(c.spec.name)}»`).join(', ')} — он не видит акцию и не получает награду, чтобы можно было измерить эффект.</div>` : ''}
      </div>
      <div class="lv-phone">
        <div class="lv-top"><span>Твой район: Тверской</span><span class="lv-time">${timeRu(S.now)}</span></div>
        <div class="lv-store"><div class="lv-store-name">${esc(MERCHANT.name)}</div><div class="lv-store-meta">Открыто · 250 м · заказ от 150 ₽</div></div>
        ${cust ? `<div class="lv-wallet"><div class="lv-wallet-row"><span>Баланс</span><b>${cust.points_balance} б.</b></div><div class="lv-wallet-sub">1 балл = 1 ₽ · базовые баллы не сгорают${promo.length ? ` · промо: ${promo.map(l => `${l.amount_left} до ${dateRu(l.expires_at)}`).join(', ')}` : ''}</div></div>` : `<div class="lv-wallet"><div class="lv-wallet-row"><span>Войдите в LOVII</span><b>→</b></div><div class="lv-wallet-sub">кэшбэк 5 % баллами у всех точек района</div></div>`}
        <div class="lv-h">Ваша выгода здесь</div>
        ${offers.length ? offers.map(o => `
          <div class="lv-offer ${o.active_now ? '' : 'off'}">
            <div class="lv-offer-badge">${esc(o.badge || '')}</div>
            <div class="lv-offer-title">${esc(o.title)}</div>
            ${o.subtitle ? `<div class="lv-offer-sub">${esc(o.subtitle)}</div>` : ''}
            ${o.progress ? `<div class="lv-progress"><div class="lv-bar"><i style="width:${Math.min(100, Math.round(o.progress.current / o.progress.target * 100))}%"></i></div><span>${o.progress.pending_reward ? 'подарок ждёт на кассе' : `${o.progress.current} из ${o.progress.target}`}</span></div>` : ''}
            ${o.windows ? `<div class="lv-offer-note">${o.active_now ? `⏰ ещё ${o.window_ends_in_min} мин` : `⏰ ${o.windows.map(w => `${w.days.length === 7 ? 'ежедневно' : w.days.map(d => WEEKDAYS[d]).join(',')} ${w.from}–${w.to}`).join('; ')}`}</div>` : ''}
          </div>`).join('') : `<div class="lv-empty">${cust ? 'Активных предложений нет — опубликуйте кампанию на шаге 1–2.' : 'Гость видит только публичные скидки.'}</div>`}
        ${coupons.length ? `<div class="lv-h">Мои купоны</div>${coupons.map(c => `<div class="lv-coupon"><b>${esc(c.code)}</b><span>${esc(c.title)}</span><small>до ${dateRu(c.expires_at)}${c.redeemer_merchant_id && c.redeemer_merchant_id !== MERCHANT.merchant_id ? ` · у партнёра ${esc((PARTNERS.find(p => p.merchant_id === c.redeemer_merchant_id) || {}).name || c.redeemer_merchant_id)}` : ''}</small></div>`).join('')}` : ''}
        <div class="lv-nav"><span>Главная</span><span class="on">Кошелёк</span><span>QR</span><span>Профиль</span></div>
      </div>
    </div>
    <div class="lc-actions"><button class="lc-btn primary" id="lc-to-pos">Перейти к кассе →</button></div>`;
  bindCustomerChips(el);
  $('#lc-sched', el).addEventListener('click', runSchedulerNow);
  $('#lc-to-pos', el).addEventListener('click', () => go('pos'));
}

function runSchedulerNow() {
  const at = S.now.slice(0, 10) + 'T10:00:00+03:00';
  const out = runScheduler({ campaigns: activeCampaigns(), customers: S.customers, now: at, merchant_id: MERCHANT.merchant_id });
  if (!out.length) { toast('Планировщик прошёл: подходящих клиентов нет (или уже выдано сегодня).'); }
  for (const o of out) {
    const rec = S.customers.find(c => c.customer && c.customer.id === o.customer_id);
    const camp = S.campaigns.find(c => c.campaign_id === o.campaign_id);
    const parts = [...o.issued.lots.map(l => `+${pts(l.amount)}${l.expires_at ? ` до ${dateRu(l.expires_at)}` : ''}`), ...o.issued.coupons.map(c => `купон ${c.code} до ${dateRu(c.expires_at)}`)];
    const text = `«${camp ? camp.spec.name : o.campaign_id}» → ${parts.join('; ')}`;
    S.feed.push({ to: `${rec.emoji} ${rec.customer.name}`, text, at: `${dateRu(at)} 10:00` });
    toast(`📲 ${esc(rec.customer.name)}: ${esc(text)}`, 'ok');
  }
  render();
}

// ───────────────────────────── 4. Касса ─────────────────────────────

const TIME_PRESETS = [['Сейчас · вт 09:40', '2026-09-22T09:40:00+03:00'], ['Вечер · вт 19:30', '2026-09-22T19:30:00+03:00'], ['Выходной · сб 12:00', '2026-09-26T12:00:00+03:00'], ['Через неделю', '2026-09-29T09:40:00+03:00']];

function renderPos() {
  const el = $('[data-panel="pos"]');
  const r = runQuote();
  const rec = currentCustomer(); const cust = rec.customer;
  const applied = r.applied;
  const discounts = applied.filter(a => a.discount_minor > 0);
  const bySku = Object.fromEntries(r.lines.map(l => [l.sku + (l.added ? ':added' : ''), l]));
  const nonPurchase = S.campaigns.filter(c => c.enabled && (c.spec.trigger || {}).type !== 'purchase');
  const explainRows = r.explain.filter(x => x.campaign_id !== 'platform_base' || true).map(x => `<tr><td>${esc(x.name || x.campaign_id)}</td><td>${x.result === 'applied' ? '<span class="lc-ok">применена</span>' : `<span class="lc-skip">пропуск</span> <small>${esc(reasonText(x.reason))}</small>`}</td></tr>`)
    .concat(nonPurchase.map(c => `<tr><td>${esc(c.spec.name)}</td><td><span class="lc-skip">событие</span> <small>${esc(TRIGGER_LABEL[c.spec.trigger.type] || c.spec.trigger.type)}</small></td></tr>`)).join('');
  el.innerHTML = `
    <div class="lc-pos">
      <div class="lc-pos-left">
        <div class="lc-card-h">Клиент у кассы</div>
        ${customerChips()}
        <div class="lc-card-h">Время чека</div>
        <div class="lc-chips">${TIME_PRESETS.map(([n, iso]) => `<button class="lc-chip ${S.now === iso ? 'on' : ''}" data-now="${iso}">${esc(n)}</button>`).join('')}<input type="datetime-local" id="lc-dt" value="${S.now.slice(0, 16)}"></div>
        <div class="lc-card-h">Номенклатура <small>(нажмите, чтобы добавить)</small></div>
        <div class="lc-catalog">${CATALOG.map(p => `<button class="lc-prod" data-add="${p.sku}"><span>${esc(p.name)}</span><small>${catName(p.category)} · ${rub(p.price_minor)}</small></button>`).join('')}</div>
        <div class="lc-card-h">Промокод и баллы</div>
        <div class="lc-row">
          <span class="lc-inp grow"><input type="text" id="lc-coupon" placeholder="Промокод или код купона" value="${esc(S.coupon)}"></span>
          <button class="lc-btn" id="lc-coupon-apply">Применить</button>
        </div>
        ${r.coupon ? `<div class="lc-sim-note">${r.coupon.valid ? `✅ Купон ${esc(r.coupon.code)} принят` : `⛔ Купон ${esc(r.coupon.code)}: ${esc(reasonText(r.coupon.reason) || r.coupon.reason)}`}</div>` : ''}
        ${cust ? `<div class="lc-row"><label class="lc-range"><span>Списать баллы: <b>${S.redeem}</b> из ${r.points_redeem_max} доступных (не более 50 % чека; баланс ${cust.points_balance})</span><input type="range" id="lc-redeem" min="0" max="${r.points_redeem_max}" step="10" value="${S.redeem}"></label></div>` : ''}
      </div>
      <div class="lc-receipt">
        <div class="lc-receipt-head"><b>${esc(MERCHANT.name)}</b><span>чек ${esc(contextFor().order_id)} · ${WEEKDAYS[r.local.weekday]} ${r.local.date.slice(8, 10)}.${r.local.date.slice(5, 7)} ${r.local.time}</span></div>
        ${S.basket.length || r.lines.some(l => l.added) ? r.lines.map((l, i) => `
          <div class="lc-line ${l.added ? 'added' : ''}">
            <div class="lc-line-name">${esc(l.name)}${l.added ? ' <small>подарок</small>' : ''}</div>
            <div class="lc-line-qty">${l.added ? `<span>${l.qty}</span>` : `<button data-qty="${esc(l.sku)}:-1">−</button><span>${l.qty}</span><button data-qty="${esc(l.sku)}:1">+</button>`}</div>
            <div class="lc-line-sum">${l.discount_minor ? `<s>${rub(l.price_minor * l.qty)}</s> ` : ''}<b>${rub(l.final_minor)}</b></div>
          </div>`).join('') : '<div class="lc-empty">Корзина пуста — добавьте позиции из номенклатуры.</div>'}
        <div class="lc-tot"><span>Сумма</span><b>${rub(r.gross_total_minor)}</b></div>
        ${discounts.map(a => `<div class="lc-tot dis"><span>${esc(a.title)}</span><b>−${rub(a.discount_minor)}</b></div>`).join('')}
        ${r.points_redeemed ? `<div class="lc-tot dis"><span>Оплата баллами</span><b>−${rub(r.points_redeemed * 100)}</b></div>` : ''}
        <div class="lc-tot big"><span>К оплате</span><b>${rub(r.paid_money_minor)}</b></div>
        ${cust ? `<div class="lc-accr"><div class="lc-card-h">Начислится после оплаты</div>
          ${r.lots_to_accrue.length ? r.lots_to_accrue.map(l => `<div class="lc-tot"><span>${esc(l.label)}${l.expires_at ? ` <small>до ${dateRu(l.expires_at)}</small>` : ' <small>бессрочно</small>'}</span><b>+${l.points}</b></div>`).join('') : '<div class="lc-sim-note">Баллов не будет.</div>'}
          ${r.stamps.map(s => `<div class="lc-tot"><span>Штампы «${esc(s.card)}»</span><b>${s.before} → ${s.after} из ${s.target}${s.completed ? ' 🎉' : ''}</b></div>`).join('')}
          ${applied.filter(a => a.action_type === 'random_reward').map(a => `<div class="lc-tot"><span>🎡 Приз</span><b>${esc(a.details.label)}</b></div>`).join('')}
          ${r.coupons_issued.map(c => `<div class="lc-tot"><span>🎟 Купон ${esc(c.code)}</span><b>${esc(c.title)}</b></div>`).join('')}
        </div>` : '<div class="lc-sim-note">Гость: баллы и штампы не начисляются.</div>'}
        ${r.hints.length ? `<div class="lc-card-h">Подсказки кассиру / клиенту</div>${r.hints.map(h => `<div class="lc-hint"><span>${esc(h.text)}</span>${h.suggested_item ? `<button class="lc-btn xs" data-add="${esc(h.suggested_item.sku)}">Добавить</button>` : h.type === 'coupon_available' ? `<button class="lc-btn xs" data-coupon="${esc(h.details.code)}">Применить</button>` : ''}</div>`).join('')}` : ''}
        <button class="lc-btn primary wide" id="lc-pay" ${r.gross_total_minor ? '' : 'disabled'}>Оплатить ${rub(r.paid_money_minor)}${cust ? ` · баллами ${r.points_redeemed}` : ''}</button>
        <details class="lc-json"><summary>Почему так: explain (${r.explain.length + nonPurchase.length})</summary><table class="lc-sim">${explainRows}</table></details>
        <details class="lc-json"><summary>Ответ <code>POST /loyalty/quote</code> (engine ${esc(ENGINE_VERSION)})</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details>
      </div>
    </div>
    ${S.orders.length ? `<div class="lc-card-h">История чеков</div><div class="lc-orders">${S.orders.slice().reverse().map(o => `<div class="lc-order"><b>${esc(o.order_id)}</b><span>${esc(o.who)}</span><span>${rub(o.paid)}</span><span>${o.points ? `+${o.points} б.` : ''}${o.extra ? ' · ' + esc(o.extra) : ''}</span><small>${esc(o.at)}</small></div>`).join('')}</div>` : ''}`;
  bindCustomerChips(el);
  el.querySelectorAll('[data-now]').forEach(b => b.addEventListener('click', () => { S.now = b.dataset.now; renderPos(); }));
  $('#lc-dt', el).addEventListener('change', (e) => { if (e.target.value) { S.now = e.target.value.length === 16 ? e.target.value + ':00+03:00' : e.target.value + '+03:00'; renderPos(); } });
  el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { addToBasket(b.dataset.add); renderPos(); }));
  el.querySelectorAll('[data-qty]').forEach(b => b.addEventListener('click', () => { const [sku, d] = b.dataset.qty.split(':'); const it = S.basket.find(x => x.sku === sku); if (!it) return; it.qty += Number(d); if (it.qty <= 0) S.basket = S.basket.filter(x => x !== it); renderPos(); }));
  el.querySelectorAll('[data-coupon]').forEach(b => b.addEventListener('click', () => { S.coupon = b.dataset.coupon; renderPos(); }));
  $('#lc-coupon-apply', el).addEventListener('click', () => { S.coupon = $('#lc-coupon', el).value.trim(); renderPos(); });
  $('#lc-coupon', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') { S.coupon = e.target.value.trim(); renderPos(); } });
  const rg = $('#lc-redeem', el); if (rg) rg.addEventListener('change', () => { S.redeem = Number(rg.value); renderPos(); });
  $('#lc-pay', el).addEventListener('click', pay);
}
function addToBasket(sku) { const it = S.basket.find(x => x.sku === sku); if (it) it.qty += 1; else S.basket.push({ sku, qty: 1 }); }

function pay() {
  const r = S.q; const rec = currentCustomer();
  const input = { campaigns: activeCampaigns(), context: contextFor() };
  const out = commit(input, r);
  // применяем новое состояние
  rec.state = out.state; if (out.customer) rec.customer = out.customer;
  for (const c of out.campaigns) { const mine = S.campaigns.find(x => x.campaign_id === c.campaign_id); if (mine) Object.assign(mine, { budget_used_minor: c.budget_used_minor, budget_used_today_minor: c.budget_used_today_minor, uses_total: c.uses_total, status: c.status }); }
  const extra = [...r.stamps.filter(s => s.completed).map(() => 'карта штампов заполнена'), ...r.applied.filter(a => a.action_type === 'random_reward').map(a => `приз: ${a.details.label}`), ...r.coupons_issued.map(c => `купон ${c.code}`)].join(', ');
  S.orders.push({ order_id: contextFor().order_id, who: rec.customer ? rec.customer.name : 'гость', paid: r.paid_money_minor, points: r.points_to_accrue, extra, at: `${dateRu(S.now)} ${timeRu(S.now)}` });
  const parts = [`оплачено ${rub(r.paid_money_minor)}`];
  if (r.points_to_accrue) parts.push(`начислено ${pts(r.points_to_accrue)}`);
  if (r.points_redeemed) parts.push(`списано ${r.points_redeemed}`);
  if (extra) parts.push(extra);
  toast(`✅ Чек ${esc(contextFor().order_id)}: ${esc(parts.join(' · '))}`, 'ok');
  for (const n of r.notifications) toast(`📲 push «${esc(n.template)}» → ${esc(rec.customer ? rec.customer.name : '')}`);
  const paused = out.campaigns.filter(c => c.status === 'paused_budget');
  for (const c of paused) toast(`⏸ «${esc(c.spec.name)}» встала на паузу: бюджет исчерпан`, 'warn');
  S.orderSeq += 1; S.redeem = 0; S.coupon = ''; S.basket = [];
  renderPos(); renderSide();
}

// ───────────────────────────── боковая панель ─────────────────────────────

function renderSide() {
  const el = $('#lc-side');
  const groups = {};
  for (const c of S.campaigns) (groups[c.spec.stacking.group] = groups[c.spec.stacking.group] || []).push(c);
  el.innerHTML = `
    <div class="lc-card-h">Кампании точки <small>${S.campaigns.filter(c => c.enabled).length} акт.</small></div>
    ${S.campaigns.map(c => { const t = TEMPLATE_BY_ID[c.template_id]; const lim = c.spec.limits || {}; return `
      <div class="lc-camp ${c.enabled ? '' : 'off'} ${c.status === 'paused_budget' ? 'paused' : ''}">
        <label class="lc-switch"><input type="checkbox" data-toggle="${c.campaign_id}" ${c.enabled ? 'checked' : ''}><i></i></label>
        <div class="lc-camp-body">
          <div class="lc-camp-title">${t ? t.icon : '•'} ${esc(c.spec.name)}</div>
          <div class="lc-camp-meta">${esc(c.campaign_id)} · v${c.version} · ${esc(c.spec.stacking.group)}/${c.spec.stacking.mode} · prio ${c.spec.priority}${lim.budget_total_minor ? ` · бюджет ${rub(c.budget_used_minor || 0)} / ${rub(lim.budget_total_minor)}` : ''}${c.status === 'paused_budget' ? ' · <b>пауза</b>' : ''}</div>
        </div>
        <button class="lc-x" data-edit="${c.campaign_id}" title="Настроить">✎</button>
      </div>`; }).join('')}
    <div class="lc-side-foot">
      <button class="lc-link" id="lc-add">+ Новая кампания</button>
      <button class="lc-link" id="lc-reset">Сбросить демо</button>
    </div>
    <div class="lc-side-legend">Группы стекинга: ${Object.keys(groups).map(g => `<code>${esc(g)}</code>`).join(' ')} — внутри exclusive-группы побеждает больший приоритет, кэшбэки складываются.</div>`;
  el.querySelectorAll('[data-toggle]').forEach(i => i.addEventListener('change', () => { const c = S.campaigns.find(x => x.campaign_id === i.dataset.toggle); c.enabled = i.checked; render(); }));
  el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => { const c = S.campaigns.find(x => x.campaign_id === b.dataset.edit); const t = TEMPLATE_BY_ID[c.template_id]; S.draft = { template: t, params: { ...withDefaults(t, c.spec.meta.template_params, TEMPLATE_CTX) }, editId: c.campaign_id }; go('setup'); }));
  $('#lc-add', el).addEventListener('click', () => go('mech'));
  $('#lc-reset', el).addEventListener('click', () => { Object.assign(S, { customers: makeCustomers(), basket: [{ sku: 'cd1', qty: 2 }], coupon: '', redeem: 0, now: NOW, orderSeq: 1, orders: [], feed: [], cmpSeq: 0, draft: null }); seedCampaigns(); toast('Демо сброшено к исходному состоянию'); go('mech'); });
}

// ───────────────────────────── init ─────────────────────────────

export function init() {
  seedCampaigns();
  const root = $('#lc');
  root.querySelectorAll('.lc-step').forEach(b => b.addEventListener('click', () => go(b.dataset.step)));
  render();
}

if (typeof document !== 'undefined' && document.getElementById('lc')) init();

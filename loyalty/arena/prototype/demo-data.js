/*
 * Демо-данные: точка «Daily» (кофейня, район Тверской), каталог, профили клиентов, соседи по району.
 * Используются прототипом и генератором примеров кампаний (docs/…/examples/build-examples.mjs).
 */

export const MERCHANT = {
  merchant_id: 'mrc_daily', location_id: 'loc_tverskoy', name: 'Кофейня «Daily»', category: 'coffee', timezone: 'Europe/Moscow',
  stats: { orders_month: 1240, avg_check_minor: 32000, margin_pct: 62, customers_active: 410, sleeping_count: 74, new_customers_month: 46, cheap_item_price_minor: 15000, upsell_list_price_minor: 32000, free_item_price_minor: 15000, gift_item_price_minor: 32000 },
};

export const TEMPLATE_CTX = { category: 'coffee', avg_check_minor: 32000, margin_pct: 62, cheap_sku: 'cd3', upsell_sku: 'cd8', upsell_price_minor: 19900, margin_category: 'dessert', evening_category: 'bakery', stamp_categories: ['coffee', 'tea'], code_prefix: 'DAILY', sleep_days: 45 };

export const CATALOG = [
  { sku: 'cd1', name: 'Капучино', category: 'coffee', price_minor: 22000, tags: ['drink', 'hot'] },
  { sku: 'cd2', name: 'Латте', category: 'coffee', price_minor: 25000, tags: ['drink', 'hot'] },
  { sku: 'cd3', name: 'Эспрессо', category: 'coffee', price_minor: 15000, tags: ['drink', 'hot'] },
  { sku: 'cd4', name: 'Раф', category: 'coffee', price_minor: 29000, tags: ['drink'] },
  { sku: 'cd5', name: 'Чай', category: 'tea', price_minor: 18000, tags: ['drink', 'hot'] },
  { sku: 'cd6', name: 'Круассан', category: 'bakery', price_minor: 16400, tags: ['food'] },
  { sku: 'cd7', name: 'Слойка с вишней', category: 'bakery', price_minor: 18000, tags: ['food'] },
  { sku: 'cd8', name: 'Чизкейк', category: 'dessert', price_minor: 32000, tags: ['food', 'sweet'] },
  { sku: 'cd9', name: 'Тирамису', category: 'dessert', price_minor: 35000, tags: ['food', 'sweet'] },
  { sku: 'cd10', name: 'Сырники', category: 'breakfast', price_minor: 34000, tags: ['food'] },
  { sku: 'cd11', name: 'Сэндвич', category: 'breakfast', price_minor: 29000, tags: ['food'] },
  { sku: 'gc2000', name: 'Сертификат 2 000 ₽', category: 'gift_card', price_minor: 200000, tags: ['gift'] },
];

export const CATEGORIES = [
  { id: 'coffee', name: 'Кофе' }, { id: 'tea', name: 'Чай' }, { id: 'bakery', name: 'Выпечка' }, { id: 'dessert', name: 'Десерты' }, { id: 'breakfast', name: 'Завтраки' }, { id: 'gift_card', name: 'Сертификаты' },
];

export const PARTNERS = [
  { merchant_id: 'mrc_sloyka', name: 'Слойка' }, { merchant_id: 'mrc_miya', name: 'Суши «Мия»' }, { merchant_id: 'mrc_beauty', name: 'Салон «Красота»' },
];

export const NOW = '2026-09-22T09:40:00+03:00';

// Профили клиентов: customer (для условий) + state (у точки)
export function makeCustomers() {
  return [
    {
      key: 'new', label: 'Новый клиент', emoji: '🆕',
      customer: { id: 'cus_new', name: 'Дима', status: 'PAY', tier: null, orders_at_merchant: 0, days_since_last_purchase: null, visits_30d: 0, spent_90d: 0, is_staff: false, birthday_in_days: 120, segments: ['new'], points_balance: 0 },
      state: { stamps: {}, counters: {}, subscriptions: [], challenges: {}, coupons: [], lots: [] },
    },
    {
      key: 'regular', label: 'Постоянная · Аня', emoji: '👩',
      customer: { id: 'cus_1', name: 'Аня', status: 'PASS', tier: null, orders_at_merchant: 12, days_since_last_purchase: 3, visits_30d: 6, spent_90d: 1240000, is_staff: false, birthday_in_days: 40, segments: ['regular'], points_balance: 1250 },
      state: {
        stamps: { coffee: { count: 4, last_at: '2026-09-20T10:00:00+03:00' } }, counters: {}, subscriptions: [], challenges: {}, coupons: [],
        lots: [
          { lot_id: 'lot_base', label: 'Баллы LOVII', amount: 1050, amount_left: 1050, expires_at: null, funding: 'platform', merchant_id: null },
          { lot_id: 'lot_p1', label: 'От 450 ₽ — +60 баллов', amount: 200, amount_left: 200, expires_at: '2026-09-26T23:59:59+03:00', funding: 'merchant', merchant_id: 'mrc_daily' },
        ],
      },
    },
    {
      key: 'sleeping', label: 'Уснувший · Игорь', emoji: '💤',
      customer: { id: 'cus_sleep', name: 'Игорь', status: 'PAY', tier: null, orders_at_merchant: 5, days_since_last_purchase: 47, visits_30d: 0, spent_90d: 68000, is_staff: false, birthday_in_days: 200, segments: ['sleeping'], points_balance: 300 },
      state: { stamps: { coffee: { count: 2, last_at: '2026-08-06T12:00:00+03:00' } }, counters: {}, subscriptions: [], challenges: {}, coupons: [], lots: [{ lot_id: 'lot_base', label: 'Баллы LOVII', amount: 300, amount_left: 300, expires_at: null, funding: 'platform', merchant_id: null }] },
    },
    {
      key: 'birthday', label: 'Именинница · Оля', emoji: '🎂',
      customer: { id: 'cus_bday', name: 'Оля', status: 'VIP', tier: null, orders_at_merchant: 8, days_since_last_purchase: 9, visits_30d: 2, spent_90d: 540000, is_staff: false, birthday_in_days: 3, segments: ['regular'], points_balance: 4200 },
      state: { stamps: {}, counters: {}, subscriptions: [], challenges: {}, coupons: [], lots: [{ lot_id: 'lot_base', label: 'Баллы LOVII', amount: 4200, amount_left: 4200, expires_at: null, funding: 'platform', merchant_id: null }] },
    },
    {
      key: 'staff', label: 'Сотрудник · Марк', emoji: '🧑‍🍳',
      customer: { id: 'cus_staff', name: 'Марк', status: 'PAY', tier: null, orders_at_merchant: 30, days_since_last_purchase: 1, visits_30d: 20, spent_90d: 300000, is_staff: true, birthday_in_days: 77, segments: ['regular'], points_balance: 90 },
      state: { stamps: {}, counters: {}, subscriptions: [], challenges: {}, coupons: [], lots: [{ lot_id: 'lot_base', label: 'Баллы LOVII', amount: 90, amount_left: 90, expires_at: null, funding: 'platform', merchant_id: null }] },
    },
    {
      key: 'guest', label: 'Гость (без LOVII)', emoji: '👤',
      customer: null,
      state: { stamps: {}, counters: {}, subscriptions: [], challenges: {}, coupons: [], lots: [] },
    },
  ];
}

export default { MERCHANT, TEMPLATE_CTX, CATALOG, CATEGORIES, PARTNERS, NOW, makeCustomers };

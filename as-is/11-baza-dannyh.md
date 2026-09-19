# 11. База данных: как хранится информация — как есть

> Срез: 2026-09-17 (структура — по снимку staging 2026-09-13), **обновлено
> 2026-09-19** (волна миграций подписки/выплат/ПЭП — см. «Прибавилось 18–19.09»).
> Полный разбор всех 85 таблиц с колонками и числами строк:
> `lovii_docs/artifacts/db-schema-analysis.md` (обновлять при волнах миграций).
> Этот док — навигационная выжимка. Формат — [README](README.md).

## Устройство: одна БД, три схемы

PostgreSQL `lovii-core`, три схемы = три приложения:

| Схема | Приложение | Что хранит |
|---|---|---|
| `public` | lovii-core | всё ядро: витрина, каталог, корзина, заказы, платежи, баллы, ledger, роли, OTP |
| `lovii_b2b` | lovii-b2b | юрлица-партнёры, пользователи кабинета, членства, аудит |
| `lovii_admin` | lovii-admin | админы, роли/права (spatie), activity log |

Служебные таблицы Laravel (jobs/cache/sessions/migrations) повторяются во всех трёх,
но реально очередь и кэш — в Redis.

## Конвенции (важно понимать до любых правок)

1. **Деньги везде в копейках**: `orders.total`, `payments.amount`, `merchant_offers.price`,
   `cart_items.*_snapshot`, `loyalty-` суммы — `integer`; `accounts.balance`,
   `ledger_entries.amount` — `bigint` (рубли). `wallets.balance` — тоже integer, но это **баллы**.
2. **Enum-типов в БД нет** — все статусы `varchar` с default; допустимые значения
   живут в коде (Laravel Enum). Менять статусы SQL-ом = риск порвать логику.
3. **Timestamps без часового пояса**, исключения — `partners.verified_at` и
   `representative_approved_at` (timestamptz).
4. **Cross-schema связи — без FK**: `merchants.partner_id → lovii_b2b.partners`,
   `partner_users.core_user_id → users.id` и т.д. держатся кодом, не БД. Массовые
   SQL-апдейты мимо моделей рвут связки и не переиндексируют Scout.
5. **Идентификатор пользователя = `users.id`** (колонки uid нет); вход по `phone` unique.
6. Soft-delete (`deleted_at`) есть у merchants/branches/offers/catalog; у users —
   статусная деактивация (`status` + `deactivated_at`), у orders/partners — нет.

## Карта доменов → основные таблицы

### Пользователи и вход
- `users` — phone [U], статус, ФИО, email, д.р.; **uid = id**.
- `personal_access_tokens` — Sanctum-токены (abilities `['*']`, TTL null).
- `guest_sessions` — гостевые токены корзины (TTL 30 дней).
- `user_devices`, `user_addresses` (location geography, is_default), `user_email_verifications`.
- `auth_otp_sessions` — OTP-сессии (code_hash, attempts, channel, binding_token); **без FK** — связка по телефону.
- `max_bot_links` — привязка телефон↔чат бота MAX (по ботам otp/orders/support).

### Витрина и каталог
- `merchants` — **витрина/вывеска**: name, slug, merchant_type, status
  (pending_moderation→active), лого/обложка, tariff (start/basic/pro), **partner_id
  (логически → lovii_b2b.partners)**, юридические поля (inn, legal_name…).
- `merchant_branches` — **точки/филиалы**: merchant_id [FK], city_id, address_line,
  location, working_hours jsonb, pickup/delivery_available, min_order_amount,
  **partner_id (логически)**. `id` филиала = `/stores/{id}` витрины.
- `merchant_offers` — **позиции МСП** (1,2 млн строк): merchant_id, branch_id
  (привязка к филиалу), **catalog_product_id [FK] — фото/описание живут здесь**,
  price/old_price (копейки), is_available, is_restricted (18+), source_type.
- `catalog_products` (202 тыс.) — товары Kuper-импорта (media jsonb); два каталога:
  Kuper-импорт vs позиции МСП (решение SZ-005).
- `catalog_categories` — дерево категорий витрины; `merchant_categories` — чипы
  типов точек (is_adult_only); `merchant_delivery_zones` — зоны (polygon geography).
- `offer_modifier_groups` / `offer_modifiers` — модификаторы позиции.

### Корзина и заказы
- `carts` (user_id **или** guest_token, merchant_id) + `cart_items`
  (unit/total_price_snapshot — цена фиксируется при добавлении).
- `orders` — центральная: merchant_id + **branch_id**, status, delivery_type,
  subtotal/delivery_fee/discount/bonus_spent/bonus_earned/**total** (копейки),
  customer_phone, снапшоты (delivery_address, merchant, pricing jsonb).
- `order_items` — снапшоты позиций; `order_status_histories` — журнал переходов
  (source: system/payment/msp_app/client_app/partner_cabinet);
  `order_submissions` / `order_external_states` — подача во внешние каналы (пока пусто).

### Деньги
- `wallets` — балловый счёт (один на user, unique), balance int (баллы).
- `wallet_transactions` — earn/spend/refund/adjustment, amount, order_id;
  unique(wallet, order, type) = идемпотентность.
- `loyalty_rules` — earn_percent, max_spend_percent, is_active.
- `accounts` — рублёвые счета, полиморф owner: `user | partner | platform |
  platform_nominal` + owner_id, balance bigint; с 18.09 флаг **payouts_blocked**
  (минус-баланс блокирует исходящие выплаты).
- `ledger_entries` — append-only журнал, amount **со знаком**; source_type/source_id,
  payment_channel, split_role (пул 40/40/20); unique(source, type, account, split_role).
  Типы: order_income, pool_share, **payout, payout_commission, subscription_payment**,
  adjustment, payment_income, acquiring_fee, chargeback_reversal, chargeback_bank_fee.
- `payments` — платежи Т-Банк: status, amount, provider_payment_id, payment_url,
  deal_id (номинальная схема), provider_payload.
- `cards` — внутренние номера-идентификаторы (пулы 9138/9142, Лун); банковской
  карты-витрины в БД нет.

### Подписка, выплаты, ПЭП (прибавилось 18–19.09)
- `subscriptions` — одна на профиль: цена-снимок (59900/19900 коп.), календарный
  период, окно grace, promo_code; `subscription_status_changes` — append-only
  история статусов; `subscription_charges` — журнал попыток списания;
  `external_payment_methods` — каркас внешних карт (не используется до банк-контура).
- `payouts` — push|pull: идемпотентность push за день unique(account, type,
  for_date); суммы amount/net/commission, bearer, статус pending→sent.
- `pep_reports` — закрывающие документы pull-выплат: payload jsonb, content_hash,
  otp_hash + expiry, статус pending|signed.
- `platform_order_settings` — строка платформенных правил минимума заказа
  (default 60000 / floor 50000 коп.).
- Колонки: `users.legal_status` (nullable — презумпция НПД),
  `users.promo_code` (с 14.09), `accounts.payouts_blocked`.
- На staging (SQL 19.09) таблицы живые, строк пока 0.

### Роли
- `partner_applications` — заявка «ЛОВИ Бизнес»: inn, статус-лестница,
  verification_suffix (VER-код), promo_code + representative_user_id (снимок),
  partner_id/merchant_id/branch_id (материализация).
- `representative_promo_codes` (prefix+suffix), `ambassadors` (prefix ветки).

### Уведомления
- `push_subscriptions` (endpoint unique, error_count); `email_notification_logs`
  (dedupe_key unique) + **дубль-таблица `email_notification_log` (пустая, зачистить)**.

### Интеграции (Kuper, выключены)
- `integrations`, `import_jobs`, `integration_entity_mappings` — **1,41 млн строк,
  924 МБ** артефакт автоимпорта; кандидат на архивацию перед продом.

### lovii_b2b
- `partners` — **юрлица**: name, slug, inn, dadata_party, **verified_at** (гейт
  витрины), representative_approved_at, owner_user_id.
- `partner_users` — пользователи кабинета, **core_user_id [U] → users.id** (мост);
- `partner_memberships` — юзер↔партнёр: role (owner/manager/operator/catalog_editor),
  **branch_ids jsonb** (сужение по точкам, null = все), status (suspended = отзыв).
- `partner_invitations`, `partner_audit_logs`, `partner_notification_channels` (secret
  AES), `partner_ui_preferences`.

### lovii_admin
- `admin_users`, spatie (`roles`/`permissions`/`model_has_*`), `activity_log`.

## Схема связей (упрощённо)

```text
users ──< carts ──< cart_items >── merchant_offers ──> merchants ──> merchant_branches
  │                                                        │              │
  │                                                        │ (partner_id, │ (partner_id,
  ├──< orders >── merchant / branch                        │  без FK)     │  без FK)
  │      ├──< order_items                                  ▼              ▼
  │      ├──< order_status_histories              lovii_b2b.partners <───────────.
  │      └─── payments (Т-Банк)                          │        │               │
  │                                              partner_users  partner_memberships
  ├──< wallets ──< wallet_transactions                   └─ core_user_id = users.id
  └── accounts (user)   accounts (partner=ИНН)   accounts (platform / platform_nominal)
          └──────────────< ledger_entries (append-only, знаковые суммы)
```

## Правила работы с БД

- Миграции — **только в lovii-core** (он владелец всех таблиц, включая чужие схемы).
- Наполнение реальных данных — через экраны b2b/app; сиды запрещены владельцем.
- Прямые UPDATE (верификация партнёров) — осознанный обход отсутствующего UI,
  каждый раз фиксировать в session-доке.
- После массовых правок позиций — не забывать Scout-реиндекс (модели, не SQL).

## Кандидаты в «не хватает» (решает владелец)

1. Зачистка: дубль `email_notification_log`, 1,4 ГБ Kuper-маппингов, черновики-
   партнёры (Grand/Статус-92 — дубль ИНН 970512345688).
2. Cross-schema FK — логические; либо оставить как есть (зафиксировать решение),
   либо триггеры/проверки.
3. Единая таймзона/тип для дат (timestamptz против ts) — при отчётности вылезет.

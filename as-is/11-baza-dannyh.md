# 11. База данных: как хранится информация — как есть

> Срез: 2026-09-17 (структура — по снимку staging 2026-09-13), **обновлено
> 2026-09-19** (волна миграций подписки/выплат/ПЭП — см. «Прибавилось 18–19.09»),
> **обновлено 2026-09-30** по свежему снимку staging (лояльность 22.09, переводы
> 24.09, ИНН-замок и провижининг МСП 28.09, чарджбэк-журнал 29.09 — см.
> «Прибавилось 22–29.09»). Полный разбор всех 107 таблиц с колонками и числами
> строк: `lovii_docs/artifacts/db-schema-analysis.md` (обновлять при волнах
> миграций). Этот док — навигационная выжимка. Формат — [README](README.md).

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
- `cards` — карты счетов (миграция 15.09, пулы 9138/9142/9000, Лун): номер
  детерминированный из счёта (SZ-081), отдаётся API (`GET /wallet`
  `card_number`); банковской карты-витрины (внешний эмитент) в БД нет.

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

### Прибавилось 22–29.09 (по снимку staging 30.09)

- **Лояльность (SZ-073, 22.09)** — отдельный домен: `promo_rules` (механики
  кэшбэк/порог/комбо/штампы/часы, бюджет с авто-стопом, скоуп
  платформа/мерчант/точка/категория/товар; на staging 11 живых правил),
  `promo_rule_customer_uses` (лимит «раз на клиента»), группы товаров —
  `loyalty_product_groups` + связи `loyalty_group_categories`/`loyalty_group_products`;
  комбо/бандлы позиций — `merchant_offer_bundle_items`.
- **Переводы 2.0 (24.09)** — `account_transfers` (P2P и PAY↔Business, адресация
  телефон/промокод/карта, карта = детерминированный номер счёта).
- **Чарджбэки (T-024, 29.09)** — `chargeback_logs` (журнал обработок), в
  `ledger_entries` идемпотентность разворота по `original_entry_id` (partial
  unique); внешняя нога дерева `external:bank` — синтетическая (таблицы нет).
- **Каналы получения точки (T-025, 27.09)** — `category_branch_hidden`
  (скрытие категорий мерчанта на точке).
- **18+ ограничения** — `product_requirements` + связи
  `merchant_offer_product_requirement` / `merchant_category_product_requirement`.
- **Заявки и оферты** — `partner_offer_acceptances` (реестр присоединений к
  офертам, роутинг заявки по промокоду профиля, 20.09).
- **Платежи** — `payment_settings` (консоль платёжных каналов, 19.09); колонка
  `payments.method` (card/tpay/sbp — канонизация с 28.09, точные комиссии пула).
- **lovii_b2b**: `partner_payout_accounts` («карточки компании», реквизиты
  верификации и выплат; адресат переводов на счёт компании),
  `partner_auth_events` (аудит входов), `partner_passkey_credentials`,
  `partner_sessions`, `partner_user_devices`; замок дублей ИНН —
  `partners_inn_digits_unique` (выражение-индекс, 28.09); снимок отката T-027 —
  таблица-артефакт `partners_inn_fix_20260928` (можно удалить после релиза).
- Служебные (Laravel 11/12 стандарт, не домен): `cache_locks`, `failed_jobs`,
  `job_batches`, `password_reset_tokens` — во всех трёх схемах.

### Роли
- `partner_applications` — заявка «ЛОВИ Бизнес»: inn, статус-лестница,
  verification_suffix (VER-код), promo_code + representative_user_id (снимок),
  partner_id/merchant_id/branch_id (материализация).
- `representative_promo_codes` (prefix+suffix); `ambassadors` — **самостоятельная
  сущность с 6-символьным кодом** (с 19.09: амб-код ≠ реп-код, у Основателя
  AA2222 + личный AA-XXXX).

### Уведомления
- `push_subscriptions` (endpoint unique, error_count); `email_notification_logs`
  (dedupe_key unique). Дубль-таблица `email_notification_log` **удалена 28.09**.

### Интеграции (Kuper, выключены)
- `integrations`, `import_jobs` (+`import_job_errors`), `integration_entity_mappings`
  — 1,41 млн строк / 881 МБ. **Решение F-074 (29.09): НЕ удалять** — маппинги
  третья ветка MerchantVisibility (витрина ритейлеров), чистка обрушила витрину
  staging 29.09; таблица в НЕудаляемом списке.
- `max_support_messages` — журнал поддержки через бота MAX.

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
- ~~Прямые UPDATE (верификация партнёров) — осознанный обход отсутствующего UI~~ —
  **уточнено 04.10**: с 20.09 верификация автоматизирована (три пути) + кнопка
  в lovii-admin (ресурс `Partners`, см. [09](09-kabinet-b2b.md)/[10](10-admin.md));
  если прямой UPDATE всё же применяется — каждый раз фиксировать в session-доке.
- После массовых правок позиций — не забывать Scout-реиндекс (модели, не SQL).

## Числа staging на 30.09 (снимок zcode)

users 334 · orders 420 · payments 333 · accounts 284 · ledger_entries 3 464 ·
account_transfers 9 · promo_rules 11 (живой домен лояльности) ·
partner_payout_accounts 2 · payouts 0 (исполнение ждёт банк-контур, Б-5).

## Кандидаты в «не хватает» (решает владелец)

1. ~~Зачистка дубля `email_notification_log`~~ — удалён 28.09; ~~дубли ИНН~~ —
   сведены T-027 (273→267) + включён замок `partners_inn_digits_unique`;
   ~~Kuper-маппинги~~ — снято с повестки решением F-074 (НЕ удалять, витринный гейт).
2. Cross-schema FK — логические; либо оставить как есть (зафиксировать решение),
   либо триггеры/проверки.
3. Единая таймзона/тип для дат (timestamptz против ts) — при отчётности вылезет.

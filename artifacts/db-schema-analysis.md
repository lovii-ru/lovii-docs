# LOVII — Структура базы данных (полный разбор всех таблиц)

| Параметр | Значение |
|:---|:---|
| **Источник** | Staging, PostgreSQL 17.7, БД `lovii-core` (контейнер `lovii-core-staging-pgsql-1`), чтение через MCP `lovii-pg-staging` (роль read-only) |
| **Снимок** | 2026-09-13 |
| **Охват** | Все пользовательские таблицы схем `public`, `lovii_b2b`, `lovii_admin`. Служебные схемы PostGIS (`tiger`, `topology`, `spatial_ref_sys`) перечислены, но не разбираются — это поставка PostGIS, не наш код |
| **Числа строк** | Точные `count(*)` на дату снимка |
| **Миграции** | Применено миграций: public — 92, lovii_b2b — 13, lovii_admin — 29 |

**Легенда:** `NN` — NOT NULL; `DEF[...]` — значение по умолчанию; `autoinc` — из последовательности; `[PK]`/`[U]`/`[FK→табл]` — первичный/уникальный/внешний ключ; `ts` — `timestamp(0) without time zone` (без часового пояса, если не сказано иное). **Деньги везде в копейках (integer), баланс счетов — bigint.**

---

## 1. Сводка по схемам

| Схема | Таблиц | Что это |
|:---|:---|:---|
| `public` | 55 + `spatial_ref_sys` | Ядро платформы: витрина, каталог, корзина, заказы, платежи, баллы, рублёвый ledger, роли, OTP, интеграции |
| `lovii_b2b` | 14 | Кабинет партнёров/точек (Filament): партнёры, пользователи кабинета, доступы, аудит |
| `lovii_admin` | 15 | Супер-админка (Filament + Shield RBAC): админы, роли/права, activity log |

Крупнейшие таблицы: `integration_entity_mappings` — 1 411 202 строк (924 МБ, Kuper-импорт), `merchant_offers` — 1 206 083 (465 МБ), `catalog_products` — 202 182 (159 МБ).

---

## 2. Служебные таблицы Laravel (повторяются во всех трёх схемах)

Структура одинакова (строк на снимке: public / b2b / admin):

- **`jobs`** (0/0/0) — очередь: `id autoinc [PK]`, `queue varchar(255) NN`, `payload text NN`, `attempts smallint NN`, `reserved_at int`, `available_at int NN`, `created_at int NN`.
- **`job_batches`** (0/0/0) — батчи очереди: `id varchar(255) [PK]`, `name`, `total_jobs`, `pending_jobs`, `failed_jobs`, `failed_job_ids text`, `options text`, `cancelled_at/created_at/finished_at int`.
- **`failed_jobs`** (0/0/0) — упавшие задачи: `uuid varchar(255) NN [U]`, `connection/queue/payload/exception text NN`, `failed_at ts NN DEF[now()]`.
- **`cache`** (0/0/0) — кэш в БД: `key varchar(255) [PK]`, `value text NN`, `expiration int` (⚠️ в public — `integer`, в b2b/admin — `bigint`).
- **`cache_locks`** (0/0/0) — блокировки кэша: `key varchar(255) [PK]`, `owner varchar(255) NN`, `expiration`.
- **`sessions`** (0/0/0) — сессии: `id varchar(255) [PK]`, `user_id bigint`, `ip_address varchar(45)`, `user_agent text`, `payload text NN`, `last_activity int NN`.
- **`migrations`** (92/13/29) — журнал миграций: `migration varchar(255) NN`, `batch int NN`.

Наличие таблиц ≠ использование: в стеке стоит Redis; строки в очереди — 0 (Horizon).

---

## 3. Схема `public` — ядро платформы

### 3.1. Пользователи и устройства

#### `users` — покупатели core (307)
```
id                bigint NN autoinc [PK]
phone             varchar(20) NN [U]      ← вход по телефону + OTP
phone_verified_at ts
first_name / last_name / patronymic  varchar(255)
email             varchar(255)
status            varchar(20) NN DEF['active']
last_login_at     ts
gender            varchar(10)          date_of_birth date
avatar_path       varchar(255)
deactivated_at    ts
email_verified_at ts
created_at / updated_at ts
```
Ключи: PK(id), U(phone). **deleted_at нет** — деактивация через `status` + `deactivated_at`. Это и есть «UID» из канона FINANCIAL_CONTOUR §5.1 (колонки `uid` в БД нет).

#### `personal_access_tokens` — API-токены Sanctum (264)
```
id bigint NN autoinc [PK]; tokenable_type varchar(255) NN; tokenable_id bigint NN;
name text NN; token varchar(64) NN [U]; abilities text; last_used_at ts; expires_at ts; created_at/updated_at ts
```

#### `guest_sessions` — гостевые сессии витрины (40)
```
id bigint NN autoinc [PK]; token varchar(64) NN [U]; ip_address varchar(45); user_agent text;
expires_at ts NN; created_at ts NN DEF[now()]
```

#### `user_devices` — устройства (13)
```
id bigint NN autoinc [PK]; user_id bigint [FK→users]; guest_token varchar(255);
device_fingerprint varchar(255); platform varchar(20) NN; app_version varchar(20);
push_token varchar(255); last_seen_at ts; created_at/updated_at ts
```

#### `user_addresses` — адреса доставки (36)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users]; city_id bigint NN [FK→cities];
label varchar(255); address_line varchar(255) NN; entrance/floor/apartment/intercom varchar; comment text;
is_default bool NN DEF[false]; location geography(Point,4326) NN; street varchar(255); house varchar(255);
created_at/updated_at ts
```

#### `user_email_verifications` — подтверждение e-mail кодом (4)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users CASCADE]; email varchar(255) NN;
code_hash varchar(255) NN; attempts smallint NN DEF[0]; expires_at ts NN; confirmed_at ts;
last_sent_at ts; created_at ts NN DEF[now()]
```

#### `communication_consents` — согласия на коммуникации (6)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users CASCADE]; channel varchar(32) NN;
type varchar(32) NN; status varchar(16) NN; source varchar(32) NN; created_at/updated_at ts
```

### 3.2. Вход: OTP и боты MAX

#### `auth_otp_sessions` — OTP-сессии входа (602)
```
id bigint NN autoinc [PK]; phone varchar(20) NN; code_hash varchar(255) NN;
attempts smallint NN DEF[0]; expires_at ts NN; confirmed_at ts; guest_token varchar(255);
channel varchar(32) NN DEF['sms']; binding_token varchar(64); last_sent_at ts;
created_at ts NN DEF[now()]
```
FK нет — связка по телефону. Каналы: sms/max/telegram/vk (лог-транспорт на dev/staging).

#### `max_bot_links` — привязка телефон ↔ чат бота MAX (8)
```
id bigint NN autoinc [PK]; phone varchar(20) NN; chat_id bigint NN; user_id bigint;
verified_at ts; created_at ts NN DEF[now()]; bot varchar(20) NN DEF['otp'] [U(bot,phone)]
```

#### `max_support_messages` — журнал переписки с саппорт-ботом MAX (2)
```
id bigint NN autoinc [PK]; bot varchar(20) NN DEF['support']; chat_id bigint NN; user_id bigint;
phone varchar(20); direction varchar(4) NN; text text NN; mid varchar(128); created_at ts NN DEF[now()]
```

### 3.3. Мерчанты, точки, каталог

#### `merchants` — мерчанты (витрина) (279)
```
id bigint NN autoinc [PK]; name varchar(255) NN; slug varchar(255) NN;
merchant_type varchar(20) NN; status varchar(30) NN DEF['pending_moderation'];
description text; logo_url/mini_logo_url/cover_url text; logo_background_color varchar(10);
phone/support_phone varchar(20); is_featured bool NN DEF[false];
rating_avg numeric(3,2); rating_count int NN DEF[0];
partner_id bigint            ← логическая связь → lovii_b2b.partners(id), FK НЕТ
inn varchar(12); ogrn varchar(15); legal_name varchar(255); legal_address text;
legal_form varchar(64); kpp varchar(9); dadata_raw jsonb;
tariff varchar(16) NN DEF['start'];    ← тариф Лови Старт/Базовый/Про (SZ-038)
deleted_at ts; created_at/updated_at ts
```

#### `merchant_branches` — точки/филиалы (1018)
```
id bigint NN autoinc [PK]; merchant_id bigint NN [FK→merchants]; city_id bigint NN [FK→cities];
name varchar(255); status varchar(20) NN DEF['active']; address_line varchar(255) NN;
pickup_available bool NN DEF[false]; delivery_available bool NN DEF[false];
min/max_delivery_minutes smallint; min_order_amount int; working_hours jsonb NN DEF['{}'];
timezone varchar(50); location geography(Point,4326) NN;
partner_id bigint            ← логическая связь → lovii_b2b.partners(id), FK НЕТ
deleted_at ts; created_at/updated_at ts
```
`id` филиала = то, что витрина показывает в `/stores/{id}` (коллизия с merchant_id решена в SZ-005).

#### `merchant_categories` — категории точек (16)
```
id bigint NN autoinc [PK]; name/slug varchar(255) NN; code varchar(100) NN [U];
image_url text; is_adult_only bool NN DEF[false]; is_active bool NN DEF[true]; created_at/updated_at ts
```
`is_adult_only` — фильтр энергетиков/18+ (SZ-016).

#### `merchant_merchant_category` — связь мерчант ↔ категория (297)
```
[PK(merchant_id, merchant_category_id)]; оба FK: merchants / merchant_categories
```

#### `merchant_delivery_zones` — зоны доставки (4)
```
id bigint NN autoinc [PK]; branch_id bigint NN [FK→merchant_branches]; name varchar(255) NN;
zone_type varchar(20) NN; radius_meters int; delivery_fee int; free_from_amount int;
min/max_eta_minutes smallint; is_active bool NN DEF[true];
polygon geography(Polygon,4326); created_at/updated_at ts
```

#### `merchant_integration_profiles` — профиль интеграции точки (0)
```
id bigint NN autoinc [PK]; merchant_id bigint NN [FK→merchants]; branch_id bigint [FK→merchant_branches];
catalog_source varchar(30) NN; order_channel varchar(30) NN; fulfillment_mode varchar(30) NN;
billing_model varchar(30) NN; provider varchar(50); status_sync_enabled bool NN DEF[false];
catalog_sync_enabled bool NN DEF[false]; config jsonb NN DEF['{}']; is_active bool NN DEF[true];
created_at/updated_at ts
```
На staging пустая: заказы идут напрямую (orders.integration_profile_id NULL).

#### `catalog_categories` — категории общего каталога (Kuper-импорт) (1819)
```
id bigint NN autoinc [PK]; merchant_id bigint [FK→merchants]; parent_id bigint [FK→catalog_categories];
name/slug varchar(255) NN; sort_order smallint NN DEF[0]; is_active bool NN DEF[true];
image_url text; deleted_at ts; created_at/updated_at ts
```

#### `catalog_products` — товары общего каталога (Kuper-импорт) (202 182)
```
id bigint NN autoinc [PK]; offer_type varchar(20) NN; title varchar(255) NN; description text;
brand varchar(255); attributes jsonb; media jsonb; is_active bool NN DEF[true];
merchant_id bigint NN [FK→merchants]; deleted_at ts; created_at/updated_at ts
```
Два каталога в системе: `catalog_products` (импорт Kuper) и `merchant_offers` (позиции МСП) — см. SZ-005.

#### `merchant_offers` — позиции/товары точек (1 206 083)
```
id bigint NN autoinc [PK]; merchant_id bigint NN [FK→merchants]; branch_id bigint [FK→merchant_branches];
category_id bigint [FK→catalog_categories]; catalog_product_id bigint NN [FK→catalog_products];
offer_type varchar(20) NN; title varchar(255) NN; description text;
sku varchar(100); external_id varchar(255); barcode varchar(100);
price int NN; old_price int; currency varchar(3) NN DEF['RUB'];      ← копейки
is_available bool NN DEF[true]; stock_qty int; unit_type varchar(20); unit_value numeric(8,3);
sort_order smallint NN DEF[0]; source_type varchar(30) NN; last_synced_at ts;
raw_payload_hash varchar(64); is_active bool NN DEF[true]; is_restricted bool NN DEF[false];
deleted_at ts; created_at/updated_at ts
```
`is_restricted` — 18+ (энергетики, C-4/SZ-016). `branch_id` = привязка позиции к филиалу (SZ-013).

#### Модификаторы и требования
- **`offer_modifier_groups`** (1) — группы модификаторов позиции: `merchant_offer_id NN [FK→merchant_offers]`, `name NN`, `selection_type varchar(20) NN`, `min/max_select smallint DEF[0/1]`, `sort_order`, `is_required/is_active bool`, `deleted_at ts`.
- **`offer_modifiers`** (2) — модификаторы: `modifier_group_id NN [FK→offer_modifier_groups]`, `name NN`, `price_delta int DEF[0]` (копейки), `external_id`, `sort_order`, `is_active`, `deleted_at`.
- **`product_requirements`** (11) — требования к товарам: `code varchar(100) NN [U]`, `title NN`, `min_age smallint`, `is_restricted bool NN DEF[false]`, `is_active`.
- **`merchant_category_product_requirement`** (0) — связка категория↔требование, PK составной, оба FK.
- **`merchant_offer_product_requirement`** (0) — связка позиция↔требование, PK составной, оба FK.

### 3.4. Интеграции и импорт (Kuper)

#### `integrations` (3)
```
id bigint NN autoinc [PK]; merchant_id bigint [FK→merchants]; branch_id bigint [FK→merchant_branches];
provider varchar(50) NN; integration_kind varchar(30) NN; status varchar(20) NN DEF['active'];
config jsonb NN; last_sync_at ts; last_success_at ts;
resync_requested_at ts; resync_requested_by_partner_user_id bigint   ← логически → lovii_b2b.partner_users, FK НЕТ
created_at/updated_at ts
```

#### `import_jobs` (0) / `import_job_errors` (0)
- `import_jobs`: `integration_id NN [FK→integrations]`, `job_type varchar(50) NN`, `status varchar(20) NN DEF['pending']`, `stats jsonb`, `error_message text`, `started_at/finished_at ts`.
- `import_job_errors`: `import_job_id NN [FK→import_jobs]`, `entity_type varchar(50) NN`, `external_id varchar(255)`, `message text NN`, `payload jsonb`.

#### `integration_entity_mappings` — карта «внешний ID ↔ внутренний объект» (1 411 202)
```
id bigint NN autoinc [PK]; integration_id bigint NN [FK→integrations];
entity_type varchar(50) NN; external_id varchar(255) NN; internal_id bigint;
last_seen_at ts NN; payload_hash varchar(64); payload jsonb; created_at/updated_at ts
[U(integration_id, entity_type, external_id)]
```
Самая тяжёлая таблица (924 МБ) — артефакт автоимпорта; `INTEGRATIONS_ENABLED=false` импорт остановлен, данные остались.

### 3.5. Корзина и заказы

#### `carts` (58) и `cart_items` (43)
- `carts`: `user_id [FK→users] | guest_token varchar(255)` (либо гость), `city_id [FK→cities]`, `merchant_id [FK→merchants]`, `currency NN DEF['RUB']`, `expires_at ts`.
- `cart_items`: `cart_id NN [FK→carts]`, `merchant_id NN [FK→merchants]`, `branch_id [FK→merchant_branches]`, `merchant_offer_id NN [FK→merchant_offers]`, `quantity smallint NN`, `selected_options jsonb`, `unit_price_snapshot int NN`, `total_price_snapshot int NN` (копейки, снапшот цены на момент добавления).

#### `orders` — заказы (137)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users]; merchant_id bigint NN [FK→merchants];
branch_id bigint NN [FK→merchant_branches]; integration_profile_id bigint [FK→merchant_integration_profiles];
order_channel varchar(30) NN; fulfillment_mode varchar(30) NN;
source_type varchar(30) NN DEF['customer_app']; status varchar(30) NN DEF['created'];
submission_status varchar(30) NN DEF['pending']; currency varchar(3) NN DEF['RUB'];
subtotal int NN; delivery_fee int NN DEF[0]; discount_amount int NN DEF[0];
bonus_spent int NN DEF[0]; bonus_earned int NN DEF[0];      ← баллы,spent/earned по заказу
total int NN;                                                ← копейки
delivery_type varchar(20) NN; customer_phone varchar(20) NN; customer_name varchar(255);
comment text; delivery_address_snapshot jsonb; merchant_snapshot jsonb NN; pricing_snapshot jsonb NN;
external_reference varchar(255); submitted_at/completed_at/cancelled_at ts; created_at/updated_at ts
```

#### `order_items` — позиции заказа (276)
```
id bigint NN autoinc [PK]; order_id bigint NN [FK→orders]; merchant_offer_id bigint [FK→merchant_offers];
external_offer_id varchar(255); title_snapshot varchar(255) NN; sku_snapshot varchar(100);
qty smallint NN; unit_price int NN; total_price int NN; options_snapshot jsonb; image_snapshot text;
created_at ts NN DEF[now()]
```

#### `order_submissions` — подачи заказа в канал/провайдер (90)
```
id bigint NN autoinc [PK]; order_id bigint NN [FK→orders]; channel varchar(30) NN;
provider varchar(50); status varchar(20) NN DEF['pending']; attempt_no smallint NN DEF[1];
request_payload jsonb; response_payload jsonb; external_order_id varchar(255);
error_message text; submitted_at ts; created_at/updated_at ts
```

#### `order_status_histories` — история статусов (294)
```
id bigint NN autoinc [PK]; order_id bigint NN [FK→orders]; internal_status varchar(30) NN;
external_status varchar(100); source varchar(30) NN; payload jsonb; created_at ts NN DEF[now()]
```

#### `order_external_states` — внешние статусы (0)
```
id bigint NN autoinc [PK]; order_id bigint NN [FK→orders]; provider varchar(50) NN;
external_order_id varchar(255) NN; external_status varchar(100) NN; payload jsonb;
recorded_at ts NN; created_at ts NN DEF[now()]
```

#### `payments` — платежи Т-Банк (39)
```
id bigint NN autoinc [PK]; order_id bigint NN [FK→orders]; user_id bigint NN [FK→users];
provider varchar(32) NN DEF['tbank']; status varchar(32) NN DEF['new']; amount int NN;   ← копейки
currency char(3) NN DEF['RUB']; terminal_key varchar(64); provider_payment_id varchar(32);
payment_url text; deal_id bigint; recipient_id varchar(16); provider_payload json;
authorized_at/confirmed_at/canceled_at ts; created_at/updated_at ts [U(provider, provider_payment_id)]
```

### 3.6. Лояльность: баллы, рублёвый ledger, правила

#### `wallets` — балансовые счёта баллов (5)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users] [U]; balance int NN DEF[0];   ← баллы
currency varchar(3) DEF['RUB']; created_at/updated_at ts
```
Канон FINANCIAL_CONTOUR §5.1: то, что видит карта LOVII PAY.

#### `wallet_transactions` — проводки по баллам (10)
```
id bigint NN autoinc [PK]; wallet_id bigint NN [FK→wallets]; type varchar(20) NN (earn/spend/refund...);
amount int NN (копейки баллов); order_id bigint [FK→orders]; comment text; expires_at ts; meta jsonb;
created_at ts NN DEF[now()]
```
Инвариант §5.2 канона: wallets.balance = Σ earn − Σ spend + Σ adjustment/refund.

#### `loyalty_rules` — правила начисления (1: «Кэшбэк 5%»)
```
id bigint NN autoinc [PK]; name varchar(255) NN; earn_percent smallint NN; max_spend_percent smallint NN;
is_active bool NN DEF[true]; starts_at/ends_at ts; created_at/updated_at ts
```

#### `accounts` — рублёвые счета (user/partner/platform) (11)
```
id bigint NN autoinc [PK]; owner_type varchar(20) NN; owner_id bigint NN;   ← полиморф, U(owner_type,owner_id)
balance bigint NN DEF[0]; currency varchar(3) NN DEF['RUB']; created_at/updated_at ts
```
FK на users/partners нет — связь через owner_type+owner_id (доля точки = счёт ИНН компании и т.п., SZ-040).

#### `ledger_entries` — append-only журнал проводок (76)
```
id bigint NN autoinc [PK]; account_id bigint NN [FK→accounts CASCADE]; type varchar(40) NN;
amount bigint NN (знаковая, копейки); currency varchar(3) NN DEF['RUB'];
source_type varchar(40); source_id bigint; merchant_id bigint; branch_id bigint;
payment_channel varchar(20) (карта/СБП/баллы); split_role varchar(20) (пул 40/40/20);
comment varchar(255); meta jsonb; order_id bigint (логически → orders.id, FK НЕТ, добавлен бэкфиллом);
created_at ts NN DEF[now()]   [U(source_type, source_id, type, account_id, split_role)]
```
Unique-ключ = идемпотентность проводок.

### 3.7. Роли: представители, амбассадоры, заявки

#### `partner_applications` — заявка «ЛОВИ Бизнес» (5)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users]; name varchar(255) NN; inn varchar(12) NN;
activity_type varchar(20) NN; address_line varchar(500) NN; city_name varchar(255);
lat numeric(10,7); lon numeric(10,7); phone varchar(20) NN; email varchar(255);
status varchar(32) NN DEF['submitted']; dadata_party jsonb; verification_suffix varchar(16) NN;
partner_id bigint [FK→lovii_b2b.partners SET NULL]; merchant_id bigint [FK→merchants SET NULL];
branch_id bigint [FK→merchant_branches SET NULL]; city_id bigint [FK→cities SET NULL];
promo_code varchar(6); representative_user_id bigint [FK→users SET NULL];
rep_approved_at ts; rep_rejected_at ts; rep_reject_reason varchar(255); created_at/updated_at ts
```
SZ-007: промокод PPXXXX → снимок в promo_code + representative_user_id; апрув репа → teaser-витрина.

#### `representative_promo_codes` — промокоды представителей (1)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users CASCADE]; code varchar(6) NN [U];
prefix varchar(2) NN (ветка амбассадора); suffix varchar(4) NN; is_active bool NN DEF[true];
created_at/updated_at ts
```

#### `ambassadors` — амбассадорские ветки (1)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users CASCADE] [U];
prefix varchar(2) NN [U] (иерархия rep→amb по префиксу, дерева нет); is_active bool NN DEF[true];
created_at/updated_at ts
```

### 3.8. Уведомления

#### `push_subscriptions` — WebPush-подписки (1)
```
id bigint NN autoinc [PK]; user_id bigint NN [FK→users CASCADE]; endpoint text NN [U];
p256dh varchar(255) NN; auth varchar(255) NN; user_agent varchar(255);
last_error_at ts; last_error varchar(255); error_count int NN DEF[0]; expires_at ts; created_at/updated_at ts
```

#### `email_notification_logs` — журнал писем, рабочая (19)
```
id bigint NN autoinc [PK]; dedupe_key varchar(255) NN [U]; mailable varchar(255) NN;
to_email varchar(255) NN; subject varchar(255) NN; message_id varchar(255); sent_at ts; created_at/updated_at ts
```

#### `email_notification_log` — дубль, старая таблица (0) ⚠️
Аналогична (mailable varchar(100), sent_at NN DEF[now()]). Обе с U(dedupe_key). Кандидат на зачистку — это написание появилось раньше (по истории работ SZ-009 миграция email_notification_logs добавлялась отдельно).

---

## 4. Схема `lovii_b2b` — кабинет партнёров

#### `partners` — компании-партнёры (269)
```
id bigint NN autoinc [PK]; name varchar(255) NN; slug varchar(255) NN [U]; status varchar(255) NN DEF['active'];
owner_user_id bigint [FK→partner_users SET NULL]; contact_email/contact_phone varchar(255);
inn varchar(12); dadata_party jsonb;
verified_at timestamptz;            ← ⚠️ единственные с TZ; гейт витрины
representative_approved_at timestamptz;   ← апрув представителя (SZ-038)
created_at/updated_at ts
```
Апрув партнёра = `verified_at IS NOT NULL`; UI в админке не построен (правка только SQL).

#### `partner_users` — пользователи кабинета (261)
```
id bigint NN autoinc [PK]; core_user_id bigint NN [U]   ← логическая связь → public.users.id, FK НЕТ
name varchar(255) NN; email varchar(255); phone varchar(255);
status varchar(255) NN DEF['active']; last_login_at ts; locale varchar(5) NN DEF['ru'];
created_at/updated_at ts
```

#### `partner_memberships` — участник ↔ партнёр (272)
```
id autoinc [PK]; partner_user_id NN [FK→partner_users CASCADE]; partner_id NN [FK→partners CASCADE];
role varchar(255) NN (owner/manager/...); branch_ids jsonb (доступ к точкам);
status varchar(255) NN DEF['active']  [U(partner_user_id, partner_id)]
```

#### `partner_invitations` — приглашения в кабинет (0)
```
id autoinc [PK]; partner_id NN [FK→partners CASCADE]; email/phone varchar; role varchar(255) NN;
token varchar(255) NN [U]; invited_by_id bigint [FK→partner_users SET NULL]; name varchar(255);
branch_ids jsonb; locale varchar(5) NN DEF['ru']; expires_at/accepted_at ts
```

#### `partner_audit_logs` — аудит действий кабинета (226)
```
id autoinc [PK]; partner_user_id [FK→partner_users SET NULL]; partner_id [FK→partners SET NULL];
event varchar(255) NN; subject_type varchar(255); subject_id bigint; before jsonb; after jsonb;
ip varchar(45); user_agent text; created_at ts NN DEF[now()]
```

#### `partner_notification_channels` — каналы уведомлений партнёра (0)
```
id autoinc [PK]; partner_user_id NN [FK→partner_users CASCADE]; partner_id NN [FK→partners CASCADE];
channel varchar(255) NN; target varchar(255) NN; events jsonb; is_active bool NN DEF[true]; secret text
```

#### `partner_ui_preferences` — настройки UI кабинета (0)
```
id autoinc [PK]; partner_user_id NN [FK→partner_users CASCADE]; partner_id [FK→partners SET NULL];
key varchar(255) NN; value jsonb; updated_at ts NN  [U(partner_user_id, partner_id, key)]
```

#### `partner_sessions` — сессии кабинета (0) — структура как sessions.

---

## 5. Схема `lovii_admin` — супер-админка

#### `admin_users` (3)
```
id autoinc [PK]; name/email varchar(255) NN [U(email)]; email_verified_at ts; password varchar(255) NN;
remember_token varchar(100); locale varchar(5); created_at/updated_at ts
```

#### Shield RBAC (spatie/laravel-permission)
- **`roles`** (1: super_admin): `name varchar(255) NN`, `guard_name NN` [U(name,guard_name)].
- **`permissions`** (229): та же структура.
- **`model_has_roles`** (3): `role_id NN [FK→roles CASCADE]`, `model_type varchar(255) NN`, `model_id bigint NN` [PK(role_id,model_id,model_type)].
- **`model_has_permissions`** (0): симметрично на permissions.
- **`role_has_permissions`** (217): связка роль↔право, PK составной, оба FK CASCADE.

#### `activity_log` — журнал действий админки (93)
```
id autoinc [PK]; log_name varchar(255); description text NN; subject_type/subject_id; causer_type/causer_id;
properties json; event varchar(255); batch_uuid uuid; created_at/updated_at ts
```

#### `password_reset_tokens` (0): `email varchar(255) [PK]`, `token varchar(255) NN`, `created_at ts`.

---

## 6. Связи между схемами (для анализа — где FK нет)

| Откуда | Куда | Как |
|:---|:---|:---|
| `lovii_b2b.partner_users.core_user_id` | `public.users.id` | логическая, **FK нет** (U-ключ) |
| `public.merchants.partner_id` | `lovii_b2b.partners.id` | логическая, **FK нет** |
| `public.merchant_branches.partner_id` | `lovii_b2b.partners.id` | логическая, **FK нет** |
| `public.integrations.resync_requested_by_partner_user_id` | `lovii_b2b.partner_users.id` | логическая, **FK нет** |
| `public.partner_applications.partner_id` | `lovii_b2b.partners.id` | **FK есть** (SET NULL) |
| `public.ledger_entries.order_id` | `public.orders.id` | логическая, **FK нет** |
| `public.accounts.owner_type+owner_id` | users / lovii_b2b.partners / platform | полиморф, FK нет по определению |

Остальные FK — внутри public и внутри b2b/admin, все перечислены у таблиц выше. ON DELETE почти везде RESTRICT (по умолчанию); CASCADE — только user-owned (ambassadors, communication_consents, push_subscriptions, representative_promo_codes, user_email_verifications) и b2b-составы; SET NULL — partner_applications и b2b-аудиты/приглашения.

---

## 7. Наблюдения для анализа (снимок 2026-09-13)

1. **Дубль журнала писем**: `email_notification_log` (0 строк) и `email_notification_logs` (19, рабочая) — старая таблица-предшественник осталась в БД, кандидаты на зачистку миграцией.
2. **Деньги в копейках**: orders.total, payments.amount, merchant_offers.price, cart_items/offer_modifiers — `integer`; accounts.balance, ledger_entries.amount — `bigint`; wallets.balance — `integer` (баллы, не рубли). При расчётах за пределами int (~2,1 млрд копеек) — осторожно с переполнением в агрегатах.
3. **Таймзоны**: все `timestamp` без TZ, кроме `lovii_b2b.partners.verified_at` и `representative_approved_at` (timestamptz). Неоднородность — учитывать в выборках.
4. **Soft-delete** есть у merchants, merchant_branches, catalog_categories, catalog_products, merchant_offers, offer_modifier_groups, offer_modifiers; у users, orders, partners — нет (у users статусная деактивация).
5. **Enum-типов нет** — все статусы varchar с default; допустимые значения живут в коде (Laravel), не в БД.
6. **Полиморф и «логические» FK** (раздел 6): целостность cross-schema держится кодом, не БД — при массовых SQL-правках мимо моделей можно порвать связки (прецедент: SZ-013, реиндекс мимо Scout).
7. **Тяжёлые таблицы**: integration_entity_mappings (1,41 млн) и merchant_offers (1,21 млн) — 1,4 ГБ суммарно; каталог Kuper остался от автоимпорта при выключенных интеграциях.
8. **Баллы и рубли разделены по канону**: wallets (баллы, «карта LOVII PAY») ↔ accounts+ledger_entries (рубли, внутренний учёт) — два независимых инварианта (FINANCIAL_CONTOUR §5.1–5.2). Сущности «карта LOVII PAY» в БД пока нет.
9. **auth_otp_sessions без FK** — вся связка по телефону; телефоны в users уникальны, в OTP-таблице — нет (сессии могут висеть на номер до создания юзера).
10. **migrations**: public 92 — этап сверки с репо lovii-core перед прод-деплоем.

---
*Сформировано агентом zcode 2026-09-13 по живой БД staging (read-only). Обновлять при каждой волне миграций; числа строк — на дату снимка.*

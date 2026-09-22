-- =====================================================================
--  LOVII · Конструктор лояльности · Схема БД (PostgreSQL 15+)
--  Схема: loyalty. Деньги — BIGINT в копейках (*_minor), баллы — BIGINT.
--  Все таблицы содержат location_id для гео-изоляции (RLS / партиционирование).
--  См. docs/lovii-loyalty-constructor/04-data-model.md
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS loyalty;
SET search_path TO loyalty, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 0. Перечисления
-- ---------------------------------------------------------------------
CREATE TYPE campaign_status AS ENUM ('draft','scheduled','active','paused','paused_budget','finished','archived');
CREATE TYPE funding_source  AS ENUM ('merchant','platform','partner');
CREATE TYPE ledger_kind     AS ENUM ('accrual','redemption','reversal_accrual','reversal_redemption','expiry','adjustment','debt_settle');
CREATE TYPE account_type    AS ENUM ('customer_points','merchant_funding','platform_funding','points_liability');
CREATE TYPE coupon_status   AS ENUM ('issued','redeemed','expired','revoked');
CREATE TYPE order_status    AS ENUM ('quoted','committed','reversed','partially_reversed');
CREATE TYPE subscription_status AS ENUM ('active','exhausted','expired','cancelled');
CREATE TYPE gift_card_status AS ENUM ('active','used','expired','blocked');

-- ---------------------------------------------------------------------
-- 1. Настройки лояльности точки
-- ---------------------------------------------------------------------
CREATE TABLE loyalty_settings (
  merchant_id                 UUID PRIMARY KEY,                    -- FK → core.merchants
  location_id                 UUID NOT NULL,
  timezone                    TEXT NOT NULL DEFAULT 'Europe/Moscow',
  business_category           TEXT NOT NULL,                       -- coffee | bakery | grocery | beauty | fitness | food | pharmacy | flowers | other
  margin_pct                  NUMERIC(5,2) NOT NULL DEFAULT 50,    -- для подсказок безопасных ставок
  accrue_on                   TEXT NOT NULL DEFAULT 'paid_money' CHECK (accrue_on IN ('paid_money','total')),
  max_points_share_pct        SMALLINT NOT NULL DEFAULT 50 CHECK (max_points_share_pct BETWEEN 0 AND 100),
  max_total_discount_pct      SMALLINT NOT NULL DEFAULT 30 CHECK (max_total_discount_pct BETWEEN 0 AND 100),
  max_merchant_cashback_pct   SMALLINT NOT NULL DEFAULT 20,
  max_coupons_per_order       SMALLINT NOT NULL DEFAULT 1,
  default_promo_ttl_days      SMALLINT NOT NULL DEFAULT 30,
  staff_customer_ids          UUID[] NOT NULL DEFAULT '{}',        -- исключаются из наград
  pro_plan                    BOOLEAN NOT NULL DEFAULT FALSE,      -- SaaS PRO
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. Кампании и версии
-- ---------------------------------------------------------------------
CREATE TABLE campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID NOT NULL,
  location_id       UUID NOT NULL,
  mechanic          TEXT NOT NULL,                                 -- spec.mechanic
  name              TEXT NOT NULL,
  status            campaign_status NOT NULL DEFAULT 'draft',
  current_version   INTEGER NOT NULL DEFAULT 0,                    -- 0 = не опубликована
  priority          INTEGER NOT NULL DEFAULT 100,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  budget_total_minor BIGINT,
  budget_used_minor  BIGINT NOT NULL DEFAULT 0,
  budget_reserved_minor BIGINT NOT NULL DEFAULT 0,                 -- резерв живых quote
  total_uses        INTEGER,
  uses_count        INTEGER NOT NULL DEFAULT 0,
  holdout_pct       SMALLINT NOT NULL DEFAULT 0,
  is_system         BOOLEAN NOT NULL DEFAULT FALSE,                -- платформенные (базовый кэшбэк)
  partner_merchant_id UUID,                                        -- для cross_promo: вторая сторона
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  CONSTRAINT budget_nonneg CHECK (budget_used_minor >= 0 AND budget_reserved_minor >= 0)
);
CREATE INDEX campaigns_active_idx ON campaigns (merchant_id, status) WHERE status IN ('active','scheduled');
CREATE INDEX campaigns_location_idx ON campaigns (location_id, status);
CREATE INDEX campaigns_partner_idx ON campaigns (partner_merchant_id) WHERE partner_merchant_id IS NOT NULL;

CREATE TABLE campaign_versions (
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  spec          JSONB NOT NULL,                                    -- валиден по campaign.schema.json
  spec_hash     TEXT NOT NULL,                                     -- sha256(canonical json)
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by  UUID NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_note   TEXT,
  PRIMARY KEY (campaign_id, version)
);
-- Неизменяемость версий
CREATE OR REPLACE FUNCTION forbid_update() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'campaign_versions is immutable'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER campaign_versions_immutable BEFORE UPDATE OR DELETE ON campaign_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_update();

-- Пользовательские сегменты (V2)
CREATE TABLE segments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID,                                              -- NULL = системный
  location_id   UUID NOT NULL,
  code          TEXT NOT NULL,                                     -- new | regular | sleeping | custom:*
  name          TEXT NOT NULL,
  definition    JSONB NOT NULL,                                    -- условия на customer_profiles
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, code)
);

-- ---------------------------------------------------------------------
-- 3. Профиль клиента у точки (материализуется воркером)
-- ---------------------------------------------------------------------
CREATE TABLE customer_profiles (
  merchant_id             UUID NOT NULL,
  customer_id             UUID NOT NULL,
  location_id             UUID NOT NULL,
  first_purchase_at       TIMESTAMPTZ,
  last_purchase_at        TIMESTAMPTZ,
  orders_total            INTEGER NOT NULL DEFAULT 0,              -- оплаченные деньгами чеки
  spent_total_minor       BIGINT  NOT NULL DEFAULT 0,
  visits_30d              INTEGER NOT NULL DEFAULT 0,
  spent_90d_minor         BIGINT  NOT NULL DEFAULT 0,
  visits_90d              INTEGER NOT NULL DEFAULT 0,
  median_interval_days    NUMERIC(6,1),                            -- персональный интервал визитов
  tier                    TEXT,                                    -- LM-07
  tier_changed_at         TIMESTAMPTZ,
  rfm                     SMALLINT[3],                             -- recency/frequency/monetary 1..5
  segments                TEXT[] NOT NULL DEFAULT '{}',
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  is_staff                BOOLEAN NOT NULL DEFAULT FALSE,
  winback_step            SMALLINT NOT NULL DEFAULT 0,             -- ступень каскада LM-14
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, customer_id)
);
CREATE INDEX customer_profiles_last_purchase_idx ON customer_profiles (merchant_id, last_purchase_at);
CREATE INDEX customer_profiles_segments_idx ON customer_profiles USING GIN (segments);

-- ---------------------------------------------------------------------
-- 4. Леджер баллов: счета, лоты, проводки (двойная запись)
-- ---------------------------------------------------------------------
CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          account_type NOT NULL,
  owner_id      UUID NOT NULL,                                     -- customer_id | merchant_id | platform
  location_id   UUID NOT NULL,
  balance       BIGINT NOT NULL DEFAULT 0,                         -- баллы (customer) / копейки (funding)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, owner_id, location_id)
);

-- Лот = порция баллов с общим источником и сроком; баланс клиента = SUM(amount_left)
CREATE TABLE point_lots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL,
  location_id     UUID NOT NULL,
  merchant_id     UUID,                                            -- NULL = платформенные/районные
  funding         funding_source NOT NULL,
  campaign_id     UUID,
  campaign_version INTEGER,
  order_id        TEXT,
  label           TEXT,                                            -- «Промо-баллы „Daily“»
  amount_initial  BIGINT NOT NULL CHECK (amount_initial > 0),
  amount_left     BIGINT NOT NULL CHECK (amount_left >= 0),
  expires_at      TIMESTAMPTZ,                                     -- NULL = бессрочно (базовые)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expired_at      TIMESTAMPTZ
);
CREATE INDEX point_lots_fifo_idx ON point_lots (customer_id, location_id, expires_at NULLS LAST) WHERE amount_left > 0;
CREATE INDEX point_lots_expiry_idx ON point_lots (expires_at) WHERE amount_left > 0 AND expires_at IS NOT NULL;

CREATE TABLE ledger_entries (
  id                BIGSERIAL PRIMARY KEY,
  location_id       UUID NOT NULL,
  kind              ledger_kind NOT NULL,
  debit_account_id  UUID NOT NULL REFERENCES accounts(id),
  credit_account_id UUID NOT NULL REFERENCES accounts(id),
  amount            BIGINT NOT NULL CHECK (amount > 0),            -- баллы (=₽) для points-счетов
  lot_id            UUID REFERENCES point_lots(id),
  customer_id       UUID,
  merchant_id       UUID,
  campaign_id       UUID,
  campaign_version  INTEGER,
  order_id          TEXT,
  refund_id         TEXT,
  idempotency_key   TEXT NOT NULL,
  meta              JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);
CREATE INDEX ledger_customer_idx ON ledger_entries (customer_id, created_at DESC);
CREATE INDEX ledger_order_idx ON ledger_entries (order_id);
CREATE INDEX ledger_campaign_idx ON ledger_entries (campaign_id, created_at);

-- Отрицательный баланс после возврата, который не удалось списать с лотов
CREATE TABLE point_debts (
  customer_id   UUID NOT NULL,
  location_id   UUID NOT NULL,
  amount        BIGINT NOT NULL CHECK (amount > 0),
  order_id      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at    TIMESTAMPTZ,
  PRIMARY KEY (customer_id, location_id, order_id)
);

-- ---------------------------------------------------------------------
-- 5. Заказы (представление лояльности) и применённые награды
-- ---------------------------------------------------------------------
CREATE TABLE loyalty_orders (
  order_id            TEXT PRIMARY KEY,                            -- внешний id чека/заказа
  merchant_id         UUID NOT NULL,
  location_id         UUID NOT NULL,
  customer_id         UUID,
  channel             TEXT NOT NULL CHECK (channel IN ('qr','pos','online','delivery')),
  status              order_status NOT NULL,
  quote_id            UUID,
  gross_total_minor   BIGINT NOT NULL,
  discount_total_minor BIGINT NOT NULL DEFAULT 0,
  points_redeemed     BIGINT NOT NULL DEFAULT 0,
  paid_money_minor    BIGINT NOT NULL,
  points_accrued      BIGINT NOT NULL DEFAULT 0,
  items               JSONB NOT NULL,                              -- снимок позиций
  coupon_code         TEXT,
  holdout_campaigns   UUID[] NOT NULL DEFAULT '{}',                -- для аналитики контрольных групп
  quoted_at           TIMESTAMPTZ,
  committed_at        TIMESTAMPTZ,
  reversed_at         TIMESTAMPTZ,
  refunded_minor      BIGINT NOT NULL DEFAULT 0,
  meta                JSONB
);
CREATE INDEX loyalty_orders_merchant_idx ON loyalty_orders (merchant_id, committed_at DESC);
CREATE INDEX loyalty_orders_customer_idx ON loyalty_orders (customer_id, committed_at DESC);

CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL,
  order_id        TEXT,
  customer_id     UUID,
  result          JSONB NOT NULL,                                  -- полный ответ quote
  campaign_versions JSONB NOT NULL,                                -- [{campaign_id, version}]
  paid_money_minor BIGINT NOT NULL,
  reserved_minor  BIGINT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quotes_expiry_idx ON quotes (expires_at) WHERE consumed_at IS NULL;

CREATE TABLE applied_rewards (
  id                BIGSERIAL PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES loyalty_orders(order_id),
  merchant_id       UUID NOT NULL,
  location_id       UUID NOT NULL,
  customer_id       UUID,
  campaign_id       UUID NOT NULL,
  campaign_version  INTEGER NOT NULL,
  action_type       TEXT NOT NULL,
  action_index      SMALLINT NOT NULL,
  discount_minor    BIGINT NOT NULL DEFAULT 0,
  points            BIGINT NOT NULL DEFAULT 0,
  cost_minor        BIGINT NOT NULL DEFAULT 0,                     -- стоимость для бюджета
  funding           funding_source NOT NULL,
  details           JSONB,                                         -- напр. выпавший приз, sku подарка
  reversed_minor    BIGINT NOT NULL DEFAULT 0,
  reversed_points   BIGINT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX applied_rewards_campaign_idx ON applied_rewards (campaign_id, created_at);
CREATE INDEX applied_rewards_order_idx ON applied_rewards (order_id);

-- Счётчики лимитов «на клиента за период»
CREATE TABLE campaign_counters (
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL,
  period_key    TEXT NOT NULL,                                     -- 2026-09-22 | 2026-W39 | 2026-09 | all
  count         INTEGER NOT NULL DEFAULT 0,
  amount_minor  BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, customer_id, period_key)
);

-- ---------------------------------------------------------------------
-- 6. Штампы, челленджи
-- ---------------------------------------------------------------------
CREATE TABLE stamp_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL,
  location_id     UUID NOT NULL,
  campaign_id     UUID NOT NULL REFERENCES campaigns(id),
  card_code       TEXT NOT NULL,                                   -- spec action.card
  customer_id     UUID NOT NULL,
  stamps          SMALLINT NOT NULL DEFAULT 0,
  target          SMALLINT NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0,
  pending_reward  BOOLEAN NOT NULL DEFAULT FALSE,                  -- награда ждёт применения
  last_stamp_at   TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, card_code, customer_id)
);

CREATE TABLE stamp_events (
  id            BIGSERIAL PRIMARY KEY,
  card_id       UUID NOT NULL REFERENCES stamp_cards(id) ON DELETE CASCADE,
  order_id      TEXT,
  delta         SMALLINT NOT NULL,                                 -- +1 / −1 (возврат)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE challenge_progress (
  campaign_id     UUID NOT NULL REFERENCES campaigns(id),
  challenge_code  TEXT NOT NULL,
  customer_id     UUID NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  progress        BIGINT NOT NULL DEFAULT 0,
  target          BIGINT NOT NULL,
  seen_keys       TEXT[] NOT NULL DEFAULT '{}',                    -- уникальные sku / недели
  completed_at    TIMESTAMPTZ,
  rewarded_at     TIMESTAMPTZ,
  PRIMARY KEY (campaign_id, challenge_code, customer_id, window_start)
);

-- ---------------------------------------------------------------------
-- 7. Купоны, рефералы
-- ---------------------------------------------------------------------
CREATE TABLE coupons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL,                             -- публичный или персональный
  location_id           UUID NOT NULL,
  redeem_campaign_id    UUID NOT NULL REFERENCES campaigns(id),    -- кампания, которая исполняется при погашении
  issued_by_campaign_id UUID REFERENCES campaigns(id),             -- кто выдал (cross_promo / winback / birthday)
  issuer_merchant_id    UUID,
  redeemer_merchant_id  UUID NOT NULL,
  customer_id           UUID,                                      -- NULL = публичный код
  status                coupon_status NOT NULL DEFAULT 'issued',
  max_uses              INTEGER NOT NULL DEFAULT 1,
  uses                  INTEGER NOT NULL DEFAULT 0,
  issued_order_id       TEXT,
  redeemed_order_id     TEXT,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at           TIMESTAMPTZ
);
CREATE UNIQUE INDEX coupons_code_idx ON coupons (redeemer_merchant_id, code) WHERE customer_id IS NULL;
CREATE INDEX coupons_customer_idx ON coupons (customer_id, status, expires_at);

CREATE TABLE referrals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES campaigns(id),
  merchant_id         UUID NOT NULL,
  location_id         UUID NOT NULL,
  referrer_customer_id UUID NOT NULL,
  referee_customer_id  UUID,
  code                TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('invited','registered','qualified','rewarded','rejected','expired')),
  qualified_order_id  TEXT,
  reject_reason       TEXT,                                        -- self_referral | same_device | velocity
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at        TIMESTAMPTZ,
  rewarded_at         TIMESTAMPTZ,
  UNIQUE (campaign_id, referee_customer_id)
);
CREATE UNIQUE INDEX referrals_code_idx ON referrals (code);

-- ---------------------------------------------------------------------
-- 8. Абонементы и подарочные сертификаты (V2)
-- ---------------------------------------------------------------------
CREATE TABLE subscription_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL,
  location_id     UUID NOT NULL,
  campaign_id     UUID REFERENCES campaigns(id),
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('units','period')),
  item_filter     JSONB NOT NULL,
  units           INTEGER,                                         -- для units
  period_days     INTEGER,                                         -- для period
  price_minor     BIGINT NOT NULL,
  validity_days   INTEGER NOT NULL,
  daily_limit     SMALLINT NOT NULL DEFAULT 1,
  giftable        BOOLEAN NOT NULL DEFAULT TRUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES subscription_plans(id),
  merchant_id     UUID NOT NULL,
  location_id     UUID NOT NULL,
  customer_id     UUID NOT NULL,
  buyer_customer_id UUID NOT NULL,
  status          subscription_status NOT NULL DEFAULT 'active',
  units_left      INTEGER,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  purchase_order_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_customer_idx ON subscriptions (customer_id, status);

CREATE TABLE subscription_redemptions (
  id              BIGSERIAL PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  order_id        TEXT NOT NULL,
  units           INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, order_id)
);

CREATE TABLE gift_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL,
  location_id     UUID NOT NULL,
  code            TEXT NOT NULL UNIQUE,
  initial_minor   BIGINT NOT NULL,
  balance_minor   BIGINT NOT NULL CHECK (balance_minor >= 0),
  buyer_customer_id UUID,
  holder_customer_id UUID,
  status          gift_card_status NOT NULL DEFAULT 'active',
  expires_at      TIMESTAMPTZ,
  purchase_order_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gift_card_transactions (
  id            BIGSERIAL PRIMARY KEY,
  gift_card_id  UUID NOT NULL REFERENCES gift_cards(id),
  order_id      TEXT,
  amount_minor  BIGINT NOT NULL,                                   -- + пополнение / − списание
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 9. Партнёрства (кросс-промо)
-- ---------------------------------------------------------------------
CREATE TABLE partnerships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  merchant_a      UUID NOT NULL,
  merchant_b      UUID NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('invited','active','paused','ended')),
  terms           JSONB NOT NULL,                                  -- {direction, funding, limits}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_a, merchant_b)
);

-- ---------------------------------------------------------------------
-- 10. События (outbox), аудит, статистика
-- ---------------------------------------------------------------------
CREATE TABLE outbox_events (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,                                     -- loyalty.points.accrued ...
  aggregate_id  TEXT NOT NULL,
  location_id   UUID NOT NULL,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);
CREATE INDEX outbox_unpublished_idx ON outbox_events (id) WHERE published_at IS NULL;

CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      UUID NOT NULL,
  actor_role    TEXT NOT NULL,                                     -- merchant_owner | representative | platform_admin | system
  merchant_id   UUID,
  entity        TEXT NOT NULL,                                     -- campaign | settings | manual_accrual ...
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL,                                     -- create | publish | pause | edit | reverse | manual_accrue
  before        JSONB,
  after         JSONB,
  ip            INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_merchant_idx ON audit_log (merchant_id, created_at DESC);

CREATE TABLE campaign_stats_daily (
  campaign_id           UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  day                   DATE NOT NULL,
  orders_applied        INTEGER NOT NULL DEFAULT 0,
  customers_applied     INTEGER NOT NULL DEFAULT 0,
  revenue_applied_minor BIGINT NOT NULL DEFAULT 0,
  discount_minor        BIGINT NOT NULL DEFAULT 0,
  points_issued         BIGINT NOT NULL DEFAULT 0,
  points_redeemed_from  BIGINT NOT NULL DEFAULT 0,                 -- потрачено из лотов кампании
  points_expired_from   BIGINT NOT NULL DEFAULT 0,
  cost_minor            BIGINT NOT NULL DEFAULT 0,
  holdout_orders        INTEGER NOT NULL DEFAULT 0,
  holdout_revenue_minor BIGINT NOT NULL DEFAULT 0,
  holdout_customers     INTEGER NOT NULL DEFAULT 0,
  hints_shown           INTEGER NOT NULL DEFAULT 0,
  hints_converted       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);

-- ---------------------------------------------------------------------
-- 11. Согласия клиента на коммуникации (ссылка на платформенный профиль)
-- ---------------------------------------------------------------------
CREATE TABLE customer_consents (
  customer_id     UUID NOT NULL,
  location_id     UUID NOT NULL,
  promo_push      BOOLEAN NOT NULL DEFAULT FALSE,
  promo_email     BOOLEAN NOT NULL DEFAULT FALSE,
  birthday_use    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, location_id)
);

-- ---------------------------------------------------------------------
-- 12. Row-Level Security по локации (пример)
-- ---------------------------------------------------------------------
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_location_isolation ON campaigns
  USING (location_id = current_setting('app.location_id', true)::uuid);
-- Аналогичные политики — на все таблицы с location_id.

-- ---------------------------------------------------------------------
-- 13. Полезные представления
-- ---------------------------------------------------------------------
CREATE VIEW customer_points_balance AS
SELECT customer_id, location_id,
       SUM(amount_left) AS balance,
       SUM(amount_left) FILTER (WHERE expires_at IS NULL) AS base_balance,
       SUM(amount_left) FILTER (WHERE expires_at IS NOT NULL) AS promo_balance,
       MIN(expires_at) FILTER (WHERE amount_left > 0 AND expires_at IS NOT NULL) AS next_expiry
FROM point_lots
WHERE amount_left > 0
GROUP BY customer_id, location_id;

CREATE VIEW campaign_kpi AS
SELECT c.id AS campaign_id, c.merchant_id, c.name, c.mechanic, c.status,
       COALESCE(SUM(s.orders_applied),0)        AS orders_applied,
       COALESCE(SUM(s.revenue_applied_minor),0) AS revenue_applied_minor,
       COALESCE(SUM(s.cost_minor),0)            AS cost_minor,
       COALESCE(SUM(s.points_issued),0)         AS points_issued,
       CASE WHEN SUM(s.points_issued) > 0
            THEN ROUND(100.0 * SUM(s.points_redeemed_from) / SUM(s.points_issued), 1) END AS redemption_pct,
       c.budget_total_minor, c.budget_used_minor
FROM campaigns c LEFT JOIN campaign_stats_daily s ON s.campaign_id = c.id
GROUP BY c.id;

# 03 · Движок правил: спецификация кампаний (DSL) и алгоритм расчёта

> Нормативный документ. Всё, что здесь описано, должно выполняться любой реализацией движка. Формальная схема — [`schema/campaign.schema.json`](schema/campaign.schema.json). Референсная реализация на JS — [`/demo/app/loyalty-constructor/engine.js`](../../demo/app/loyalty-constructor/engine.js), golden-тесты — [`examples/testcases/`](examples/testcases/README.md).

---

## 1. Архитектурная идея

```
 Шаблон механики (LM-xx)          Спецификация кампании (Spec, JSON)         Движок
 ┌──────────────────────┐  compile  ┌───────────────────────────────┐  quote/commit  ┌────────────┐
 │ params_schema (форма)│ ────────► │ trigger + conditions + actions│ ─────────────► │ детерминир.│
 │ defaults, hints      │           │ schedule, audience, limits    │                │ расчёт     │
 └──────────────────────┘           └───────────────────────────────┘                └────────────┘
```

- **Шаблон** знает про UI (какие поля показать) и про «умолчания под категорию бизнеса». Он **чистой функцией** `compile(params) → spec` превращается в Spec.
- **Spec** — единственное, что исполняет движок. Движок ничего не знает про «штампы» или «порог чека» как про сущности — только про триггеры, условия и действия.
- **Версия Spec неизменяема.** Любое изменение опубликованной кампании = новая версия.

Следствие для агентов: новая механика = новый шаблон (`params_schema` + `compile` + предпросмотр + golden-тесты). Код движка меняется только при появлении нового *типа действия или поля условия*.

---

## 2. Единицы и точность

| Величина | Представление | Правило |
|---|---|---|
| Деньги | целое, **копейки** (`amount_minor`) | Никаких float |
| Баллы | целое, **баллы** (1 балл = 1 ₽) | Дробные баллы не существуют |
| Проценты | число с ≤ 2 знаками (`7`, `7.5`) | Хранить как `percent_bp` (базисные пункты, `750`) в БД; в Spec допускается `7.5` |
| Время | ISO-8601 с зоной; расчёт в **часовом поясе локации** | `context.now` задаёт сервер, не клиент |

Округление:

```
money_pct(amount_minor, percent)   = floor(amount_minor × percent / 100)        // копейки
points_pct(amount_minor, percent)  = floor(amount_minor × percent / 10000)      // баллы (₽)
points_from_minor(amount_minor)    = floor(amount_minor / 100)
```

Всегда **floor** (в пользу ТСП), кроме скидок к клиенту типа `to_price`, где цена задана явно.

---

## 3. Спецификация кампании (Spec)

### 3.1 Верхний уровень

```jsonc
{
  "spec_version": "1.0",
  "mechanic": "threshold",                 // id шаблона: threshold | bundle | addon | cashback | happy_hours |
                                           // stamps | tiers | subscription | challenge | welcome | referral |
                                           // cross_promo | coupon | winback | birthday | instant_win | gift_card | review
  "name": "От 450 ₽ — +60 баллов",
  "priority": 100,                         // больше = раньше; по умолчанию из шаблона
  "stacking": { "group": "bonus", "mode": "exclusive" },   // см. §5
  "schedule": {
    "starts_at": "2026-09-22T00:00:00+03:00",
    "ends_at":   "2026-12-31T23:59:59+03:00",             // null = бессрочно
    "timezone":  "Europe/Moscow",
    "windows":   [ { "days": [1,2,3,4,5], "from": "07:00", "to": "12:00" } ]   // пусто = всегда
  },
  "audience": {
    "segments": ["all"],                   // all | new | regular | sleeping | vip_platform | custom:<segment_id>
    "statuses": [],                        // PAY | PASS | VIP (пусто = любые)
    "tiers":    [],                        // уровни точки (LM-07)
    "exclude_staff": true,
    "holdout_pct": 10                      // контрольная группа, 0–50
  },
  "trigger": { "type": "purchase" },       // см. §4.1
  "conditions": [                          // AND; для OR — { "any": [...] }; отрицание — { "not": {...} }
    { "field": "basket.paid_money", "op": ">=", "value": 45000 }
  ],
  "actions": [                             // см. §4.3
    { "type": "accrue_points", "mode": "fixed", "amount": 60, "ttl_days": 14, "funding": "merchant" }
  ],
  "limits": {
    "per_customer": { "count": 2, "period": "day" },   // period: day | week | month | campaign
    "total_uses": null,
    "budget_total_minor": 3000000,                     // 30 000 ₽
    "budget_daily_minor": null
  },
  "content": {                             // тексты для клиента (RU), генерируются шаблоном, редактируемы
    "title": "От 450 ₽ — +60 баллов",
    "badge": "+60 б.",
    "subtitle": "Промо-баллы действуют 14 дней",
    "terms": "Порог считается по сумме, оплаченной деньгами, после скидок."
  },
  "channels": { "showcase": true, "checkout": true, "push": false },
  "meta": { "template_id": "lm-01", "template_params": { "threshold": 45000, "reward": { "type": "points", "amount": 60 }, "ttl_days": 14 } }
}
```

Серверные поля (не входят в Spec, хранятся рядом): `campaign_id`, `merchant_id`, `location_id`, `version`, `status`, `created_by`, `published_at`, `budget_used_minor`.

Статусы кампании: `draft → scheduled → active ⇄ paused → finished → archived`; `paused_budget` — авто-пауза при исчерпании бюджета.

### 3.2 Условия (Condition)

```jsonc
{ "field": "<path>", "op": "<op>", "value": <any> }
{ "field": "basket.items", "op": "any", "match": { "category": { "in": ["coffee"] } }, "min_qty": 1 }
{ "any": [ <cond>, <cond> ] }
{ "not": <cond> }
```

Операторы: `== != > >= < <= in not_in between contains any all count_gte sum_gte`.

Поля контекста (полный список — в JSON Schema, `$defs.FieldPath`):

| Поле | Тип | Смысл |
|---|---|---|
| `basket.gross_total` | minor | Сумма по ценам каталога до скидок |
| `basket.after_discounts` | minor | После скидок класса «цена» (§5.1) |
| `basket.paid_money` | minor | К оплате деньгами (после скидок и списания баллов) |
| `basket.items` | list | `{ sku, name, category, price_minor, qty, tags[] }` |
| `basket.item_count` | int | Сумма qty |
| `basket.eligible_amount` | minor | Сумма позиций, подходящих под `filter` действия (вычисляется на этапе действия) |
| `customer.status` | enum | `PAY` / `PASS` / `VIP` |
| `customer.tier` | string | Уровень точки (LM-07) |
| `customer.orders_at_merchant` | int | Оплаченные деньгами чеки у точки |
| `customer.days_since_last_purchase` | int | `null`, если покупок не было |
| `customer.visits_30d`, `customer.spent_90d` | int / minor | Скользящие метрики |
| `customer.is_staff` | bool | Сотрудник точки |
| `customer.birthday_in_days` | int | До ДР (отрицательное — прошло) |
| `customer.segments` | list | Системные и пользовательские сегменты |
| `context.weekday`, `context.time`, `context.date` | int 1–7, `HH:MM`, `YYYY-MM-DD` | В зоне локации |
| `context.channel` | enum | `qr` / `pos` / `online` / `delivery` |
| `coupon.code`, `coupon.valid` | string, bool | Введённый код и результат валидации |
| `stamps.<card>.count` | int | Штампов на карточке |
| `subscription.active.<plan>` | bool | Активный абонемент |
| `referral.qualified` | bool | Для триггера `referral_qualified` |

Фильтр позиций (`filter`), используемый в условиях и действиях:

```jsonc
{ "sku": { "in": ["cd1","cd2"] }, "category": { "in": ["coffee"] }, "tags": { "any": ["hot"] }, "exclude_sku": ["gift"] }
```

### 3.3 Триггеры

| Тип | Источник | Когда |
|---|---|---|
| `purchase` | quote/commit чека | Основной. Все действия классов «цена» и «награда» |
| `checkin` | скан QR точки без покупки | V2, только `stamp`/`challenge_progress` с лимитом |
| `referral_qualified` | системное событие после commit чека приглашённого | LM-11 |
| `inactivity` | планировщик, ежедневно | LM-14; параметры `{ "days": 30 }` |
| `birthday` | планировщик | LM-15; `{ "days_before": 5, "window_days": 10 }` |
| `stamp_card_completed` | системное | Награда за карточку (обычно вложена в `stamp.reward`) |
| `challenge_completed` | системное | LM-09 |
| `review_approved` | модерация отзывов | LM-18 |
| `tier_recalculated` | планировщик | LM-07 |
| `manual` | кассир/ТСП в кабинете | Ручное начисление с комментарием; лимиты обязательны |

### 3.4 Действия (Action)

Каждое действие имеет `type` и опционально `filter` (к каким позициям относится), `stacking` (переопределение группы) и `cost_model` (как считать стоимость для бюджета: по умолчанию — номинал).

| type | Ключевые поля | Класс (§5) | Стоимость для бюджета |
|---|---|---|---|
| `discount` | `scope: basket|items|item|bundle`, `mode: percent|fixed|to_price|cheapest_free`, `value`, `max_amount_minor`, `max_qty`, `filter`, `bundle` | цена | сумма скидки |
| `free_item` | `sku` или `filter` + `pick: cheapest`, `qty`, `requires_purchase_of` (filter) | цена | цена товара |
| `redeem_subscription_unit` | `plan_id`, `units` | цена (первым) | 0 (предоплачено) |
| `accrue_points` | `mode: percent|fixed|ladder|by_category|multiplier`, `percent`, `amount`, `steps[]`, `categories{}`, `base: paid_money|eligible_amount|total`, `cap`, `ttl_days`, `funding: merchant|platform` | награда | баллы × 100 |
| `stamp` | `card`, `count`, `max_per_order`, `min_interval_minutes`, `target`, `start_bonus`, `card_ttl_days`, `reward: Action` | награда | 0 (стоимость — в `reward`) |
| `coupon_issue` | `redeem_campaign_id` **или** `inline: { conditions, actions }`, `ttl_days`, `to: customer|referrer|referee`, `redeemer_merchant_id` | награда | 0 при выдаче; стоимость — при погашении |
| `challenge_progress` | `challenge`, `metric: visits|amount|unique_sku|streak_weeks`, `increment`, `target`, `window_days`, `reward: Action` | награда | 0 / в `reward` |
| `random_reward` | `table: [{ weight, action, daily_limit }]`, `seed: order_id` | награда | номинал выпавшего |
| `notify` | `channel: push|email|inapp`, `template`, `params` | побочное | 0 |
| `tier_assign` | `tier` | системное | 0 |

Лестница (`ladder`) и категории:

```jsonc
{ "type": "accrue_points", "mode": "ladder", "base": "paid_money",
  "steps": [ { "from_minor": 30000, "percent": 3 }, { "from_minor": 60000, "percent": 5 }, { "from_minor": 100000, "percent": 8 } ],
  "cap": 300, "ttl_days": 30, "funding": "merchant" }

{ "type": "accrue_points", "mode": "by_category", "base": "eligible_amount",
  "categories": { "care": 10, "haircut": 3 }, "ttl_days": 45, "funding": "merchant" }
```

`ladder` — применяется **одна** ставка, соответствующая наибольшей достигнутой ступени (не кумулятивно).

---

## 4. Контекст расчёта (вход движка)

```jsonc
{
  "merchant_id": "mrc_daily", "location_id": "loc_tverskoy",
  "order_id": "ord_2026-09-22_0001",          // обязателен для commit, желателен для quote
  "channel": "qr",
  "now": "2026-09-22T09:40:00+03:00",          // сервер
  "customer": { "id": "cus_1", "status": "PASS", "tier": null, "orders_at_merchant": 12,
                "days_since_last_purchase": 3, "visits_30d": 6, "spent_90d": 1240000,
                "is_staff": false, "birthday_in_days": 40, "segments": ["regular"],
                "points_balance": 1250, "referral_code_used": null },
  "items": [ { "sku": "cd1", "name": "Капучино", "category": "coffee", "price_minor": 22000, "qty": 2 } ],
  "coupon_code": null,
  "redeem_points": 0,                          // сколько баллов клиент хочет списать
  "state": {                                   // состояние клиента у точки, подгружает сервер
    "stamps": { "coffee": { "count": 4, "last_at": "2026-09-20T10:00:00+03:00" } },
    "counters": { "cmp_x:day:2026-09-22": 1 }, "subscriptions": [], "challenges": {}
  },
  "catalog": [ ... ]                           // для подсказок (самый дешёвый товар ≥ остатка)
}
```

Список активных кампаний (с версиями) движок получает отдельным аргументом: точки + платформенные (`platform_base_cashback`) + кросс-промо-кампании партнёров, направленные на эту точку.

---

## 5. Алгоритм расчёта (quote)

### 5.1 Порядок стадий

```
0. normalize     цены/кол-ва → minor, gross_total
1. select        активные по статусу, расписанию, аудитории, holdout, лимитам, бюджету, триггеру
2. class PRICE   redeem_subscription_unit → discount(item/bundle/to_price/free_item) → discount(basket)
                 условия считаются на gross-корзине; стекинг по группам (§5.2)
3. REDEEM        списание баллов клиента: min(redeem_points, balance, after_discounts × max_points_share_pct)
                 → paid_money = after_discounts − redeemed × 100
4. class REWARD  условия считаются на paid_money / after_discounts; действия accrue_points, stamp,
                 challenge_progress, random_reward, coupon_issue, notify; стекинг по группам
                 (notify попадает в applied с action_type "notify" и в notifications; cost_minor = 0)
5. platform      базовый кэшбэк платформы (системная кампания, всегда, funding: platform) на paid_money
6. hints         подсказки: до порога, недостающий компонент набора, апселл, штампы, уровень
7. explain       для каждой кандидат-кампании — applied | skipped(reason)
8. result        quote_id (TTL 15 мин), резерв бюджета/лимитов
```

Причины `skipped` (строки `reason` в `explain`):

| Причина | Когда |
|---|---|
| `schedule` | вне `starts_at…ends_at` |
| `window` | вне окон `schedule.windows` (день недели/время в TZ кампании) |
| `audience` | сегмент/статус/уровень клиента не подходит |
| `staff_excluded` | `audience.exclude_staff` и `customer.is_staff` |
| `guest` | `customer = null`: наградные действия (баллы, штампы, купоны, розыгрыш) недоступны гостю; ценовые действия гостю **применяются** |
| `holdout` | клиент в контрольной группе (см. ниже) |
| `limit_per_customer`, `limit_total`, `budget` | исчерпаны лимиты/бюджет (`counters`, `uses_total`, `budget_used_*`) |
| `coupon_required` | кампания привязана к промокоду (`trigger.params.coupon` или условие `coupon.*`), а код не введён; если у клиента есть неиспользованный купон — добавляется hint `coupon_available` |
| `coupon_invalid` | код введён, но не подходит (не найден, чужой, просрочен, использован, не для этой точки) |
| `condition:<idx>` | не выполнено условие с индексом `idx` (первое непройденное) |
| `stacking:<group>:<winner_id>` | в exclusive-группе уже победила кампания `winner_id` |
| `stamp_interval` | штамп по карте ставился менее `min_interval_minutes` назад (защита от дробления чека) |
| `cap` | достигнут потолок (`max_merchant_cashback_points`, `max_total_discount_pct`, `cap` действия) — начислять/скидывать больше нечего |
| `no_effect` | кампания подходит, но действие не дало эффекта на этот чек (нет подходящих позиций, 0 баллов после округления) |

**Контрольная группа (holdout).** Принадлежность детерминирована и не зависит от времени: `bucket = uint32(sha256(customer_id + ":" + campaign_id)[0:8]) mod 100`; клиент в holdout, если `bucket < audience.holdout_pct`. Один и тот же клиент может быть в holdout одной кампании и вне holdout другой; при смене `holdout_pct` группа расширяется/сужается монотонно (бакеты не перемешиваются). Кампания в holdout не применяется, не даёт подсказок и не показывается на витрине, но фиксируется в `explain` и в статистике (`holdout_orders`, `holdout_revenue_minor`) для атрибуции эффекта (07 §2).

### 5.2 Стекинг

- У каждой кампании — `stacking.group` (строка) и `mode` (`exclusive` | `stackable`).
- Внутри стадии кандидаты сортируются по `priority` ↓, затем `published_at` ↑.
- В группе с `exclusive` применяется **только первая** подходящая кампания; остальные получают `skipped: stacking`.
- `stackable` применяются все, но действуют потолки из настроек ТСП (`loyalty_settings`):
  - `max_total_discount_pct` (по умолчанию 30 %) — суммарная скидка класса «цена» от gross;
  - `max_merchant_cashback_pct` (20 %) — суммарный % промо-кэшбэка ТСП;
  - `max_coupons_per_order` (1);
  - на одну товарную позицию — **одно** действие `to_price|cheapest_free|free_item` (побеждает приоритет).
- Группы по умолчанию (из шаблонов): `item_price` (LM-02, LM-03, LM-08), `basket_discount` (LM-05 со скидкой, LM-13), `cashback` (LM-04, LM-05 с множителем — stackable), `bonus` (LM-01, LM-10, LM-16 — exclusive), `stamp` (stackable), `coupon_out` (LM-12 — stackable, ≤ 1 на партнёра), `platform_base` (системная).
- Купоны: 1 на чек; купон исключает другие кампании своей группы; купон **не** блокирует кэшбэк, если в купоне не указано `stacking.blocks: ["cashback"]`.

### 5.3 База начисления

`accrue_on` в настройках точки: `paid_money` (по умолчанию — не начислять на часть чека, оплаченную баллами) или `total` (`after_discounts`). Для `eligible_amount` — сумма позиций по `filter` пропорционально уменьшается на долю скидок/списаний: `eligible × after_discounts / gross`.

### 5.4 Порог и прогресс (hints)

Для каждой кампании с условием `basket.paid_money >= T` (или `after_discounts`), не выполнившимся:
```
remaining = T − current
if remaining <= max(0.4 × T, 30000): hint { type: "threshold_progress", campaign_id, remaining_minor,
   suggested_item: cheapest(catalog where price_minor >= remaining && !in_basket) }
```
Для `stamp`: `hint { type: "stamps", card, count, target, remaining }`. Для `bundle`: `missing_component`. Для `addon`: `addon_offer { sku, special_price_minor }` (показывается, пока позиция не добавлена). Для `tiers`: `tier_progress`.

### 5.5 Списание баллов (REDEEM)

- Порядок лотов: сначала промо-лоты **этой точки** по ближайшему сроку, затем промо-лоты района/платформы по сроку, затем базовые (бессрочные).
- Ограничение: `max_points_share_pct` точки (по умолчанию 50 %; платформа может задать минимум, напр., ≥ 30 %, чтобы баллы оставались ликвидными).
- На экране оплаты клиент видит, какие лоты спишутся и что «сгорит раньше».

### 5.6 Результат quote

```jsonc
{
  "engine_version": "1.0.0",
  "gross_total_minor": 44000, "discount_total_minor": 0, "after_discounts_minor": 44000,
  "points_redeemed": 0, "points_redeem_max": 220, "paid_money_minor": 44000,
  "reward_base_minor": 44000,            // база наград: paid_money минус позиции gift_card (LM-17)
  "points_to_accrue": 22,
  "lots_to_accrue": [ { "label": "Кэшбэк LOVII", "points": 22, "expires_at": null, "funding": "platform", "campaign_id": "platform_base" } ],
  "lots_to_redeem": [ { "lot_id": "lot_p1", "points": 100 } ],   // какие лоты спишутся (FIFO §5.5)
  "applied": [ { "campaign_id", "campaign_version", "mechanic", "title", "action_type", "action_index",
                 "discount_minor", "points", "ttl_days", "funding", "items"?, "details", "cost_minor" } ],
  "hints": [ { "type", "campaign_id", "text", "remaining_minor"?, "progress"?, "suggested_item"?, "details"? } ],
  "stamps": [ { "card", "before", "after", "target", "completed" } ],
  "coupon": null | { "code", "valid", "reason"?, "campaign_id" },
  "coupons_issued": [ { "code", "title", "expires_at", "redeemer_merchant_id", "inline"?, "campaign_id"? } ],
  "notifications": [ { "campaign_id", "channel", "template", "params" } ],
  "deferred": [ … ],                      // награды, которые выдаются не сейчас (напр., штамп-подарок в следующем чеке)
  "lines": [ { "sku", "name", "category", "qty", "price_minor", "discount_minor", "final_minor", "added"? } ],
  "cost_minor": 0,                        // суммарная стоимость наград для ТСП (для бюджета)
  "explain": [ { "campaign_id", "name", "result": "applied" | "skipped", "reason"? } ],
  "local": { "date": "2026-09-22", "time": "09:40", "weekday": 2, "timezone": "Europe/Moscow" },
  "quote_id": "…", "expires_at": "…"      // только при options.issue_quote_id
}
```

`hint.type` (MVP): `threshold_progress` (порог LM-01/LM-10/LM-16 и следующая ступень лестницы LM-04 — в `text` подставляется награда: «+60 баллов», «кэшбэка 8 %», «скидки 10 %», «подарка»), `stamps`, `bundle_missing_component`, `addon_offer`, `coupon_available`, `points_expiring`; V2: `tier_progress`, `challenge_progress`. Тексты подсказок формируются движком на русском по шаблонам §5.4 (например, «До +60 баллов осталось 10 ₽ — добавьте Эспрессо 150 ₽», «Ещё 1 покупка — и 6-й напиток бесплатно») — кабинет и касса показывают их как есть.

### 5.7 Случайные награды

`u = sha256(order_id + ":" + campaign_id)[0:8] / 2^32`; выбор по кумулятивным весам; если у приза исчерпан `daily_limit` — берётся следующий по таблице; если все исчерпаны — утешительный (первый с `fallback: true`). Результат сохраняется в `applied_rewards.details` и не пересчитывается.

---

## 6. Commit и Reverse

### 6.1 Commit (после успешной оплаты)

Вход: `order_id`, `quote_id` (опц.), `payment { method, paid_money_minor, paid_points }`, `idempotency_key = order_id`.

1. Если `quote_id` жив (≤ 15 мин) и сумма оплаты равна `quote.paid_money` — применяются **зафиксированные в quote** версии кампаний и результаты класса «цена». Класс «награда» пересчитывается на тех же версиях (учёт лимитов на момент commit).
2. Если quote нет/истёк — полный пересчёт на текущих активных версиях; ответ помечается `recomputed: true`.
3. В одной транзакции: проверка/инкремент счётчиков лимитов и бюджета (`SELECT … FOR UPDATE`), записи леджера (лоты, проводки), штампы/челленджи, купоны, `applied_rewards`, событие в outbox.
4. Повторный commit с тем же `order_id` → тот же ответ (идемпотентность), без повторных проводок.
5. Если бюджет исчерпан между quote и commit — награда всё равно применяется (quote — обещание клиенту), кампания переходит в `paused_budget`, перерасход логируется.

### 6.2 Reverse (возврат / отмена)

Вход: `order_id`, `refund { full: bool, amount_minor, items[] }`.

- **Полный**: снять начисленные баллы с лотов (если лот частично потрачен — списать с базового баланса, допускается отрицательный баланс до `max_negative_points` = 500, иначе создаётся запись `debt` и следующее начисление гасит долг); вернуть списанные баллы (в тот же тип лота); снять штампы/прогресс; аннулировать неиспользованные выданные купоны; уменьшить счётчики и бюджет.
- **Частичный**: `ratio = amount_minor / paid_money_minor`; баллы к снятию `floor(accrued × ratio)`; штамп снимается, если возвращена позиция-основание; скидки класса «цена» не пересчитываются (возврат по факту оплаченной цены).
- Reverse идемпотентен по `(order_id, refund_id)`.

---

## 7. Планировщик (триггеры по времени)

| Задача | Периодичность | Идемпотентность |
|---|---|---|
| `inactivity` (LM-14) | ежедневно 10:00 локации | `(campaign_id, customer_id, step)` |
| `birthday` (LM-15) | ежедневно | `(campaign_id, customer_id, year)` |
| `tier_recalculated` (LM-07) | ежедневно 03:00 | по дате |
| Истечение лотов | ежечасно | по `lot_id` |
| Истечение карточек штампов / купонов / quote-резервов | ежечасно | по id |
| Напоминания «сгорает через 3 дня» | ежедневно | `(lot_id)` |
| Агрегаты статистики `campaign_stats_daily` | ежечасно инкрементально | по `(campaign_id, date)` |

Пуш-уведомления отправляются только при наличии согласия (`customer.consents.promo_push`), с частотным лимитом 2 промо-пуша/нед на клиента по локации.

---

## 8. Компиляция шаблонов

Каждый шаблон регистрируется объектом (референс — `/demo/app/loyalty-constructor/templates.js`):

```ts
interface Template {
  id: "lm-01" | ...;
  mechanic: string;                 // значение поля spec.mechanic
  title: string; short: string; summary: string; icon: string;
  goal: "check"|"frequency"|"acquisition"|"reactivation"|"engagement"|"prepay";
  tier: "free"|"pro"; stage: "MVP"|"V2"; complexity: "S"|"M"|"L";
  params_schema: JSONSchema;        // форма в кабинете (см. расширения ниже)
  defaults(ctx: { category: string; avg_check_minor: number; margin_pct: number; cheap_sku?: string; upsell_sku?: string; … }): Params;
  compile(params: Params): Spec;    // чистая функция, без побочных эффектов
  estimate(params, stats): { cost_month_minor: number; eligible_orders_month: number; note: string; risk: "low"|"medium"|"high" };
  preview(params): { title: string; badge: string; subtitle: string };
}
```

Расширения JSON Schema для генератора формы (все начинаются с `x-`):

| Ключ | Значение | Смысл |
|---|---|---|
| `x-widget` | `money` (ввод в рублях, хранение в копейках) · `percent` · `int` · `days` · `minutes` · `text` · `select` (+ `x-enumNames`) · `bool` · `category` · `categories` · `sku` · `merchant` · `rows` · `time` · `date` | какой контрол рисовать |
| `x-showIf` | `{ "<param>": "<value>" \| ["<v1>", "<v2>"] }` | поле показывается, только когда все условия выполнены (AND) |
| `x-columns` | для `rows`: `[{ key, title, widget, enum?, enumNames? }]` | колонки табличного параметра (ступени лестницы, окна времени, призы) |
| `x-help` | строка | подсказка под полем |
| `x-unit` | строка | единица измерения рядом с числом |
| `x-optional` | `true` | пустое значение допустимо («любая категория») |
| `x-pro` | `true` | поле доступно только на тарифе PRO |

Названия товаров/партнёров для заголовков шаблон не знает — кабинет передаёт их в params (`offer_name`, `partner_name`, `plan_name`) рядом с идентификаторами.

Требования к `compile`:
- детерминирован, покрыт golden-тестами (`params → spec` снапшот);
- всегда проставляет `stacking`, `priority`, `content`, `meta.template_id`, `meta.template_params`;
- не генерирует `limits.per_customer = null` для наградных механик (минимум `1/day`).

Пример: `lm-01`.`compile({ threshold: 45000, reward: { type: "points", amount: 60 }, ttl_days: 14 })` → Spec из §3.1.

---

## 9. Симуляция для кабинета ТСП

`POST /loyalty/simulate { spec | campaign_id, context }` — тот же движок, но без резервов и записи; `explain` всегда включён; допускается `now` из запроса (для проверки расписаний). Кабинет использует симуляцию в предпросмотре: «Чек 420 ₽ → без награды, до подарка 30 ₽; чек 740 ₽ → +60 баллов».

---

## 10. Инварианты (проверяются тестами)

1. `sum(discounts) ≤ gross_total × max_total_discount_pct` и ≤ `gross_total`.
2. `paid_money + redeemed_points × 100 + discounts = gross_total`.
3. Баллы никогда не начисляются на сумму, оплаченную баллами, при `accrue_on = paid_money`.
4. Один и тот же вход при одних и тех же версиях кампаний даёт байт-в-байт одинаковый результат (кроме `quote_id`/времени).
5. Commit идемпотентен; reverse(commit(x)) возвращает счётчики/бюджет к исходным.
6. Кампания в `holdout` для клиента никогда не применяется, но всегда попадает в `explain`.
7. Промо-лот со сроком списывается раньше бессрочного.
8. Действие класса «цена» не может сделать цену позиции отрицательной; `free_item` требует наличия позиции в корзине или добавляет её с ценой 0 (по `add_if_missing`).

---

## 11. Коды ошибок движка

| Код | HTTP | Когда |
|---|---|---|
| `LOY_SPEC_INVALID` | 422 | Spec не проходит JSON Schema / семантику (`compile` или ручное редактирование) |
| `LOY_QUOTE_EXPIRED` | 409 | commit с истёкшим quote и `strict=true` |
| `LOY_AMOUNT_MISMATCH` | 409 | сумма оплаты ≠ `quote.paid_money` |
| `LOY_COUPON_INVALID` | 400 | код не найден / истёк / использован / не для этой точки |
| `LOY_POINTS_INSUFFICIENT` | 400 | списание больше баланса |
| `LOY_POINTS_SHARE_EXCEEDED` | 400 | списание больше доли, разрешённой точкой |
| `LOY_ORDER_ALREADY_COMMITTED` | 200 | повтор commit (возвращается исходный ответ) |
| `LOY_ORDER_NOT_FOUND` | 404 | reverse по неизвестному заказу |
| `LOY_REFUND_EXCEEDS` | 400 | сумма возврата больше оплаченной |
| `LOY_STAFF_EXCLUDED` | 200 | информационно в `explain` |

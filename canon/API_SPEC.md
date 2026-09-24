# LOVII — Спецификация API
## API Specification

<!-- fact-guard: allow — API_SPEC содержит эндпоинты с числовыми параметрами (лимиты, пороги); канон: PARAMS.md, BRD.md §7 -->

**Версия:** 1.1  
**Дата:** 2026-08-25  
**Base URL:** `https://api.lovii.ru/api/v1`

---

## 1. Sequence-диаграмма: Регистрация пользователя

```mermaid
sequenceDiagram
    participant U as User
    participant API as LOVII API
    participant DB as Database
    participant TG as T-Bank
    
    U->>API: POST /auth/register {phone, inviter_code?}
    API->>API: validate inviter_code (если есть)
    API->>DB: Проверить существование inviter
    DB-->>API: inviter found / not found
    
    alt inviter_code валиден
        API->>API: prefix = inviter_code[:2]
    else inviter_code отсутствует
        API->>API: prefix = "AA"
    end
    
    API->>API: generate unique suffix (max 10 attempts)
    
    alt коллизия
        API->>API: переключиться на доп. префикс
    end
    
    API->>DB: CREATE User + PromoCode + UdidAccount
    DB-->>API: ok
    API-->>U: 201 {udid, promo_code, prefix}
    
    U->>API: POST /subscription/activate {udid, period_months, method}
    API->>API: check balance / redirect to TG
    API->>TG: payment request
    TG-->>API: payment confirmed
    API->>DB: CREATE Subscription (status=active)
    API-->>U: 200 {subscription_id, expires_at}
```

---

## 2. Sequence-диаграмма: Транзакция с кэшбэком

```mermaid
sequenceDiagram
    participant C as Client
    participant M as MSP App
    participant API as LOVII API
    participant TG as T-Bank Transit
    participant DB as Database
    
    C->>M: Заказ 1000₽ (самовывоз)
    M->>API: POST /transactions {msp_id, amount, client_udid, payment_method}
    API->>API: рассчитать pool (10% - bank_rate)
    API->>TG: split payment
    TG-->>API: split completed
    API->>DB: CREATE Transaction
    
    Note over API,M: Кэшбэк 15% (настроен в конструкторе)
    API->>API: cashback = 150₽, fee = 37.5₽
    API->>DB: CREATE Cashback
    
    API->>DB: распределить pool (40/40/20)
    API->>DB: распределить cashback_fee (40/40/20)
    API->>DB: UPDATE UdidAccount (rep +42.57, amb +21.28)
    
    API->>M: 200 {order_id, transaction_id}
    M-->>C: Заказ оформлен, кэшбэк 150₽
```

---

## 3. Эндпоинты

### 3.1. POST /auth/register

**Описание:** Регистрация нового пользователя.

**Request:**
```json
{
  "phone": "+79991234567",
  "email": "user@example.com",
  "full_name": "Иванов Иван",
  "inviter_code": "BJ3M9K"
}
```

**Response 201:**
```json
{
  "udid": "usr_abc123def456",
  "promo_code": "BJ7K2P",
  "prefix": "BJ",
  "invited_by": "BJ3M9K"
}
```

**Errors:**
- `400` — невалидный phone
- `404 PROMO_NOT_FOUND` — inviter_code не существует
- `409 PROMO_RESERVED` — попытка использовать AAAAAA

---

### 3.2. POST /promo/change

**Описание:** Смена промокода (не чаще 1 раза в 30 дней).

**Request:**
```json
{
  "udid": "usr_abc123def456"
}
```

**Response 200:**
```json
{
  "old_promo": "BJ3M9K",
  "new_promo": "BJ9P7L",
  "next_change_available_at": "2026-09-25T10:00:00Z"
}
```

**Errors:**
- `429 PROMO_CHANGE_TOO_EARLY` — последняя смена была < 30 дней назад

---

### 3.3. POST /subscription/activate

**Описание:** Активация подписки.

**Request:**
```json
{
  "udid": "usr_abc123def456",
  "period_months": 12,
  "payment_method": "mixed",
  "udid_balance_amount": 1000,
  "card_amount": 2000
}
```

**Response 200:**
```json
{
  "subscription_id": "sub_xyz789",
  "started_at": "2026-08-25T10:00:00Z",
  "expires_at": "2027-08-25T10:00:00Z",
  "status": "active"
}
```

---

### 3.4. POST /transactions

**Описание:** Создание транзакции (заказа).

**Request:**
```json
{
  "msp_id": "msp_123",
  "client_udid": "usr_buyer456",
  "amount": 1000,
  "payment_method": "card"
}
```

**Примечание:** `promo_code` в запросе не передаётся. Сервер сам определяет `rep_udid`/`ambassador_prefix` по регистрационному промокоду МСП через `msp_id` (см. BRD.md, раздел 7.2 и `resolve_distribution_parties()` — логика распределения пула 40/40/20).

**НДС (с 01.01.2026, ФЗ №425-ФЗ, договор Т-Банк №МР-08.26/АКС_01):** комиссия банка по картам облагается НДС 22% сверху — эффективная ставка `2.59% + 22% = 3.16%` (на чек 1000₽: bank_effective = 3.16%, bank ₽ = 31.60). T-Pay и СБП — **без НДС (VAT-free)**: T-Pay `2.59%` (bank ₽ = 25.90), СБП `0.7%` (bank ₽ = 7.00). Пул = `10% − эффективная ставка банка` (карта: 6.84% → 68.40₽; T-Pay: 7.41% → 74.10₽; СБП: 9.3% → 93.00₽). Распределение пула 40/40/20.

**Response 200:**
```json
{
  "transaction_id": "txn_abc",
  "pool_amount": 68.40,
  "distribution": {
    "company": 27.36,
    "representative": 27.36,
    "ambassador": 13.68
  }
}
```

---

### 3.5. POST /cashback/accrue

**Описание:** Начисление кэшбэка (внутренний вызов из конструктора лояльности).

**Request:**
```json
{
  "transaction_id": "txn_abc",
  "client_udid": "usr_buyer456",
  "cashback_percent": 15
}
```

**Response 200:**
```json
{
  "cashback_id": "cb_xyz",
  "client_received": 150.00,
  "platform_fee": 37.50,
  "distribution": {
    "company": 15.00,
    "representative": 15.00,
    "ambassador": 7.50
  }
}
```

---

### 3.6. GET /status/{udid}

**Описание:** Получить текущий статус представителя.

**Response 200:**
```json
{
  "udid": "usr_abc",
  "status": "Мэр",
  "msp_count": 42,
  "cities_count": 1,
  "network_gmv_30d": 1850000,
  "assigned_at": "2026-07-15T03:00:00Z"
}
```

---

### 3.7. POST /account/transfer

**Описание:** Перевод между UDID-счетами.

**Request:**
```json
{
  "from_udid": "usr_sender",
  "to_udid": "usr_receiver",
  "amount": 500
}
```

**Response 200:**
```json
{
  "transfer_id": "tr_xyz",
  "from_balance_after": 1500.00,
  "to_balance_after": 2500.00
}
```

**Errors:**
- `404 UDID_NOT_FOUND` — получатель не существует
- `402 BALANCE_TOO_LOW` — недостаточно средств

---

### 3.8. POST /account/withdraw

**Описание:** Вывод средств с UDID-счёта через СБП. **Вывод доступен только при активной подписке** (иначе баланс — только для оплаты товаров/тарифа внутри платформы). Доступен только для `pull`-канала (Представитель, Амбассадор, МСП-Самозанятый) — см. BRD.md, раздел 8.4. Для МСП со статусом ИП/ООО выплата идёт автоматически по `push`-каналу, этот эндпоинт для них недоступен.

**Request:**
```json
{
  "udid": "usr_abc",
  "amount": 10000,
  "sbp_phone": "+79991234567"
}
```

**Response 200:**
```json
{
  "withdrawal_id": "wd_xyz",
  "amount": 10000,
  "bank_commission": 100.00,
  "commission_paid_by": "company",
  "balance_after": 2500.00
}
```

**Errors:**
- `402 BALANCE_TOO_LOW` — недостаточно средств на балансе (минимум 1 ₽)
- `400 PUSH_CHANNEL_ONLY` — попытка вызвать этот эндпоинт для МСП со статусом ИП/ООО (у них push, а не pull)

> **Комиссия за вывод** — см. `PARAMS.md` §1.6 (канон): самозанятый ≤ 3 000 ₽ — 30 ₽
> (удерживается из суммы); ≥ 3 000 ₽ — 1% (min 100 ₽), платит Компания.

---

### 3.9. POST /events/register

**Описание:** Регистрация на событие (Школа / Академия / Каникулы).

**Request:**
```json
{
  "udid": "usr_abc",
  "event_type": "Школа",
  "role": "mentor"
}
```

**Errors:**
- `403 SUBSCRIPTION_INACTIVE` — подписка истекла
- `403 STATUS_INSUFFICIENT` — статус не позволяет участвовать

---

### 3.10. POST /ambassador/create

**Описание:** Создание нового Амбассадора (только для Основателя).

**Request:**
```json
{
  "phone": "+79991234567",
  "full_name": "Петров Пётр",
  "assigned_prefix": "BJ"
}
```

**Response 201:**
```json
{
  "udid": "usr_ambassador",
  "promo_code": "BJ7K2P",
  "prefix": "BJ"
}
```

---

### 3.11. GET /admin/promos/collisions

**Описание:** Получить список коллизий (только для админа).

**Response 200:**
```json
{
  "collisions": [
    {
      "prefix": "BJ",
      "attempted_suffix": "7K2P",
      "switched_to_prefix": "B1",
      "timestamp": "2026-08-25T10:00:00Z"
    }
  ]
}
```

---

### 3.12. POST /promo/validate

**Описание:** Валидация промокода (для UI).

**Request:**
```json
{
  "code": "BJ3M9K"
}
```

**Response 200:**
```json
{
  "valid": true,
  "prefix": "BJ",
  "owner_udid": "usr_xyz"
}
```

---
---

## 3.13. Лояльность: промо-механики (SZ-073)

**Источник:** карточка `canon/TASKS/SZ-073-loyalty-service-backend.md`, решения владельца —
`canon/BRD.md` §7.3/§7.3.1. Реализация: `lovii-core` (домен `App\Domain\Loyalty\*`, контроллеры
`app/Http/Controllers/Api/V1/Loyalty/*`). Кабинеты (app/b2b) ходят только сюда — к таблицам
`promo_rules` напрямую не обращаются. Деньги — копейки.

Правило механики (`promo_rules`): `type` ∈ `cashback|threshold|combo|stamps|hours`; скоуп
`merchant_id` (NULL = платформенное), `branch_id`, `group_id`; параметры в jsonb
`trigger`/`reward`/`limits`/`storefront`; `priority`, `spent_amount`. Дни недели — 0 = пн … 6 = вс.

### 3.13.1. GET /api/v1/loyalty/rules

**Описание:** правила акций в контексте точки (для конструктора). Отдаются правила точки и
платформенные (`is_platform = true` — видны, не правятся).
**Auth:** Bearer. **Query:** `branch_id` (опц.).

**Response 200:**
```json
{
  "data": [
    {
      "id": 12, "type": "cashback", "type_label": "Кэшбэк", "name": "Кэшбэк по умолчанию",
      "merchant_id": 5, "branch_id": null, "group_id": 3, "is_platform": false,
      "trigger": {}, "reward": {"kind": "cashback_percent", "value": 5, "scope": "order"},
      "limits": {"max_spend_percent": 20},
      "storefront": {"publish": true, "title": "Кэшбэк 5%"},
      "priority": 0, "is_active": true, "starts_at": null, "ends_at": null,
      "spent_amount": 0, "budget": null, "budget_remaining": null, "is_budget_stopped": false,
      "cashback_percent": 5, "max_spend_percent": 20, "group": {"id": 3, "name": "Напитки"},
      "created_at": "…", "updated_at": "…"
    }
  ],
  "branch_id": 7, "merchant_id": 5
}
```

### 3.13.2. POST /api/v1/loyalty/rules

**Описание:** создание правила. `branch_id` необязателен (без него — на весь бренд).
**Auth:** Bearer (+ право роли; дефолт `merchant.update_profile`).

**Request:**
```json
{
  "type": "threshold", "name": "Подарок к чеку",
  "branch_id": 7, "priority": 0, "is_active": true, "starts_at": null, "ends_at": null,
  "trigger": {"kind": "cart_sum", "min_sum": 200000},
  "reward": {"kind": "gift", "gift_offer_id": 101, "gift_qty": 1},
  "limits": {"budget": 5000000, "autostop": true, "per_customer": 1},
  "storefront": {"publish": true, "title": "Подарок к чеку", "subtitle": "от 2 000 ₽"}
}
```
**Response 201:** `{ "data": { …правило… } }`.

### 3.13.3. PATCH /api/v1/loyalty/rules/{rule} · DELETE /api/v1/loyalty/rules/{rule}

**Описание:** правка (PATCH не обязан слать весь объект; jsonb-блоки сливаются; **тип механики
неизменяем** — 422 `promo_rule_type_immutable`) и снятие правила. Снятие пропадает с витрины
сразу (кэш инвалидируется). **Response:** 200.

### 3.13.4. GET/POST /api/v1/loyalty/groups · PATCH/DELETE /api/v1/loyalty/groups/{group}

**Описание:** группы товаров (имя, активность, состав `category_ids`/`product_ids`). Удаление
группы, на которую ссылается правило — 422 `loyalty_group_in_use`. **Response:** 200/201.

### 3.13.5. GET /api/v1/loyalty/promos

**Описание:** лента активных акций — ротация на главной и блок акций точки на витрине.
Публичный (без авторизации, как витрина). Показывается только то, что точка пометила
`storefront.publish`. Ротация детерминирована по текущему часу (стабильна в пределах часа).
**Query:** `merchant_id`, `branch_id`, `limit` (1…50, дефолт 12).

**Response 200:**
```json
{
  "data": [
    {
      "rule_id": 12, "type": "combo", "type_label": "Комбо", "merchant_id": 5, "branch_id": 7,
      "title": "Комбо со скидкой", "subtitle": "Кофе + Круассан · −15%", "badge": "Комбо",
      "deadline_text": "сейчас", "cashback_percent": null, "discount_percent": 15,
      "min_sum": null, "valid_until": null
    }
  ]
}
```

### 3.13.6. POST /api/v1/loyalty/preview

**Описание:** расчёт выгоды по чеку для корзины/чекаута — тем же движком, что применяет заказ
(покупатель видит ровно то, что будет зафиксировано). Гостю доступно без клиентского контекста
(лимит «раз на клиента» — только авторизованному). `bonus_to_spend` на расчёт промо не влияет.
**Auth:** опционально.

**Request:**
```json
{ "branch_id": 7, "items": [{"merchant_offer_id": 101, "qty": 2}], "bonus_to_spend": 0 }
```
**Response 200:** `{ "data": { "lines": [...], "gifts": [...], "stamps": null, "subtotal": 0,
"discount_total": 0, "payable_total": 0, "cashback_total": 0, "order_cashback_percent": 0,
"applied_rule_ids": [], "rule_costs": {}, "badges": [] } }` (суммы — копейки; **база кэшбэка =
`payable_total`**).

### 3.13.7. GET /api/v1/loyalty/effect (Ф2)

**Описание:** эффект акции — только честно измеримые величины (заказы с промо, скидка, кэшбэк,
подарки); `null` там, где данных нет (uplift оборота). **Auth:** Bearer. **Query:** `branch_id`,
`rule_id`, `from`, `to`.

### 3.13.8. POST /api/internal/v1/loyalty/apply

**Описание:** применение промо к заказу (service-to-service): расчёт выгоды, запись блока `promo`
в `orders.pricing_snapshot`, расход бюджета правил и счётчика «раз на клиента», событие
`PromoApplied` в очередь. **Идемпотентно по заказу.** Заголовок `X-Internal-Secret`.

**Request:** `{ "order_id": 42 }` → **Response 200:**
`{ "applied": true, "order_id": 42, "promo": { … } }` (повтор — `applied: false`).
### 3.13.9. GET /api/v1/loyalty/catalog

**Описание:** каталог для конструктива групп — категории и товары точки
(состав группы хранится каталожными id: `catalog_category_id`/`catalog_product_id`).
Платформенные категории (`merchant_id = NULL`) включены; товары — только точки.
**Auth:** Bearer (+ право роли; дефолт `merchant.update_profile`). **Query:** `branch_id`.

**Response 200:**
```json
{ "data": { "categories": [{"id": 1, "name": "Витамины"}], "products": [{"id": 10, "title": "Магний"}] },
  "branch_id": 7, "merchant_id": 5 }
```

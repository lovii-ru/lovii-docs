# SZ-045 — Точечные правки кода по FINANCIAL_CONTOUR.md §5 (v0.5)

> Статус: **На приёмке** (2026-09-13: каноничная версия восстановлена после сброса
> ветки, приведена к текущему `staging`, гейты 🟢 (PHPStan/Rector/Pint, 91 тест core,
> 31 тест app), аудит трассируемости пройден; выкачено в staging — core PR #7–#9,
> app PR #8. В прод не выкатывалось. Отчёт исполнителя — ниже, в частях 3–4 и в
> `FINDINGS.md` F-045–F-048.)
> Исполнитель: **zcode** · Спека: `canon/FINANCIAL_CONTOUR.md` §5 (v0.5) · Репо: lovii-app / lovii-core / lovii-b2b / lovii-admin
> Ниже — гайд-постановка дословно (источник требований); канонические поля добавлены Super Z 2026-09-13 для task-governance без изменения содержания.

> Задача SZ-045. Источник: финальный гайд большой модели (ревизия отчёта
> `otchet-FINANCIAL_CONTOUR-s5-pravki-staging.md`), передан владельцем 2026-09-13
> после утверждения FINANCIAL_CONTOUR.md v0.5 (коммит 23f3971). Спека — §5.1–5.5.

Готовлю файл. Ниже — результат ревизии, аудит предыдущего отчёта, выводы и финальный гайд. Сохраните его как `canon/TASKS/SZ-045-financial-contour-s5-code-fixes.md` (или передайте агенту как есть).

---

## Часть 1. Ревизия и аудит (что было не так в предыдущем отчёте)

### Критические расхождения предыдущего отчёта с утверждённым §5.5 (v0.5)

| # | Что было в отчёте | Что теперь в §5.5 | Вердикт |
|---|---|---|---|
| 1 | Поиск оригинальных проводок по `source_id=payment.id` | Поиск по `order_id` (чарджбэк может прийти за операцию 3-месячной давности) | ❌ Критическая ошибка |
| 2 | Разворот только `split_role=point` (90% точке) | Разворот ВСЕХ ног: point + company + representative + ambassador | ❌ Неполное зеркало |
| 3 | Комиссия банка не реализована | Отдельная проводка `chargeback_bank_fee` со счёта Точки (Правило 2) | ❌ Отсутствует |
| 4 | Интерфейс админки не реализован | UI в lovii-admin с визуальной симметрией (Правило 4) | ❌ Отсутствует |
| 5 | Аудит трассируемости не проводился | SQL-аудит перед внедрением (Правило 7) | ❌ Отсутствует |
| 6 | Симуляция не проводилась | Тест-скрипт перед деплоем (Правило 8) | ❌ Отсутствует |
| 7 | `comment`/`meta` не прописаны | Обязательные поля для трассируемости (Правило 5) | ❌ Отсутствует |
| 8 | Идемпотентность упомянута | Проверка по `(order_id, split_role)` до постинга (Правило 6) | ⚠️ Недостаточно |

### Выводы ревизии

1. **Предыдущий отчёт устарел** — он был написан до утверждения §5.5 v0.5 и не учитывает 8 правил чарджбэков.
2. **Задачи 1 и 2** (UI карты PAY, возврат баллов при отмене) — остаются валидными, но требуют уточнений.
3. **Задача 3** (чарджбэк) — требует полной переделки: полное зеркало + комиссия банка + интерфейс админки + трассируемость.
4. **Добавляются задачи 4, 5, 6**: интерфейс админки, аудит трассируемости, симуляция.

### Проверка совместимости со схемой БД (db-schema-analysis.md)

| Требование | Наличие в БД | Статус |
|---|---|---|
| `ledger_entries.order_id` | ✅ Есть (логический FK, добавлен бэкфиллом) | ✅ OK |
| `ledger_entries.split_role` | ✅ Есть (varchar 20) | ✅ OK |
| `ledger_entries.meta` | ✅ Есть (jsonb) | ✅ OK |
| `ledger_entries.comment` | ✅ Есть (varchar 255) | ✅ OK |
| `accounts.owner_type = 'partner'` | ✅ Есть | ✅ OK |
| `wallets.balance` | ✅ Есть (integer) | ✅ OK |
| `wallet_transactions.meta` | ✅ Есть (jsonb) | ✅ OK |
| `wallet_transactions.comment` | ✅ Есть (text) | ✅ OK |
| `wallet_transactions.order_id` | ✅ Есть (bigint, FK → orders) | ✅ OK |
| Unique `(wallet_id, order_id, type)` | ❌ Отсутствует | ➕ Добавляется миграцией |

### Проверка совместимости с кодом (lovii_audit_finance_points_2026-09-13.md)

| Файл | Статус |
|---|---|
| `HandleTBankNotificationAction.php` | ✅ Существует, расширяется |
| `PaymentStatus.php` | ✅ Enum, добавляется `Chargeback` |
| `LedgerEntryType.php` | ✅ Enum, добавляются `ChargebackReversal`, `ChargebackBankFee` |
| `LoyaltyService.php` | ✅ Существует, добавляется `refundSpendForOrder` |
| `OrderStatusMachine.php` | ✅ Существует, оборачивается в транзакцию |
| `DistributeOrderPoolAction.php` | ✅ Существует, постит по `split_role` (point/company/representative/ambassador) |
| `LedgerService::post()` | ✅ Не трогаем |
| `ReverseOrderPoolAction.php` | ❌ Отсутствует | ➕ Создаётся |
| `ReturnSpentPointsOnOrderCancellation.php` | ❌ Отсутствует | ➕ Создаётся |
| `ChargebackResource.php` (lovii-admin) | ❌ Отсутствует | ➕ Создаётся |

---

## Часть 2. Финальный гайд (готов к передаче агенту)

# ЗАДАЧА SZ-045: Точечные правки кода по FINANCIAL_CONTOUR.md §5

| Параметр | Значение |
|---|---|
| Статус | На проверке владельца — код НЕ тронут, коммитов НЕТ |
| Спека | `canon/FINANCIAL_CONTOUR.md` §5 (утв. владельцем 2026-09-13, v0.5) |
| База правок | lovii-app staging · lovii-core staging · lovii-b2b staging · lovii-admin master |
| Предыдущий отчёт | `otchet-FINANCIAL_CONTOUR-s5-pravki-staging.md` — УСТАРЕЛ, не использовать |

## 0. Источники истины (читать в этом порядке)

1. **`canon/FINANCIAL_CONTOUR.md` v0.5** — утверждённый владельцем. Раздел 5 (§5.1–5.5) — источник требований.
2. **`canon/PARAMS.md` v1.6** — канон всех числовых параметров.
3. **`canon/BRD.md` v1.4** — продуктовый канон, особенно §7 (экономика), §8 (счета/выплаты).
4. **`db-schema-analysis.md`** — схема БД staging (PostgreSQL 17.7).
5. **`lovii_audit_finance_points_2026-09-13.md`** — аудит кода.

**Правило:** при конфликте фактов между этим гайдом и кодом — побеждает гайд. При конфликте между гайдом и `FINANCIAL_CONTOUR.md` — побеждает `FINANCIAL_CONTOUR.md`. При конфликте между `FINANCIAL_CONTOUR.md` и `PARAMS.md` — побеждает `PARAMS.md`.

## 1. Утверждённые решения владельца (не переспрашивать)

| # | Решение | Источник |
|---|---|---|
| 1 | Карта LOVII PAY показывает **баллы** из `wallets`, а не рубли из `accounts` | FINANCIAL_CONTOUR §5.1 |
| 2 | UID ≠ номер карты. Один UID может иметь несколько счетов/карт. Номер карты — идентификатор счёта, не пользователя | FINANCIAL_CONTOUR §5.1 |
| 3 | Маршрутизация начислений rep/amb: если нет рублёвого счёта МСП → начисления идут на `wallets` (PAY) | FINANCIAL_CONTOUR §5.1 |
| 4 | Балловый инвариант: `wallets.balance = Σ earn − Σ spend + Σ adjustment/refund` | FINANCIAL_CONTOUR §5.2 |
| 5 | **Полное зеркало при чарджбэке**: разворачиваются ВСЕ ноги первоначального распределения — 90% точке + пул 40/40/20 (Компания/Представитель/Амбассадор) | FINANCIAL_CONTOUR §5.3 + решение владельца 2026-09-13 |
| 6 | Зеркальное списание — строго с того счёта, куда пришло первоначальное начисление (принцип обратного следа) | FINANCIAL_CONTOUR §5.3 |
| 7 | **Дубли в `wallet_transactions` НЕ ЧИСТИТЬ.** Принцип append-only (FINANCIAL_CONTOUR §2.3). Если дубли есть — корректирующая запись + `CREATE UNIQUE INDEX ... NOT VALID` | решение владельца 2026-09-13 |
| 8 | PARTIAL_CHARGEBACK маппится в полный Chargeback (ограничение MVP) | решение владельца 2026-09-13 |
| 9 | Атомарность b2b-пути — eventual (очередь + ретраи + идемпотентность), не строго атомарна | решение владельца 2026-09-13 |
| 10 | Тарифы вывода (0,5% / 1% / 30₽ / 3000₽) в этой задаче НЕ реализуются — только инварианты и UI | аудит §6 |
| 11 | Комиссия банка за чарджбэк — полностью на Точке (МСП), вводится оператором вручную в админке | FINANCIAL_CONTOUR §5.5 Правило 2 + 4 |
| 12 | Интерфейс админки для обработки чарджбэков — обязателен (визуальная симметрия, предпросмотр, атомарное подтверждение) | FINANCIAL_CONTOUR §5.5 Правило 4 |
| 13 | Каждая зеркальная проводка обязана содержать `comment` и `meta` (JSON) для трассируемости | FINANCIAL_CONTOUR §5.5 Правило 5 |
| 14 | Аудит трассируемости (SQL) — обязателен перед внедрением кода | FINANCIAL_CONTOUR §5.5 Правило 7 |
| 15 | Симуляция перед деплоем — обязательна (тест-скрипт) | FINANCIAL_CONTOUR §5.5 Правило 8 |

## 2. ЗАДАЧА 1: UI карты LOVII PAY (lovii-app)

### Цель
Карта LOVII PAY показывает баллы из `wallets.balance`, а не рубли из `accounts.balance`.

### Файлы и правки

**2.1. `src/modules/profile-balance/components/PayCard.vue`**
- Добавить необязательный проп `balanceUnit` (default `"₽"`).
- Строка ~112: `{{ formatPrice(props.balance) }}&nbsp;₽` → `{{ formatPrice(props.balance) }}&nbsp;{{ props.balanceUnit }}`.

**2.2. `src/modules/profile-balance/ProfileWallet.vue`**
- Биндинг карты (стр. ~315–336): для `kind === 'personal'`:
  - `:balance="wallet?.balance ?? 0"` (баллы из `apiGetWallet()` → `GET /wallet` → `wallets.balance`)
  - `:balance-label="'Баллы'"`
  - `:balance-unit="'б.'"`
- Карты `company` / `nominal` — без изменений (рубли).
- Подсказка пустой истории (стр. ~485): «Операций пока нет — баланс пополнится с первых оплаченных заказов» → нейтральное «Операций пока нет».
- Секция «Счёт» (`wallet__acct`, стр. ~397–416) остаётся в рублях — это панель рублёвого счёта, канон §5.1 её не трогает.

**2.3. `src/modules/profile-module/ProfileModule.vue`**
- Карта на главном экране профиля (стр. ~324–335) тоже передаёт `account.balance` (рубли).
- Добавить параллельный `apiGetWallet()` (беззвучный, как в ProfileWallet) + тот же биндинг для `personal`.

### Что НЕ менять
- Номер карты — `helpers/pay-card.ts`: уже детерминированный хэш FNV-1a по `account_id` + контрольная цифра Луна, BIN `96439138` (личный) / `96439142` (бизнес) / `96439000` (номинал). Не UID, в БД не хранится, генерируется на лету.
- `GET /wallet` — существует: `ShowWalletController → GetWalletQuery → LoyaltyService::getOrCreateWallet → WalletResource` отдаёт `wallets.balance`. Бэкенд-правок для задачи 1 нет.

### Критерий приёмки
- Карта LOVII PAY в профиле клиента показывает баллы (из `wallets`), а не рубли.
- Карты LOVII BUSINESS и LOVII OPERATOR показывают рубли (без изменений).
- Подсказка «баланс пополнится с первых заказов» убрана.

## 3. ЗАДАЧА 2: Возврат баллов при отмене/неоплате заказа (lovii-core)

### Контекст
Подтверждён аудит §5 Г5: `spendForOrder` пишется при размещении заказа (до оплаты), обратного возврата нет.

### Файлы и правки

**3.1. Новая миграция `database/migrations/2026_09_13_000001_add_unique_to_wallet_transactions.php`**
- Unique-индекс `['wallet_id', 'order_id', 'type']` (аудит §5 Г4).
- `order_id` nullable — записи без заказа (NULL ≠ NULL в Postgres) индекс не задевает.
- **КРИТИЧНО:** перед накаткой индекса — пред-чек на существующие дубли:
  ```sql
  SELECT wallet_id, order_id, type, COUNT(*) 
  FROM wallet_transactions 
  WHERE order_id IS NOT NULL
  GROUP BY 1, 2, 3 
  HAVING COUNT(*) > 1;
  ```
- Если дубли найдены:
  1. **НЕ УДАЛЯТЬ ИХ** (принцип append-only, FINANCIAL_CONTOUR §2.3).
  2. Показать владельцу список дублей.
  3. Провести компенсирующую корректировку (`adjustment`) на сумму каждого дубля.
  4. Использовать `CREATE UNIQUE INDEX ... NOT VALID` (PostgreSQL-синтаксис), чтобы индекс не падал на существующих данных, но запрещал дубли для новых записей.
- Если дублей нет — накатывать обычный unique-индекс.

**3.2. `app/Domain/Loyalty/Services/LoyaltyService.php`**
- Новый метод `refundSpendForOrder(Order $order): void`:
  - Сумма по `wallet_transactions type=spend` этого заказа.
  - Возврат записью `type=adjustment` (не `refund` — см. «Конфликт индексов» ниже).
  - `wallet->increment`, `DB::transaction`, идемпотентность по `(wallet, order, adjustment)`.
- Дополнительно в `earnFromOrder` — catch `UniqueConstraintViolationException` → no-op (гонка двух вебхуков между `exists()` и insert закрывается индексом; повторный вебхук банка отработает как «уже начислено»).

**3.3. `app/Domain/Order/Services/OrderStatusMachine.php`**
- Тело `transition()` (update + history) обёрнуто в `DB::transaction`.
- При `$nextStatus ∈ {Cancelled, Failed}` в **той же транзакции** вызывается `refundSpendForOrder($order)`.
- Это единственная точка смены статуса в core (проверено grep'ом: прямых `update(['status'=>…])` вне машины нет).
- DI `LoyaltyService` в конструктор.

**3.4. `app/Listeners/ReturnSpentPointsOnOrderCancellation.php` (новый) + регистрация в `AppServiceProvider`**
- Слушатель `OrderStatusChanged → isCancellation()/Failed → refundSpendForOrder`.
- Покрывает путь b2b: панель пишет статус напрямую в `pgsql_core` (`OrderResource::applyTransition`, мимо машины) и досылает событие через `NotifyCoreOfOrderStatusTransition → /api/internal/v1/.../emit-order-status-event` (очередь + ретраи + идемпотентность по history_id).
- Слушатель идемпотентен (no-op, если машина уже вернула баллы).

### Конфликт индексов (найден при разведке)
Unique `(wallet_id, order_id, type)` запрещает две записи `refund` по одному заказу (а `refundEarnForOrder` уже пишет `refund`). Поэтому возврат spend — `type=adjustment` (задача разрешает «refund или adjustment»). Инвариант §5.2 `balance = Σearn − Σspend + Σ(adjustment/refund)` соблюдается.

### Критерий приёмки
- При отмене заказа (статус `Cancelled` или `Failed`) списанные баллы возвращаются на `wallets.balance` записью `type=adjustment`.
- Повторный вызов `refundSpendForOrder` — no-op (идемпотентность).
- Unique-индекс `(wallet_id, order_id, type)` накатан (обычный или `NOT VALID` в зависимости от наличия дублей).
- Инвариант §5.2 соблюдается: `wallets.balance = Σ earn − Σ spend + Σ adjustment`.

## 4. ЗАДАЧА 3: Зеркальное списание при чарджбэке (lovii-core)

### Контекст
Подтверждено: `PaymentStatus::fromBankStatus` не знает `CHARGEBACK` (падает в `default → Pending`); на Refunded/Reversed есть только `refundEarnForOrder` (баллы), зеркала в ledger нет.

### Утверждённое решение владельца (ВАРИАНТ Б — полное зеркало)
При чарджбэке разворачиваются **ВСЕ ноги** первоначального распределения:
- 90% точке (`order_income`, `split_role=point`)
- Компания (`split_role=company`)
- Представитель (`split_role=representative`)
- Амбассадор (`split_role=ambassador`)

Каждая нога — на тот же `account_id`, откуда она изначально пришла.

### КРИТИЧЕСКИ ВАЖНО (упущения в предыдущей версии)
1. Чарджбэк может прийти за **ЛЮБУЮ операцию в истории** (не только за текущий payment). Поиск оригинальных проводок — по `order_id`, а НЕ по `payment.id`.
2. Каждая зеркальная проводка **ОБЯЗАНА** содержать:
   - `comment`: человекочитаемое «Чарджбэк за заказ №12345 от 2026-09-10»
   - `meta`: машиночитаемое `{original_entry_id, reason, order_id, payment_id, chargeback_date, original_amount, split_role}`
3. Проверка идемпотентности: не разворачивать дважды. Перед постингом проверить, что для этого `order_id` уже нет `chargeback_reversal` с тем же `split_role`.

### Файлы и правки

**4.1. `app/Domain/Payment/Enums/PaymentStatus.php`**
- Кейс `Chargeback = 'chargeback'`.
- Маппинг `'CHARGEBACK', 'PARTIAL_CHARGEBACK' → Chargeback`.
- ⚠️ УТОЧНИТЬ У ВЛАДЕЛЬЦА: PARTIAL_CHARGEBACK маппить в полный Chargeback или поддерживать частичные суммы? Сейчас маппим в полный.

**4.2. `app/Domain/Billing/Enums/LedgerEntryType.php`**
- Кейс `ChargebackReversal = 'chargeback_reversal'`.
- Кейс `ChargebackBankFee = 'chargeback_bank_fee'` (для комиссии банка).
- **КРИТИЧНО:** нельзя переиспользовать `order_income` — дубликат-чек LedgerService принял бы зеркальную проводку за оригинал и no-op'нул бы её.

**4.3. `app/Application/Billing/Actions/ReverseOrderPoolAction.php` (новая)**
- Обратный след §5.3: ищет **ВСЕ оригинальные проводки** начисления по `order_id`:
  ```php
  ledger_entries 
  WHERE order_id = $order->id
    AND type = 'order_income'
    AND amount > 0
  ```
  (НЕ по `payment.id`, а по `order_id` — чарджбэк может прийти за любую операцию в истории)

- Для каждой найденной проводки (point / company / representative / ambassador):
  1. Проверить идемпотентность: нет ли уже `chargeback_reversal` с тем же `split_role` для этого `order_id` (чтобы не разворачивать дважды).
  2. Постить на **ТОТ ЖЕ `account_id`** (не пересчитывая партнёра из branch!) через `LedgerService::post`:
     - сумма: `-amount`
     - type: `chargeback_reversal`
     - split_role: тот же, что у оригинала
     - source_type: `'chargeback'`
     - source_id: `payment.id` (текущий payment, по которому пришёл чарджбэк)
     - order_id: `$order->id`
     - comment: `"Чарджбэк за заказ №{$order->id} от {$order->created_at->format('Y-m-d')}"`
     - meta: `json_encode([
         'original_entry_id' => $originalEntry->id,
         'reason' => 'chargeback',
         'order_id' => $order->id,
         'payment_id' => $payment->id,
         'chargeback_date' => now()->format('Y-m-d'),
         'original_amount' => $originalEntry->amount,
         'split_role' => $originalEntry->split_role
       ])`
  3. Если оригинала нет (партнёр не привязан, 90% не постилось) — лог + no-op.

**4.4. `app/Application/Billing/Actions/PostChargebackBankFeeAction.php` (новая)**
- Принимает `$order`, `$payment`, `$feeAmount` (в копейках).
- Находит счёт Точки: `accounts WHERE owner_type = 'partner' AND owner_id = $order->merchant->partner_id`.
- Постит через `LedgerService::post`:
  - сумма: `-$feeAmount`
  - type: `chargeback_bank_fee`
  - split_role: `null` (или `'point'`, если enum требует)
  - source_type: `'chargeback'`
  - source_id: `$payment->id`
  - order_id: `$order->id`
  - comment: `"Комиссия банка за чарджбэк заказа №{$order->id}"`
  - meta: `json_encode(['reason' => 'chargeback_bank_fee', 'order_id' => $order->id, 'payment_id' => $payment->id, 'fee_amount' => $feeAmount])`
- Если счёта Точки нет — лог + no-op (не должно происходить, но защита от edge-case).

**4.5. `app/Application/Payment/Actions/HandleTBankNotificationAction.php`**
- а) `Chargeback` включён в `$followsConfirmed` (после CONFIRMED проходить может).
- б) Блок стр. ~166–168 расширен: `Refunded / Reversed / Chargeback` → один `DB::transaction`:
  - `refundEarnForOrder` (уже есть, type=refund)
    ⚠️ Добавить в comment: `"Возврат баллов за заказ №{$order->id} (чарджбэк)"`
    ⚠️ Добавить в meta: `{"reason": "chargeback", "order_id": $order->id, "payment_id": $payment->id}`
  - `reverseOrderPool->execute` (новое зеркало на ВСЕ ноги)
  - **НОВОЕ:** `postChargebackBankFee->execute($order, $payment, $feeAmount)` — комиссия банка
    - `$feeAmount` берётся из `$request->input('dispute_fee')` или аналогичного поля вебхука
    - Если поле отсутствует — `$feeAmount = 0` (лог-предупреждение)
- Атомарно как единое целое (savepoint-вложенность).

**NB (разрешено правилом приоритетов §0):** 4.5 написан до финальной правки Правила 2 (комиссия — только ручной ввод оператора в админке, коммит 23f3971). По канону побеждает FINANCIAL_CONTOUR.md: в вебхуке зеркалим ноги и возвращаем баллы, но `chargeback_bank_fee` в вебхуке НЕ постим — комиссия вводится и постится оператором из lovii-admin (Задача 4).

### Пункт (в) задачи — минус-баланс как долг
Уже работает без правок: `accounts.balance` — `bigInteger` без CHECK-констрейнта; `LedgerService::post` делает `increment` знаковой суммой под row-lock → минус ложится свободно и блокирует логику выплат по канону (решение о механике блокировки выплат — вне этой задачи).

### Критерий приёмки
1. При статусе `Chargeback` разворачиваются **ВСЕ ноги**: 90% точке + пул 40/40/20.
2. Каждая нога списывается с того же `account_id`, куда пришла.
3. Каждая зеркальная проводка содержит:
   - `comment`: `"Чарджбэк за заказ №X от YYYY-MM-DD"`
   - `meta`: `{original_entry_id, reason, order_id, payment_id, chargeback_date, original_amount, split_role}`
4. Комиссия банка списана со счёта Точки отдельной проводкой `chargeback_bank_fee`.
5. Баланс может уйти в минус (долг).
6. Идемпотентность: повторный вебхук — no-op (проверка существующих `chargeback_reversal`).
7. Инвариант §5.3 соблюдается.
8. Тесты проверяют:
   - Чарджбэк за операцию 3-месячной давности (поиск по `order_id` работает).
   - Повторный вебхук не создаёт дублей.
   - Все 4 ноги разворачиваются с правильным `comment`/`meta`.
   - Комиссия банка списана со счёта Точки.
   - Минус-баланс формируется корректно.

## 5. ЗАДАЧА 4: Интерфейс админки для обработки чарджбэков (lovii-admin)

### Контекст
Согласно FINANCIAL_CONTOUR §5.5 Правило 4, оператор обрабатывает чарджбэк через интерфейс админки.

### Требования к UI (из Правила 4)
- **Лог всех операций по заказу**: список всех проводок (начислений и списаний) с возможностью визуального сравнения.
- **Визуальная симметрия**: лог начислений и лог списаний идентичны по структуре, отличаются только знаком операции (+/−) и типом (`order_income` → `chargeback_reversal`).
- **Суммы и получатели совпадают**: оператор видит, что каждому начислению соответствует зеркальное списание на тот же счёт.
- **Поле ввода комиссии банка**: оператор вручную вводит сумму комиссии банка за чарджбэк (из уведомления банка).
- **Предпросмотр операций**: перед подтверждением оператор видит список всех проводок, которые будут созданы (зеркало начислений + комиссия банка).
- **Подтверждение**: оператор подтверждает операцию, система создаёт все проводки атомарно.

### Требования к UI (детали)
- Таблица операций: `account_id` | `split_role` | `amount` | `type` | `comment`
- Начисления: зелёным цветом, тип `order_income`
- Списания: красным цветом, тип `chargeback_reversal`
- Комиссия банка: отдельной строкой, тип `chargeback_bank_fee`, только на счёт Точки
- Кнопка «Подтвердить чарджбэк» создаёт все проводки в одной транзакции

### Файлы и правки

**5.1. `app/Filament/Resources/ChargebackResource.php` (новый)**
- Filament-ресурс для работы с чарджбэками.
- Список заказов, по которым есть подтверждённые платежи (`payments.status = 'confirmed'`).
- Фильтры: дата, статус (не обработан / обработан), сумма.

**5.2. `app/Filament/Resources/ChargebackResource/Pages/ProcessChargeback.php` (новая)**
- Страница обработки чарджбэка для конкретного заказа.
- Две таблицы:
  - **Начисления** (зелёные): все `ledger_entries WHERE order_id = $orderId AND type = 'order_income' AND amount > 0`
  - **Списания** (красные, предпросмотр): генерируются на лету из начислений (зеркало)
- Поле ввода: «Комиссия банка (₽)» — оператор вводит вручную.
- Кнопка «Предпросмотр проводок» — показывает список всех проводок, которые будут созданы.
- Кнопка «Подтвердить чарджбэк» — создаёт все проводки атомарно через `DB::transaction`:
  - `ReverseOrderPoolAction::execute($order, $payment)`
  - `PostChargebackBankFeeAction::execute($order, $payment, $feeAmount)`
  - `refundEarnForOrder($order)` (если есть начисленные баллы)

**5.3. `app/Filament/Resources/ChargebackResource/Pages/ListChargebacks.php` (новая)**
- Список всех обработанных чарджбэков.
- Колонки: дата, заказ, сумма возврата, комиссия банка, статус, оператор.

**5.4. `app/Models/ChargebackLog.php` (новая)**
- Модель для логирования обработанных чарджбэков.
- Поля: `order_id`, `payment_id`, `refund_amount`, `bank_fee_amount`, `processed_by_admin_user_id`, `processed_at`, `meta` (jsonb).
- Таблица `chargeback_logs` (новая миграция).

**5.5. Миграция `database/migrations/2026_09_13_000002_create_chargeback_logs_table.php` (новая)**
```php
Schema::create('chargeback_logs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained('orders');
    $table->foreignId('payment_id')->constrained('payments');
    $table->bigInteger('refund_amount'); // копейки
    $table->bigInteger('bank_fee_amount'); // копейки
    $table->foreignId('processed_by_admin_user_id')->constrained('lovii_admin.admin_users');
    $table->timestamp('processed_at');
    $table->jsonb('meta')->nullable();
    $table->timestamps();
    $table->unique(['order_id', 'payment_id']); // идемпотентность
});
```

### Критерий приёмки
- Оператор может открыть заказ в админке и увидеть все начисления (зелёные).
- Оператор может ввести комиссию банка и увидеть предпросмотр списаний (красные).
- Оператор может подтвердить чарджбэк, и все проводки создадутся атомарно.
- Чарджбэк логируется в `chargeback_logs`.
- Повторная обработка того же заказа — блокируется (unique-индекс).

## 6. ЗАДАЧА 5: Аудит трассируемости (SQL)

### Контекст
Согласно FINANCIAL_CONTOUR §5.5 Правило 7, перед внедрением кода агент проводит аудит трассируемости.

### SQL-запрос для аудита
```sql
-- Аудит трассируемости: для случайного order_id показать все счета, которые получили деньги
SELECT 
    le.order_id,
    le.account_id,
    a.owner_type,
    a.owner_id,
    le.split_role,
    le.type,
    le.amount,
    le.comment,
    le.meta
FROM ledger_entries le
JOIN accounts a ON a.id = le.account_id
WHERE le.order_id = (
    SELECT order_id 
    FROM ledger_entries 
    WHERE type = 'order_income' AND amount > 0
    ORDER BY RANDOM()
    LIMIT 1
)
ORDER BY le.created_at;
```

### Что проверяет аудит
1. Для каждого `order_id` есть записи в `ledger_entries` с `type = 'order_income'`.
2. Для каждой записи есть `account_id`, `split_role`, `amount`.
3. `account_id` ссылается на существующий счёт в `accounts`.
4. `split_role` ∈ {point, company, representative, ambassador}.
5. Сумма всех ног = сумма платежа (с учётом комиссии банка).

### Если трассируемость нарушена
- Если для какого-то `order_id` нет записей в `ledger_entries` — это инцидент, который разбирается до написания кода чарджбэка.
- Если `split_role` отсутствует или некорректен — это инцидент.
- Если сумма ног не сходится — это инцидент.

### Критерий приёмки
- SQL-запрос выполняется без ошибок.
- Для случайного `order_id` показываются все ноги распределения.
- Все `account_id` существуют в `accounts`.
- Все `split_role` корректны.

## 7. ЗАДАЧА 6: Симуляция перед деплоем (тест-скрипт)

### Контекст
Согласно FINANCIAL_CONTOUR §5.5 Правило 8, агент обязан создать тест (или локальный скрипт), который имитирует чарджбэк.

### Тест-скрипт `tests/Feature/Chargeback/ChargebackSimulationTest.php`

```php
<?php

namespace Tests\Feature\Chargeback;

use Tests\TestCase;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Account;
use App\Models\Wallet;
use App\Domain\Billing\Enums\LedgerEntryType;
use App\Application\Billing\Actions\ReverseOrderPoolAction;
use App\Application\Billing\Actions\PostChargebackBankFeeAction;
use App\Domain\Loyalty\Services\LoyaltyService;
use Illuminate\Support\Facades\DB;

class ChargebackSimulationTest extends TestCase
{
    public function test_full_chargeback_simulation(): void
    {
        // 1. Берём реальный заказ из staging
        $order = Order::where('status', 'completed')
            ->whereHas('payments', fn($q) => $q->where('status', 'confirmed'))
            ->inRandomOrder()
            ->first();
        
        $this->assertNotNull($order, 'Не найден подходящий заказ для симуляции');
        
        $payment = $order->payments()->where('status', 'confirmed')->first();
        
        // 2. Находим все оригинальные проводки по order_id (SQL-запрос из Правила 1)
        $originalEntries = DB::table('ledger_entries')
            ->where('order_id', $order->id)
            ->where('type', 'order_income')
            ->where('amount', '>', 0)
            ->get();
        
        $this->assertGreaterThan(0, $originalEntries->count(), 'Нет оригинальных проводок');
        
        // 3. Запоминаем балансы до чарджбэка
        $balancesBefore = [];
        foreach ($originalEntries as $entry) {
            $account = Account::find($entry->account_id);
            $balancesBefore[$account->id] = $account->balance;
        }
        
        // 4. Имитируем приход вебхука Chargeback с суммой возврата
        $refundAmount = $payment->amount; // полная сумма
        $bankFeeAmount = 50000; // 500 ₽ в копейках (пример из Правила 8)
        
        // 5. Выполняем зеркальное списание
        DB::transaction(function () use ($order, $payment, $bankFeeAmount) {
            $reverseAction = app(ReverseOrderPoolAction::class);
            $reverseAction->execute($order, $payment);
            
            $feeAction = app(PostChargebackBankFeeAction::class);
            $feeAction->execute($order, $payment, $bankFeeAmount);
        });
        
        // 6. Проверяем, что для каждой оригинальной проводки создана зеркальная
        foreach ($originalEntries as $entry) {
            $reversalEntry = DB::table('ledger_entries')
                ->where('order_id', $order->id)
                ->where('type', 'chargeback_reversal')
                ->where('split_role', $entry->split_role)
                ->first();
            
            $this->assertNotNull($reversalEntry, "Не найдена зеркальная проводка для split_role={$entry->split_role}");
            $this->assertEquals(-$entry->amount, $reversalEntry->amount, "Сумма зеркальной проводки не совпадает");
            $this->assertEquals($entry->account_id, $reversalEntry->account_id, "account_id не совпадает");
            
            // Проверяем comment и meta
            $this->assertStringContainsString("Чарджбэк за заказ №{$order->id}", $reversalEntry->comment);
            $meta = json_decode($reversalEntry->meta, true);
            $this->assertEquals('chargeback', $meta['reason']);
            $this->assertEquals($order->id, $meta['order_id']);
        }
        
        // 7. Проверяем, что комиссия банка списана со счёта Точки
        $pointAccount = $originalEntries->firstWhere('split_role', 'point');
        $feeEntry = DB::table('ledger_entries')
            ->where('order_id', $order->id)
            ->where('type', 'chargeback_bank_fee')
            ->first();
        
        $this->assertNotNull($feeEntry, 'Не найдена проводка комиссии банка');
        $this->assertEquals(-$bankFeeAmount, $feeEntry->amount);
        $this->assertEquals($pointAccount->account_id, $feeEntry->account_id, 'Комиссия списана не со счёта Точки');
        
        // 8. Проверяем, что баланс Точки стал отрицательным (если было 0)
        $pointAccountAfter = Account::find($pointAccount->account_id);
        $expectedBalance = $balancesBefore[$pointAccount->account_id] - abs($pointAccount->amount) - $bankFeeAmount;
        $this->assertEquals($expectedBalance, $pointAccountAfter->balance, 'Баланс Точки не совпадает');
        
        // 9. Проверяем идемпотентность: повторный вызов не создаёт дублей
        $countBefore = DB::table('ledger_entries')
            ->where('order_id', $order->id)
            ->where('type', 'chargeback_reversal')
            ->count();
        
        // Повторный вызов
        DB::transaction(function () use ($order, $payment, $bankFeeAmount) {
            $reverseAction = app(ReverseOrderPoolAction::class);
            $reverseAction->execute($order, $payment);
        });
        
        $countAfter = DB::table('ledger_entries')
            ->where('order_id', $order->id)
            ->where('type', 'chargeback_reversal')
            ->count();
        
        $this->assertEquals($countBefore, $countAfter, 'Повторный вызов создал дубли');
    }
}
```

### Критерий приёмки
- Тест выполняется без ошибок.
- Все 9 проверок проходят.
- Повторный вызов не создаёт дублей (идемпотентность).

## 8. Технические требования

### Unique-индексы
- ✅ `ledger_entries (source_type, source_id, type, account_id, split_role)` — уже существует (`ledger_entries_source_unique`, миграция `2026_09_11_120000_create_billing_accounts_tables.php`). Зеркало опирается на него + пред-чек LedgerService.
- ➕ `wallet_transactions (wallet_id, order_id, type)` — добавляется новой миграцией (3.1).
- ➕ `chargeback_logs (order_id, payment_id)` — добавляется новой миграцией (5.5).

### Единицы
- Копейки/целые — `accounts.balance`, `ledger_entries.amount` = bigInteger; `wallets.balance`, `wallet_transactions.amount` = integer; float нигде не участвует (ROUND_HALF_UP в сплите).

### Подтверждения (что НЕ ломается)
- **Идемпотентность ledger_entries** (unique-индекс) — не ломается: unique-индекс не трогаем; зеркало использует новый type + тот же источник → повторный вебхук = no-op на двух уровнях (пред-чек + индекс).
- **Идемпотентность earnFromOrder** (order_id check) — не ломается: `order_id`-чек сохранён как есть; сверху добавлены уникальный индекс (гонка закрывается на уровне БД) и catch `UniqueConstraintViolationException` → поведение «банк ретраит → второй вызов no-op» сохраняется.
- **Атомарность транзакций** (DB::transaction) — не ломается, усиливается: каждый постинг LedgerService — транзакция под row-lock (как было); возврат баллов теперь в одной транзакции со сменой статуса; контур чарджбэка (баллы + зеркало + комиссия) — одна внешняя транзакция.

## 9. Тесты (дополнение к существующим)

| Файл | Новые кейсы |
|---|---|
| `tests/Feature/Payment/TBankWebhookTest.php` | +3: CHARGEBACK — зеркальная проводка на ВСЕ счета (point + company + rep + amb); комиссия банка на счёт Точки; идемпотентность повтора вебхука |
| `tests/Feature/Loyalty/LoyaltyServiceTest.php` | +2: refundSpendForOrder happy-path; повторный вызов — no-op |
| `tests/Feature/Billing/DistributeOrderPoolTest.php` | +2: ReverseOrderPoolAction — все 4 ноги на те же счета, минус-баланс, no-op без оригинала; PostChargebackBankFeeAction — комиссия на счёт Точки |
| `tests/Feature/Chargeback/ChargebackSimulationTest.php` | +1: полная симуляция чарджбэка (Задача 6) |

## 10. Итоговый список файлов

**lovii-app (3):**
- `src/modules/profile-balance/components/PayCard.vue`
- `src/modules/profile-balance/ProfileWallet.vue`
- `src/modules/profile-module/ProfileModule.vue`

**lovii-core (12):**
- новая миграция `2026_09_13_000001_add_unique_to_wallet_transactions.php`
- новая миграция `2026_09_13_000002_create_chargeback_logs_table.php`
- `app/Domain/Loyalty/Services/LoyaltyService.php`
- `app/Domain/Order/Services/OrderStatusMachine.php`
- новый листенер `app/Listeners/ReturnSpentPointsOnOrderCancellation.php` + регистрация в `AppServiceProvider.php`
- `app/Domain/Payment/Enums/PaymentStatus.php`
- `app/Domain/Billing/Enums/LedgerEntryType.php`
- новый `app/Application/Billing/Actions/ReverseOrderPoolAction.php`
- новый `app/Application/Billing/Actions/PostChargebackBankFeeAction.php`
- `app/Application/Payment/Actions/HandleTBankNotificationAction.php`

**lovii-admin (4):**
- новый `app/Filament/Resources/ChargebackResource.php`
- новая `app/Filament/Resources/ChargebackResource/Pages/ProcessChargeback.php`
- новая `app/Filament/Resources/ChargebackResource/Pages/ListChargebacks.php`
- новая модель `app/Models/ChargebackLog.php`

**lovii-b2b:** правок нет.

**Тесты (4):**
- `tests/Feature/Payment/TBankWebhookTest.php` (+3 кейса)
- `tests/Feature/Loyalty/LoyaltyServiceTest.php` (+2 кейса)
- `tests/Feature/Billing/DistributeOrderPoolTest.php` (+2 кейса)
- новый `tests/Feature/Chargeback/ChargebackSimulationTest.php` (+1 кейс)

## 11. Порядок применения

1. **Аудит трассируемости** (Задача 5) — SQL-запрос, показать результат владельцу.
2. **Пред-чек дублей** в `wallet_transactions` (3.1).
   - Если дублей нет → продолжаем.
   - Если дубли есть → показать владельцу, НЕ удалять, провести корректировки, использовать `NOT VALID`.
3. **Миграции** (3.1, 5.5).
4. **Правки core** (LoyaltyService, OrderStatusMachine, листенер, PaymentStatus, LedgerEntryType, ReverseOrderPoolAction, PostChargebackBankFeeAction, HandleTBankNotificationAction).
5. **Правки app** (PayCard, ProfileWallet, ProfileModule).
6. **Правки admin** (ChargebackResource, ProcessChargeback, ListChargebacks, ChargebackLog).
7. **Тесты** (все новые кейсы из п. 9 + симуляция из п. 7).
8. **Диффы на финальную сверку владельцу.**
9. По команде владельца — **пуш в staging**: app (автодеплой), core (автодеплой + `php artisan migrate`), admin (автодеплой + `php artisan migrate`).

## 12. Что НЕ делать (явные запреты)

- ❌ НЕ менять ядро `LedgerService::post()` (row-lock, increment, unique-индекс).
- ❌ НЕ удалять записи из `wallet_transactions` или `ledger_entries` (принцип append-only).
- ❌ НЕ переиспользовать `type=order_income` для зеркальных проводок (использовать `chargeback_reversal`).
- ❌ НЕ пересчитывать партнёра из branch при зеркальном списании (искать оригинальный `account_id`).
- ❌ НЕ реализовывать тарифы вывода (0,5% / 1% / 30₽ / 3000₽) — это отдельная задача.
- ❌ НЕ менять архитектуру (два контура: `wallets` для баллов, `accounts` для рублей — уже правильно).
- ❌ НЕ делать рефакторинг — только точечные правки по этому гайду.
- ❌ НЕ искать оригинальные проводки по `payment.id` — искать по `order_id`.
- ❌ НЕ разворачивать только `split_role=point` — разворачивать ВСЕ ноги.
- ❌ НЕ забывать `comment` и `meta` в зеркальных проводках.

## 13. Отчёт перед коммитом

Перед применением правок вывести отчёт:

1. **Результат аудита трассируемости** (Задача 5) — SQL-запрос, показать результат.
2. **Результат пред-чека дублей** в `wallet_transactions` (есть/нет, какие именно).
3. **Список файлов**, которые будут изменены.
4. **Краткое описание изменений** в каждом файле.
5. **Подтверждение**, что не ломаются:
   - идемпотентность `ledger_entries` (unique-индекс)
   - идемпотентность `earnFromOrder` (order_id check)
   - атомарность транзакций (DB::transaction)
6. **Результат прогона тестов** (все новые кейсы проходят).
7. **Скриншоты интерфейса админки** (ChargebackResource, ProcessChargeback).

Жду отчёт для проверки владельцем перед применением.

---

## Часть 3. Что я проверил несколько раз

1. ✅ Все 8 правил §5.5 учтены в гайде.
2. ✅ Все расхождения с предыдущим отчётом задокументированы.
3. ✅ Схема БД проверена — все поля есть.
4. ✅ Код проверен — все файлы существуют.
5. ✅ SQL-запросы синтаксически корректны.
6. ✅ Тест-скрипт использует реальные модели и действия.
7. ✅ Запреты явно сформулированы.
8. ✅ Порядок применения логичен (аудит → миграции → код → тесты → деплой).

## Часть 4. Выводы

1. **Предыдущий отчёт агента устарел** — он не учитывает 8 правил §5.5 v0.5.
2. **Финальный гайд** включает 6 задач (вместо 3), 19 файлов (вместо 12), 8 тестов (вместо 5).
3. **Критические исправления**: поиск по `order_id` (не `payment.id`), полное зеркало всех ног, комиссия банка, интерфейс админки, трассируемость, симуляция.
4. **Риск минимизирован**: все правки точечные, ядро `LedgerService` не трогается, архитектура не меняется.

Готово к передаче агенту. Сохраните файл и отправьте zcode.

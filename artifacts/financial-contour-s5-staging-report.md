# ОТЧЁТ: точечные правки по FINANCIAL_CONTOUR.md §5

| Параметр | Значение |
|:---|:---|
| **Дата** | 2026-09-13 |
| **Статус** | На проверке владельца — код НЕ тронут, коммитов НЕТ |
| **Спека** | `lovii_docs/canon/FINANCIAL_CONTOUR.md` §5 (утв. владельцем 2026-09-13) |
| **База правок** | lovii-app `staging@f02ba42` · lovii-core `staging@81db393` · lovii-b2b `staging@a4358a3` (клоны в `_inspect/`) |

---

## ЗАДАЧА 1 — UI карты LOVII PAY (lovii-app)

Карта обязана показывать **баллы** (`wallets.balance`), а не рубли (`accounts.balance`) — канон §5.1.

| # | Файл | Изменение |
|---|------|-----------|
| 1.1 | `src/modules/profile-balance/components/PayCard.vue` | Новый необязательный проп `balanceUnit` (default `"₽"`) — строка 112 `{{ formatPrice(props.balance) }}&nbsp;₽` станет `{{ formatPrice(props.balance) }}&nbsp;{{ props.balanceUnit }}`. Остальное без изменений. |
| 1.2 | `src/modules/profile-balance/ProfileWallet.vue` | а) Биндинг карты (стр. 315–336): для `kind === 'personal'` → `:balance="wallet?.balance ?? 0"` (баллы из уже загружаемого `apiGetWallet()` → `GET /wallet` → `wallets.balance`), `:balance-label="'Баллы'"`, `:balance-unit="'б.'"`. Карты `company`/`nominal` — без изменений (рубли). б) Подсказка пустой истории (стр. 485, владелец звал :510 — строка сместилась): «Операций пока нет — баланс пополнится с первых оплаченных заказов» → нейтральное «Операций пока нет». в) Секция «Счёт» (`wallet__acct`, стр. 397–416) остаётся в рублях — это панель рублёвого счёта, её канон §5.1 не трогает. |
| 1.3 | `src/modules/profile-module/ProfileModule.vue` | Тот же дефект на главном экране профиля: карта (стр. 324–335) тоже передаёт `account.balance` (рубли). Добавить параллельный `apiGetWallet()` (беззвучный, как в ProfileWallet) + тот же биндинг для `personal`. |

### Не меняется (проверено — уже соответствует)

- **Номер карты** — `helpers/pay-card.ts`: уже детерминированный хэш FNV-1a по `account_id` + контрольная цифра Луна, BIN `96439138` (личный) / `96439142` (бизнес) / `96439000` (номинал). **Не UID**, в БД не хранится, генерируется на лету. Правка не нужна.
- **`GET /wallet`** — существует: `ShowWalletController → GetWalletQuery → LoyaltyService::getOrCreateWallet → WalletResource` отдаёт `wallets.balance`. Бэкенд-правок для задачи 1 нет.

---

## ЗАДАЧА 2 — возврат баллов при отмене/неоплате заказа (lovii-core)

Подтверждён аудит §5 Г5: `spendForOrder` пишется при размещении заказа (до оплаты), обратного возврата нет.

| # | Файл | Изменение |
|---|------|-----------|
| 2.1 | `database/migrations/2026_09_13_000001_add_unique_to_wallet_transactions.php` (**новая**) | Unique-индекс `['wallet_id', 'order_id', 'type']` (аудит §5 Г4). `order_id` nullable — записи без заказа (NULL ≠ NULL в Postgres) индекс не задевает. Перед деплоем — пред-чек на существующие дубли (запрос — в комментарии миграции). |
| 2.2 | `app/Domain/Loyalty/Services/LoyaltyService.php` | Новый метод `refundSpendForOrder(Order $order): void`: сумма по `wallet_transactions type=spend` этого заказа → возврат записью **`type=adjustment`** (не `refund` — см. «Конфликт индексов» ниже), `wallet->increment`, `DB::transaction`, идемпотентность по (wallet, order, adjustment). Дополнительно в `earnFromOrder` — catch `UniqueConstraintViolationException` → no-op (гонка двух вебхуков между `exists()` и insert закрывается индексом; повторный вебхук банка отработает как «уже начислено»). |
| 2.3 | `app/Domain/Order/Services/OrderStatusMachine.php` | Тело `transition()` (update + history) обёрнуто в `DB::transaction`; при `$nextStatus ∈ {Cancelled, Failed}` в **той же транзакции** вызывается `refundSpendForOrder($order)`. Это единственная точка смены статуса в core (проверено grep'ом: прямых `update(['status'=>…])` вне машины нет). DI `LoyaltyService` в конструктор. |
| 2.4 | `app/Listeners/ReturnSpentPointsOnOrderCancellation.php` (**новая**) + регистрация в `AppServiceProvider` | Слушатель `OrderStatusChanged → isCancellation()/Failed` → `refundSpendForOrder`. Покрывает **путь b2b**: панель пишет статус напрямую в `pgsql_core` (`OrderResource::applyTransition`, мимо машины) и досылает событие через `NotifyCoreOfOrderStatusTransition → /api/internal/v1/.../emit-order-status-event` (очередь + ретраи + идемпотентность по history_id). Слушатель идемпотентен (no-op, если машина уже вернула баллы). |

### ⚠️ Конфликт индексов (найден при разведке)

Unique `(wallet_id, order_id, type)` запрещает **две** записи `refund` по одному заказу (а `refundEarnForOrder` уже пишет `refund`). Поэтому возврат spend — `type=adjustment` (задача разрешает «refund или adjustment»). Инвариант §5.2 `balance = Σearn − Σspend + Σ(adjustment/refund)` соблюдается.

---

## ЗАДАЧА 3 — зеркальное списание при чарджбэке (lovii-core)

Подтверждено: `PaymentStatus::fromBankStatus` **не знает `CHARGEBACK`** (падает в `default → Pending`); на Refunded/Reversed есть только `refundEarnForOrder` (баллы), зеркала в ledger нет.

| # | Файл | Изменение |
|---|------|-----------|
| 3.1 | `app/Domain/Payment/Enums/PaymentStatus.php` | Кейс `Chargeback = 'chargeback'`; маппинг `'CHARGEBACK', 'PARTIAL_CHARGEBACK' → Chargeback`. |
| 3.2 | `app/Domain/Billing/Enums/LedgerEntryType.php` | Кейс `ChargebackReversal = 'chargeback_reversal'`. **Критично:** нельзя переиспользовать `order_income` — дубликат-чек LedgerService принял бы зеркальную проводку за оригинал и no-op'нул бы её. |
| 3.3 | `app/Application/Billing/Actions/ReverseOrderPoolAction.php` (**новая**) | Обратный след §5.3: ищет **оригинальную** проводку начисления — `ledger_entries where source_type='payment', source_id=payment.id, type=order_income, split_role=point, amount>0` — и постит на **тот же account_id** (не пересчитывая партнёра из branch!) через `LedgerService::post` сумму `−amount`, type=`chargeback_reversal`, split_role=`point`, источник тот же `payment:ID`. Если оригинала нет (партнёр не привязан, 90% не постилось) — лог + no-op. |
| 3.4 | `app/Application/Payment/Actions/HandleTBankNotificationAction.php` | а) `Chargeback` включён в `$followsConfirmed` (после CONFIRMED проходить может). б) Блок стр. 166–168 расширен: `Refunded / Reversed / Chargeback` → один `DB::transaction`: `refundEarnForOrder` (уже есть, type=refund) + `reverseOrderPool->execute` (новое зеркало). Атомарно как единое целое (savepoint-вложенность). |

### Пункт (в) задачи — минус-баланс как долг

Уже работает без правок: `accounts.balance` — `bigInteger` без CHECK-констрейнта; `LedgerService::post` делает `increment` знаковой суммой под row-lock → минус ложится свободно и блокирует логику выплат по канону (решение о механике блокировки выплат — вне этой задачи).

---

## ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ — статус

- ✅ **Unique `(source_type, source_id, type, account_id, split_role)`** — уже существует (`ledger_entries_source_unique`, миграция `2026_09_11_120000_create_billing_accounts_tables.php`). Зеркало опирается на него + пред-чек LedgerService.
- ➕ **Unique `(wallet_id, order_id, type)`** — добавляется новой миграцией (2.1).
- ✅ **Копейки/целые** — `accounts.balance`, `ledger_entries.amount` = bigInteger; `wallets.balance`, `wallet_transactions.amount` = integer; float нигде не участвует (ROUND_HALF_UP в сплите).

---

## ПОДТВЕРЖДЕНИЯ (что не ломается)

1. **Идемпотентность ledger_entries (unique-индекс)** — не ломается: unique-индекс не трогаем; зеркало использует **новый** type + тот же источник → повторный вебхук = no-op на двух уровнях (пред-чек + индекс). Дополнительный эффект: только благодаря новому type зеркальная проводка не коллайдирует с оригиналом.
2. **Идемпотентность earnFromOrder (order_id check)** — не ломается: `order_id`-чек сохранён как есть; сверху добавлены уникальный индекс (гонка закрывается на уровне БД) и catch `UniqueConstraintViolationException` → поведение «банк ретраит → второй вызов no-op» сохраняется.
3. **Атомарность транзакций (DB::transaction)** — не ломается, усиливается: каждый постинг LedgerService — транзакция под row-lock (как было); возврат баллов теперь в одной транзакции со сменой статуса; контур чарджбэка (баллы + зеркало) — одна внешняя транзакция.

---

## Тесты (дополнение к существующим)

| Файл | Новые кейсы |
|:---|:---|
| `tests/Feature/Payment/TBankWebhookTest.php` | +2: CHARGEBACK — зеркальная проводка на счёт партнёра; идемпотентность повтора вебхука |
| `tests/Feature/Loyalty/LoyaltyServiceTest.php` | +2: refundSpendForOrder happy-path; повторный вызов — no-op |
| `tests/Feature/Billing/DistributeOrderPoolTest.php` | +1: ReverseOrderPoolAction — тот же счёт, минус-баланс, no-op без оригинала |

---

## Итоговый список файлов

**lovii-app (3):** `ProfileWallet.vue` · `PayCard.vue` · `ProfileModule.vue`

**lovii-core (9):**
- новая миграция `2026_09_13_000001_add_unique_to_wallet_transactions.php`
- `LoyaltyService.php` · `OrderStatusMachine.php`
- новый листенер `ReturnSpentPointsOnOrderCancellation.php` + регистрация в `AppServiceProvider.php`
- `PaymentStatus.php` · `LedgerEntryType.php`
- новый `ReverseOrderPoolAction.php` · `HandleTBankNotificationAction.php`

**lovii-b2b:** правок нет (см. открытый вопрос 3).

---

## Открытые вопросы (решение владельца, до применения)

1. **Доли пула 40/40/20 при чарджбэке.** По задаче (б) разворачивается только партнёрская нога 90%. Доли пула (Компания/представитель/амбассадор) остаются. Если нужно полное зеркало «обратным следом» по всем ногам — в `ReverseOrderPoolAction` это расширение на один параметр (механизм уже читает оригинальные проводки).
2. **PARTIAL_CHARGEBACK / PARTIAL_REFUNDED** маппятся в полный Chargeback/Refunded → отработка полная. Частичные суммы — отдельная задача, сейчас не поддерживаются.
3. **Атомарность пути b2b.** Строго атомарно с постановкой статуса это возможно только правкой `OrderResource::applyTransition` в lovii-b2b (в задаче не заявлено). Сейчас: core-путь атомарен, b2b-путь — гарантированно-доставляемый (очередь, ретраи, идемпотентность), но eventual.
4. **Пред-чек дублей** в `wallet_transactions` перед созданием unique-индекса на staging (миграция упадёт, если дубли уже есть; чистящий запрос приложу).

---

## Порядок применения (после подтверждения)

1. Правки локально → прогон тестов (core: phpunit по затронутым сюитам; app: сборка + линт).
2. Диффы на финальную сверку владельцу.
3. По команде владельца — пуш в staging: app (автодеплой) и core (автодеплой + `php artisan migrate`).

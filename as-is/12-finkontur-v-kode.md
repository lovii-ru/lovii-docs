# 12. Финансовый контур в коде и БД — как есть (2026-09-17, обновлено 2026-09-19 и 2026-09-22)

> Рабочая заметка (класс W), не канон. Канон-цели: `lovii_docs/canon/FINANCIAL_CONTOUR.md`
> (§5 — LOVII PAY), `PARAMS.md` (ставки/пул). Здесь — **что реально работает в коде
> сегодня**, где расхождения с каноном и как всё сверить. Дельта 18–19.09: подписка
> (SZ-052/053/056/057), выплаты (SZ-054), ПЭП (SZ-055), гейт доли включён (EC-11).
> Дельта 20–21.09: тестовый банковский контур tbank-mock (T-013, каркас), сквозной
> чарджбэк на моке, автоматическая верификация МСП (закрытие Б-3/Б-4) — разделы
> ниже. Формат — [README](README.md).

## Два независимых контура денег

| | Баллы лояльности | Рублёвый учёт |
|---|---|---|
| Таблицы | `wallets`, `wallet_transactions` | `accounts`, `ledger_entries` |
| Счёт | 1 кошелёк на пользователя | полиморф: `user` / `partner` (ИНН юрлица) / `platform` / `platform_nominal` |
| Проводки | earn / spend / refund / adjustment (amount ≥ 0) | append-only, amount **со знаком** |
| Инвариант | `wallets.balance = Σearn − Σspend + Σrefund/adjustment` | `accounts.balance = Σledger_entries` |
| Где живёт код | `app/Domain/Loyalty/Services/LoyaltyService.php` | `app/Domain/Billing/Services/LedgerService.php` (постинг под row-lock, unique = идемпотентность) |

## Сквозной путь заказа (шаг за шагом)

1. **Чекаут**: `total = subtotal + delivery_fee − bonus_to_spend`
   (PlaceOrdersAction.php:90; списание баллов бэкенд делает, UI не передаёт).
   Заказ создаётся `status=created`, корзина очищается, снапшоты цен — в заказ.
2. **Платёж** (отдельный шаг): `POST /orders/{id}/payment` → T-Bank Init,
   двухстадийная схема: `PayType=T` (холд), Deal типа NN (номинальная схема),
   PaymentRecipientId, NotificationURL (CreateOrderPaymentAction.php:80–127).
   Повторный тап возвращает живую сессию. Оплата разрешена в любом нетерминальном
   статусе заказа.
3. **Вебхук** `POST /payments/tbank/webhook` (без auth): тело **не доверяется** —
   статус перепроверяется server-to-server GetState (HandleTBankNotificationAction.php:61).
4. **Confirmed** → три действия в одной точке (:157–171):
   - заказ `created → submitted` (OrderStatusMachine, source=payment);
   - **кэшбэк покупателю**: `earnFromOrder` — `round(total × loyalty_rules.earn_percent/100)`,
     идемпотентно (unique wallet+order+type); без активного правила — 0;
   - **распределение пула** `DistributeOrderPoolAction::execute()`.
5. **Refunded / Reversed / Chargeback** → атомарно: возврат кэшбэка
   (`refundEarnForOrder`) + зеркальный разворот пула (:173–197).

## Распределение пула (как в коде, DistributeOrderPoolAction)

```text
platform   = round(total × 10%)                    // payments.split.platform_rate
fee        = rate(канал) × total, минимум 3,49 ₽   // card 3,16% · tpay 2,59% · sbp 0,7% · points 0
pool       = platform − fee                        // отрицательный → 0
точке      = total − platform                      // на счёт юрлица (accounts owner_type=partner)
пул        = 40% Компания · 40% Представитель · 20% Амбассадор
                                                     // остаток округления → Компания
```

- **Канал** берётся из `payments.provider_payload.method`, иначе всегда «card» —
  `orders.method` в БД нет (комментарий :220–229). Балльная оплата fee=0.
- **Счёт точки** = счёт юрлица по ИНН (90% капает на счёт компании, не на личный).
- **Представитель** — из заявки точки: `partner_applications` с
  `representative_user_id` + апрувом (:247–264). Без связки — **фолбэк**
  `FOUNDER_REP_PROMO_CODE` (AA2222, владельцу) — правило «МСП без промокода не
  бывает». Kuper-импорт без партнёра → Компания.
- **Амбассадор** — по префиксу промокода репа (:281–304).
- **Компания-оператор** — env `OPERATOR_PARTNER_ID` (АКСИОМА 265), иначе platform-счёт.
- **Номинальный учёт (SZ-043)**: параллельно зеркальные проводки +100%/−fee на
  счёт `platform_nominal` (:86–136) — это **учётная** имитация номинального счёта,
  банковского номинального счёта ещё нет.
- **Гейт подписки представителя — включён на staging** (EC-11, core 6309392,
  флаг `payments.split.rep_subscription_gate=true`): реп без активной подписки
  (актив/grace — `grantsBenefits()`) теряет 40% пула в пользу Компании; амбассадор
  не задет (DistributeOrderPoolAction.php:250–263). Проводка подписки — отдельный
  тип `subscription_payment` (см. ниже).

## Подписка LOVII PASS (SZ-052/053/056/057 — реализовано 18.09)

- `subscriptions` (снимок цены 59900/19900, календарный период, окно grace) +
  `subscription_status_changes`; статусы active/grace_period/suspended/cancelled,
  в grace льготы сохраняются. Биллинг: каскад **Business → PAY → внешняя карта
  (каркас, failed external_unavailable)**; cron `subscriptions:charge`
  03/09/15/21 МСК; аннулирование через 48 ч сбрасывает акционную цену 199→599.
- Активация `POST /subscription/activate` — оплата **только с внутреннего счёта**
  (рекуррента на старте нет — решение владельца 18.09); промо 199 по коду амба,
  иначе 599; без промокода 403 (SZ-057), за подписку — личный промокод.
- Проводка: `subscription_payment` (дебет источника + кредит оператора 100%).

## Выплаты и ПЭП (SZ-054/055 — реализовано 18.09)

- **Pull (НПД)** `POST /payout/request`: минимум 100 ₽; ≥ 3 000 ₽ — 1% платит
  ОПЕРАТОР (получателю 100%), < 3 000 ₽ — удержание 30 ₽. Гейты: подписка,
  legal_status ≠ ip/ooo, `accounts.payouts_blocked` (минус-баланс).
- **Push (ИП/ООО)** `payouts:push-daily` 09:00 МСК — суточный реестр по
  partner-счетам, комиссия 0,5% bearer=operator; минус-баланс → blocked-флаг.
  Проводки Payout/PayoutCommission (F-049 закрыт).
- ⚠️ Исполнение банком — **руками** (реестр → интернет-банк, статус pending);
  автоматизация ждёт тестовый контур Т-Банка (решение владельца §C2 #6).
- **ПЭП** (SZ-055): после pull-выплаты создаётся закрывающий документ
  (`pep_reports`, canonical-hash) и уходит пуш с кодом — подпись кодом из пуша.
  API `/pep/reports/{pending,confirm,resend}`.

## Возвраты и чарджбэки

- **Отмена заказа** (created/submitted/точкой): списанные за заказ баллы
  возвращаются в транзакции статус-машины (тип adjustment, идемпотентно).
- **Возврат/чарджбэк денег** (вебхук Т-Банка): возврат начисленного кэшбэка +
  `ReverseOrderPoolAction` — **полное зеркало всех ног** по order_id типом
  chargeback_reversal ровно на суммы оригинала; комиссия банка не разворачивается.
  Bank fee вводит оператор в lovii-admin (страница ProcessChargeback →
  `POST /api/internal/v1/orders/{id}/chargeback`) и он списывается **со счёта
  Точки** (PostChargebackBankFeeAction). Идемпотентность — chargeback_logs.

## Тестовый банковский контур tbank-mock (дельта 20.09 — T-013, каркас в staging)

- **Стенд-симулятор Т-Банка** (репо core, `tbank-mock/`): консоль `/admin`
  (авто-обновление каждые 2 с), Token-подпись по канону банка (Password участвует
  в сортировке — doc-пример Pan<Password<PaymentId), https-транспорт для
  https-URL нотификаций, идемпотентный `stand-bootstrap.sh` (города/Основатель/
  AA2222/лоялти/капитал).
- **Staging-ядро подключено к моку** (сессия 047): `PAYMENTS_FAKE=false`,
  `TBANK_API_URL=http://tbank-mock:3100/v2` — работает настоящий `TBankClient`
  (грабля: после правки env обязателен `--force-recreate` + `config:cache`,
  иначе живёт `FakeTBankClient` с префиксом `fake-…`).
- **Сценарий CHARGEBACK**: в консоли — кнопка «эмитент зафиксировал чарджбэк»
  для CONFIRMED-платежей: состояние банка `CHARGEBACK` + подписанная нотификация
  (`CHARGEBACK`/`PARTIAL_CHARGEBACK` добавлены в нотифицируемые). Это принципиально:
  ядро НЕ доверяет статусу нотификации — только server-to-server GetState
  авторитетен, поэтому мок обязан уметь чарджбэк как состояние банка.
- **Сквозняк подтверждён на staging** (order 125 → payment 259): Init → оплата
  → AUTHORIZED → CONFIRMED (проводки income/pool) → чарджбэк в консоли →
  нотификация (переспрос GetState; подделка → `tbank.webhook.bad_signature`) →
  payment `chargeback` + зеркальный разворот пула (point/company/representative/
  ambassador) → кнопка «Обработать» в /admin/chargebacks → строка в
  `chargeback_logs` (bank_fee).
- ⚠️ Граница: **боевой банк всё ещё не подключён** — мок закрывает репетицию
  контура (T-013, SZ-054), но не прод; интеграция модуля выплат (push/pull)
  с моком и API-доступ к счёту — следующие шаги (см. Б-5 в [00](00-zapusk-chego-ne-hvataet.md)).

## Верификационный платёж 1 ₽ (подключение точки)

Код VER-<partner_id>-<суффикс> показывается в кабинете (`GET /msp/payment`),
реквизиты из env (config/roles.php:14–27). **С 20.09 верификация автоматизирована —
три пути (подробности в [05](05-rol-i-kabinety.md)):**

1. самосервисный VER-платёж: кнопка «я отправил» (`POST /msp/payment/sent`) →
   банк/мок создаёт поступление → вебхук `POST /payments/tbank/incoming` →
   `MatchIncomingVerificationAction` матчит VER-код + ИНН + сумму → `verified`
   сам; реквизиты плательщика становятся первой «карточкой компании»
   (`partner_payout_accounts`, lovii_b2b);
2. автопрогон «рубля» через банк при аппруве представителя
   (`RunPartnerVerificationAction` через `AccountVerificationClient`);
3. ручная кнопка в lovii-admin (`POST /api/internal/v1/partners/{id}/verify`) —
   инструмент-исключение.

Исключение (SZ-050 Ф2, 17.09): заявка с ИНН уже верифицированного своего юрлица
(без промокода) создаёт бренд в существующем юрлице и сразу Verified — без
счёта 1 ₽. Ручной SQL/Tinker больше не единственный путь — это был главный
ручной шаг всего пути МСП.

## Счета владельца на staging (обновлено SQL 2026-09-19)

| Счёт | owner | Баланс | Проводок |
|---|---|---|---|
| account 1 | partner 263 АТМОСФЕРА | **60 597,00 ₽** | 9 |
| account 2 | partner 265 АКСИОМА | **2 582,76 ₽** | 18 |
| account 3 | user 51 (личный, реп 40%+амб 20%) | **3 369,74 ₽** | 30 |
| account 8 | platform_nominal (зеркала) | 0,00 ₽ | 72 |

Всего проводок в `ledger_entries`: 136. У партнёров Kuper-витрины (РОГА И
КОПЫТА, УЛЫБКА РАДУГИ, ПЕРЕКРЕСТОК, ДОМОВОЙ…) — свои счета с проводками
(нагрузочный прогон SZ-060). `subscriptions`/`payouts`/`pep_reports` — живые
таблицы, 0 строк. API тех же цифр: `GET /balance` (личный + счета компаний +
номинальный Основателю — ListBalanceAccountsQuery.php:41–77) и `GET /wallet`
(баллы; с 19.09 ещё `turnover_kopecks` за 30 дней — WalletResource.php:39).

## Чего НЕТ в коде (расхождения с каноном FINANCIAL_CONTOUR, на 19.09)

| Канон | Факт в коде |
|---|---|
| Карта LOVII PAY = витрина счетов | сущности карты-витрины нет; `cards` — только внутренние идентификаторы (пулы 9138/9142); номер на счёт рисуется клиентом (FNV-хэш account_id, BIN 9643) |
| Уровни карты PAY/PASS/VIP | ~~API нет~~ — есть: PASS = подписка, VIP = `turnover_kopecks` ≥ 300 000 ₽/30 дней (WalletResource.php:39); карта-витрина как банковская сущность — по-прежнему нет |
| ~~Подписка представителя 599/199~~ | **реализована** (SZ-052/053/056/057): домен + каскад + активация с внутреннего счёта + гейт доли (включён на staging); остаток P2 — sub-price-lock сверка |
| Доход представителя (экран/API) | всегда 0 |
| ~~Вывод средств (payout)~~ | **каркас реализован** (SZ-054/055): pull+push+ПЭП, проводки идут; **исполнение банком — руками** до тестового контура |
| Номинальный счёт в банке | только зеркальный учёт platform_nominal (SZ-043) |
| orders.method (канал эквайринга) | нет колонки — пул всегда считает «карту» |
| Внешняя карта в каскаде подписки | каркас (попытка = failed external_unavailable); тестовый контур появился (tbank-mock) — интеграция каскада с моком не проверялась |
| Боевой банковский API (выплаты, выписка счёта) | не подключён; репетиция возможна на моке (T-013), API-доступ к счёту — запрос владельца в банк (отложен 18.09) |
| P2P-переводы | не реализованы (утверждены: лимиты 100–3 000 ₽; тарифная сетка решения A4 17.09 — gemini-code-1789669703545.md <!-- doc-canon: historical — сетка P2P, не старая эфф. ставка канона -->) |
| Фискальные чеки (ККТ, агентская схема) | нет; квитанция «не фискальный документ» |

## Как сверить (SQL, read-only)

```sql
-- инвариант рублёвых счетов (должно вернуть 0 строк)
SELECT a.id FROM accounts a
WHERE a.balance <> (SELECT COALESCE(SUM(l.amount),0) FROM ledger_entries l WHERE l.account_id = a.id);

-- инвариант баллов (должно вернуть 0 строк)
SELECT w.id FROM wallets w
WHERE w.balance <> (
  SELECT COALESCE(SUM(CASE WHEN t.type='earn' THEN t.amount
                          WHEN t.type='spend' THEN -t.amount
                          ELSE t.amount END),0)
  FROM wallet_transactions t WHERE t.wallet_id = w.id);
```

## Кандидаты в «не хватает» (решает владелец)

1. ~~Авто-матчинг верификационного платежа~~ — **закрыто 20.09** (три пути
   верификации, см. [05](05-rol-i-kabinety.md) и раздел выше).
2. `orders.method` — фиксировать канал эквайринга в заказе (сейчас точность пула
   по СБП/T-Pay теряется).
3. Тестовый контур Т-Банка → **доработать интеграцию выплат с моком** (push-реестр
   и pull-выплата через API мока — репетиция реестров), потом боевой прогон;
   внешняя карта в каскаде подписки на моке.
4. Карта-витрина LOVII PAY (контур «Зет» канона); P2P-переводы (P2).
5. Перед продом: убедиться, что `loyalty_rules` содержит активное правило (сейчас
   в staging 1 строка «Кэшбэк 5%» — без неё кэшбэк молча нулевой) и что
   `OTP_DEV_BYPASS=false`, `OPERATOR_PARTNER_ID` задан.

## Сверка владельцем

- **2026-09-22 (волна 1, Блок Б — приёмка, staging):** номинальный счёт
  SZ-043 принят — «вижу все операции и чарджбэки тоже там видно»: полный учёт
  чека в выписке транзита подтверждён, свежий заказ не требовался (цикл
  действует с деплоя 12.09). Видимость чарджбэк-проводок — подтверждена;
  корректность сумм разворотов остаётся в дефектах F-050 (SZ-045, Блок В).
  Оплата staging на localhost — T-014 (Б-10 в
  [00](00-zapusk-chego-ne-hvataet.md)), вне скоупа приёмки SZ-043.

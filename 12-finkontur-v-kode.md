# 12. Финансовый контур в коде и БД — как есть (2026-09-17)

> Рабочая заметка (класс W), не канон. Канон-цели: `lovii_docs/canon/FINANCIAL_CONTOUR.md`
> (§5 — LOVII PAY), `PARAMS.md` (ставки/пул). Здесь — **что реально работает в коде
> сегодня**, где расхождения с каноном и как всё сверить. Формат — [README](README.md).

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
- **Гейт подписки представителя** выключен (`PAYMENTS_SPLIT_REP_SUBSCRIPTION_GATE=false`,
  :248–252) — подписок в системе нет.

## Счета владельца на staging (проверено SQL 2026-09-17)

| Счёт | owner | Баланс | Проводок |
|---|---|---|---|
| account 1 | partner 263 АТМОСФЕРА | **52 587,00 ₽** | 8 |
| account 2 | partner 265 АКСИОМА | **2 003,00 ₽** | 14 |
| account 3 | user 51 (личный, реп 40%+амб 20%) | **3 004,49 ₽** | 28 |
| account 8 | platform_nominal (зеркала) | 0,00 ₽ | 60 |

API для тех же цифр: `GET /balance` (личный + счета компаний + номинальный
Основателю — ListBalanceAccountsQuery.php:41–77) и `GET /wallet` (баллы).

## Возвраты и чарджбэки

- **Отмена заказа** (created/submitted/точкой): списанные за заказ баллы
  возвращаются в транзакции статус-машины (тип adjustment, идемпотентно).
- **Возврат/чарджбэк денег** (вебхук Т-Банка): возврат начисленного кэшбэка +
  `ReverseOrderPoolAction` — **полное зеркало всех ног** по order_id типом
  chargeback_reversal ровно на суммы оригинала; комиссия банка не разворачивается.
  Bank fee вводит оператор в lovii-admin (страница ProcessChargeback →
  `POST /api/internal/v1/orders/{id}/chargeback`) и он списывается **со счёта
  Точки** (PostChargebackBankFeeAction). Идемпотентность — chargeback_logs.

## Верификационный платёж 1 ₽ (подключение точки)

Код VER-<partner_id>-<суффикс> показывается в кабинете (`GET /msp/payment`),
реквизиты из env (config/roles.php:14–27). **Авто-матчинга входящего платежа в
коде нет** — статус `verified` ставится вручную (SQL/Tinker). Это главный ручной
шаг всего пути МСП.

## Чего НЕТ в коде (расхождения с каноном FINANCIAL_CONTOUR)

| Канон | Факт в коде |
|---|---|
| Карта LOVII PAY = витрина счетов | сущности карты-витрины нет; `cards` — только внутренние идентификаторы (пулы 9138/9142); номер на счёт рисуется клиентом (FNV-хэш account_id, BIN 9643) |
| Уровни карты PAY/PASS/VIP | статика на клиенте, API нет |
| Подписка представителя 599/199 | не реализована (только комментарии «фаза 3»); гейт доли выключен |
| Доход представителя (экран/API) | всегда 0 |
| Вывод средств (payout) | enum `LedgerEntryType::Payout` есть — использований нет |
| Номинальный счёт в банке | только зеркальный учёт platform_nominal (SZ-043) |
| orders.method (канал эквайринга) | нет колонки — пул всегда считает «карту» |
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

1. Авто-матчинг верификационного платежа (снять ручной UPDATE — см. [05](05-rol-i-kabinety.md)).
2. `orders.method` — фиксировать канал эквайринга в заказе (сейчас точность пула
   по СБП/T-Pay теряется).
3. Карта-витрина LOVII PAY (контур «Зет» канона) + API уровней.
4. Доход репа/амба → API + экраны; подписка 599/199; вывод (Г-3).
5. Перед продом: убедиться, что `loyalty_rules` содержит активное правило (сейчас
   в staging 1 строка «Кэшбэк 5%» — без неё кэшбэк молча нулевой).

## Сверка владельцем

(пока пусто)

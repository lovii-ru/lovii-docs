# 04. Баллы, кошелёк, счета, платежи — как есть

> Срез: 2026-09-17. Рабочая заметка (класс W), не канон. Числовые параметры —
> канон `lovii_docs/canon/PARAMS.md` / договор Т-Банка. Формат — [README](README.md).

## Что это

Два денежных контура: **баллы лояльности** (кэшбэк за заказы, списание в чекауте)
и **рублёвые счета** (ledger: 90% точке, пул платформы 40/40/20). Платежи —
эквайринг Т-Банк (двухстадийный). Карточная витрина LOVII PAY — **не реализована**
(есть только внутренние «номера счетов»).

## Баллы (лояльность)

- Модели: `Wallet` (user_id, balance int, currency — Wallet.php:25–51),
  `WalletTransaction` (type, amount int без знака, order_id, meta —
  WalletTransaction.php:26–58). Типы: `earn | spend | refund | adjustment`
  (WalletTransactionType.php:12–18). **Сгорания нет** — типа expiration не существует,
  хотя поле `expires_at` в БД осталось (комментарий WalletTransactionType.php:8–10).
- Правила: `LoyaltyRule` (earn_percent, max_spend_percent, is_active, период) —
  LoyaltyRule.php:28–56. **Сида с 5% нет** — правило заводится вручную в админке
  (LoyaltyRuleResource); без активного правила начисление = 0.
- Начисление: `earnFromOrder` — только при **confirmed** платежа
  (HandleTBankNotificationAction.php:166), `round(total × earn_percent/100)`,
  идемпотентность exists + unique(wallet, order, type) (миграция 2026_09_13_000001).
- Списание: `spendForOrder` + `validateSpend` — максимум `max_spend_percent` от
  суммы (LoyaltyService.php:177–215); вызов из PlaceOrdersAction.php:48.
- Возвраты: earn-возврат при Refunded/Reversed/Chargeback (тип refund,
  :90–124); возврат списанного при отмене заказа — тип **adjustment** (не refund —
  из-за unique-индекса), :133–175.
- API: копейки; клиент форматирует `formatPrice` (вход в копейках,
  price-helpers.ts:1–12), баллы рисуются «+N б.» (WalletHistoryList.vue:59).

## Кошелёк и балансы (API)

- Роуты (routes/api.php:233–238): `GET /wallet`, `GET /wallet/transactions`
  (per_page, дефолт 24, макс 48 — HasPagination; серверных фильтров по типу/периоду нет),
  `GET /balance`, `GET /balance/entries`.
- `GET /wallet`: PAY-балл + card_number/card_number_formatted (WalletResource.php:26–31).
- `GET /balance`: личный счёт + счета компаний владельца (SQL через
  lovii_b2b.partner_users/partners — ListBalanceAccountsQuery.php:41–48) +
  номинальный счёт (виден только Основателю — :63–77). Формат: kind
  (personal/company/nominal), title, inn, balance.
- Рублёвые счета: `accounts` (unique owner_type+owner_id; owner_type
  `user | partner | platform | platform_nominal` — AccountOwnerType.php:12–20);
  `ledger_entries` — append-only, amount **со знаком**, unique
  (source_type, source_id, type, account_id, split_role); баланс = Σ проводок,
  постинг под row-lock (LedgerService.php:37–85). Типы проводок — LedgerEntryType
  (order_income, pool_share, payout, adjustment, payment_income, acquiring_fee,
  chargeback_reversal, chargeback_bank_fee). **Payout нигде не постится**.

## Пул 40/40/20 (DistributeOrderPoolAction)

- `platform = round(total × 10%)`; `fee` по каналу (card 3,16%/мин 3,49 ₽,
  sbp 0,7%, tpay 2,59%, points 0 — config/payments.php:71–76; канал из
  provider_payload, иначе card — :220–229); `pool = platform − fee` (мин 0);
  точке `total − platform` (:57–66).
- Пул делится Компания 40 / Представитель 40 / Амбассадор 20 (:83–87),
  остаток округления → Компания (:77).
- Привязка репа: заявка точки с `representative_user_id` + апрув (:247–264);
  **без связки — фолбэк** `FOUNDER_REP_PROMO_CODE` (AA2222, правило «МСП без
  промокода не бывает»); Kuper без партнёра → Компания (:269–271).
- Амбассадор — по префиксу активного промокода репа (:281–304).
- Счёт компании-оператора: env `OPERATOR_PARTNER_ID` (АКСИОМА 265), иначе
  platform-счёт (:99–102, :237–244).
- Номинальный контур (SZ-043): зеркальные проводки на platform_nominal (:86–136).
- Гейт подписки представителя: `PAYMENTS_SPLIT_REP_SUBSCRIPTION_GATE`, **выключен**;
  проверки подписки в коде нет (комментарий :249–251).

## Экраны app

- `/profile/wallet` «Счёт и операции»: контуры money/points; вкладка «Баллы» —
  только для личного счёта (ProfileWallet.vue:77–121). Экран «Мои баллы» удалён,
  redirect на wallet с `?tab=points` (router/index.ts:288–296).
- «Карта»: сущности банковской карты НЕТ. Есть `Card` — внутренний идентификатор
  владельца счёта (16 цифр, Лун, пулы 9138/9142, выдаётся при регистрации —
  SendOtpAction.php:54, Card.php:10–24); номер **на счёт** в app рисуется на
  клиенте из FNV-хэша account_id с BIN 9643 (pay-card.ts:18–98).
  Уровни PAY/PASS/VIP — статика на клиенте, API уровней нет (pay-tier.ts:9–13).

## Платежи Т-Банк

- `Payment` (provider tbank, RUB, provider_payment_id, payment_url, deal_id,
  provider_payload — Payment.php:57–82). Статусы: new…confirmed, refunded,
  reversed, chargeback… (PaymentStatus.php:12–51; PARTIAL_CHARGEBACK маппится в
  полный chargeback, unknown → Pending).
- Создание оплаты: `CreateOrderPaymentAction` — гейт `payments.enabled`
  (:31), переиспользование живой сессии (:56–67), Init двухстадийный
  (PayType=T, Deal NN, PaymentRecipientId, NotificationURL — :80–127).
- Вебхук `POST /payments/tbank/webhook` (без auth, ответ `OK`): тело **не
  доверяется** — статус перечитывается GetState (:61); confirmed назад не
  откатывается (:136–146); confirmed → created→submitted + кэшбэк + пул
  (:157–171); refunded/reversed/chargeback → возврат кэшбэка + зеркальный
  разворот пула (:173–197).
- Чарджбэк: `ReverseOrderPoolAction` зеркалит все ноги типом
  chargeback_reversal (fee банка не разворачивается — ReverseOrderPoolAction.php:39–117);
  bank fee вручную со счёта Точки (`PostChargebackBankFeeAction`); подтверждение
  оператором — из lovii-admin (`POST /api/internal/v1/orders/{id}/chargeback`,
  routes/internal.php:25–27).
- Заглушка dev/staging: `PAYMENTS_FAKE` (биндинг FakeTBankClient, только не-prod —
  AppServiceProvider.php:48–49) + фейк-терминал в app + `POST /payments/fake/notify`
  (404 на прод). Локально: PAYMENTS_ENABLED=true + FAKE=true (.env:102–103);
  staging — включено с тестовым терминалом.
- `orders.method` (канал эквайринга) в БД нет — пул всегда считает «карту» по умолчанию.

## Чего нет / ограничения (факты)

- Подписка представителя 599/199 — **не реализована** (только комментарии
  «фаза 3»: RepresentativeProfileResource.php:30, ShowRepresentativeProfileController.php:14).
- Вывод средств — **не реализован**: enum `Payout` есть, использований нет;
  экран «Доход представителя» показывает честный ноль («эндпоинта дохода нет
  вообще» — RepresentativeIncome.vue:8–10).
- Карта LOVII PAY как витрина счетов (канон FINANCIAL_CONTOUR §5) — не собрана;
  уровни карты (PASS/VIP) — статика без API.
- Сгорание баллов убрано (решение владельца), механизм expiration отсутствует.
- Фискальные чеки (ККТ) — отсутствуют.

## Кандидаты в «не хватает» (решает владелец)

1. Активное правило лояльности в БД (earn_percent) — без него кэшбэк не начисляется;
   проверить на staging/prod перед релизом.
2. API уровней карты (PAY/PASS/VIP) и карты-витрина — контур «Зет» из канона.
3. Доход представителя (эндпоинт + экран) — сейчас ноль всегда.
4. Подписка 599/199 + включение гейта доли (Б-3).
5. Вывод средств (Г-3) — вне MVP, но enum и счёт уже есть.

## Сверка владельцем

(пока пусто)

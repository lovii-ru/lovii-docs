# 04. Баллы, кошелёк, счета, платежи — как есть

> Срез: 2026-09-17, **обновлено 2026-09-19** (дельта 18–19.09: подписка LOVII PASS,
> выплаты, ПЭП, VIP-оборот — разделы «Подписка», «Выплаты», «ПЭП»; старые факты —
> по срезу 17.09) и **2026-09-22** (дельта 20.09: тестовый контур tbank-mock —
> раздел «Выплаты»; личная карта показывает баллы — «Экраны app»). Рабочая
> заметка (класс W), не канон. Числовые параметры — канон `lovii_docs/canon/PARAMS.md`
> / договор Т-Банка. Формат — [README](README.md).

## Что это

Два денежных контура: **баллы лояльности** (кэшбэк за заказы, списание в чекауте)
и **рублёвые счета** (ledger: 90% точке, пул платформы 40/40/20). Платежи —
эквайринг Т-Банк (двухстадийный). Поверх них: **подписка LOVII PASS** (599/199 ₽,
SZ-052/053/056/057), **выплаты** (pull НПД + суточный push-реестр, SZ-054) и
**ПЭП-реестр** (SZ-055). Карточная витрина LOVII PAY как банковская карта —
**не реализована** (есть только внутренние «номера счетов»).

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
  (order_income, pool_share, payout, payout_commission, adjustment, payment_income,
  acquiring_fee, chargeback_reversal, chargeback_bank_fee, **subscription_payment**).
  Payout/PayoutCommission постятся службой выплат (см. ниже), subscription_payment —
  биллингом подписки (SZ-053).

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
- **Гейт подписки представителя — реализован и ВКЛЮЧЁН на staging** (EC-11,
  core 6309392, флаг `payments.split.rep_subscription_gate=true`): при включённом
  флаге реп без активной подписки (актив/grace) теряет свою долю пула в пользу
  Компании; амбассадор не задет (DistributeOrderPoolAction.php:250–263).

## Подписка LOVII PASS (SZ-052/053/056/057, реализовано 18.09)

- Домен (SZ-052): таблица `subscriptions` (одна на профиль, снимок цены
  59900/19900 коп., календарный период, окно grace) + `subscription_status_changes`
  (append-only); enum `SubscriptionStatus` — `active | grace_period | suspended |
  cancelled`; `grantsBenefits()` — в grace льготы сохраняются (решение §A2);
  машина переходов `SubscriptionStatusMachine` (окно 48 ч ставит grace сама,
  дубль → 409) — app/Domain/Subscription/. Read-API `GET /v1/subscription`
  (routes/api.php:251; без подписки — data:null).
- Биллинг (SZ-053): журнал попыток `subscription_charges` + каркас
  `external_payment_methods`; `SubscriptionBillingService` — каскад источников:
  **Business (счета юрлиц по мосту partners.owner_user_id) → PAY (личный счёт) →
  внешняя карта** (каркас: попытка = failed `external_unavailable`, реальное
  снятие после тестового контура банка). Cron `subscriptions:charge`
  03/09/15/21 МСК (retry раз в 6 ч). Проводка — `subscription_payment`
  (дебет источника + кредит оператора 100% Компания).
- Grace 48 ч сохраняет льготы; аннулирование **сбрасывает акционную цену**
  (199 → 599, promo_code=null) — механика price-lock §A2 (остаток задачи
  sub-price-lock — сверка с каноном).
- Активация из клиента (SZ-056): `POST /subscription/activate`
  (routes/api.php:252) — подключение/возобновление оплатой **только с внутреннего
  счёта** (решение владельца 18.09: рекуррента и привязки карты на старте нет);
  промо 199 ₽ — по коду Амбассадора, иначе 599 ₽; честные 409/422.
- Гейт по промокоду (SZ-057): активация без промокода — 403; за подписку
  выдаётся **личный промокод**. Кнопка в статус-блоке «Счёта и операций»
  (app 9959eb0) с честными состояниями (активна до {дата} / grace / без средств).
- Латентный баг крона исправлен (0dd26e9): ключ оператора читается из
  `payments.split.operator_partner_id` — старый путь давал бы 500 и гасил
  подписки в grace.

## Выплаты (SZ-054, реализовано 18.09; банковское исполнение — руками)

- Таблица `payouts`: push|pull, идемпотентность push за день
  unique(account, type, for_date), суммы amount/net/commission, bearer,
  статус pending→sent. Колонка `users.legal_status` (nullable — презумпция НПД,
  решение §A6); флаг `accounts.payouts_blocked` (минус-баланс блокирует исходящие).
- **Pull (НПД)**: `POST /v1/payout/request` (routes/api.php:258,
  PayoutService.php:52). Гейты: подписка `grantsBenefits()` (:56), legal_status
  ≠ ip/ooo (:62), не blocked (:72–74), минимум 100 ₽ (:83). Тариф: ≥ 3 000 ₽ →
  комиссия 1% платит **ОПЕРАТОР** (получателю 100%), < 3 000 ₽ → **30 ₽**
  удержание из суммы (platform +30 ₽ сразу, :119).
- **Push (ИП/ООО)**: команда `payouts:push-daily` в 09:00 МСК — реестр по
  partner-счетам (amount=баланс, комиссия 0,5% bearer=operator, :238); минус →
  payouts_blocked (:200–212); нет подписки/моста → пропуск со счётчиком.
  Проводки Payout + PayoutCommission (F-049 закрыт — тип использован).
- ⚠️ **Банк пока не исполняет**: с 20.09 есть тестовый контур (tbank-mock,
  см. [12](12-finkontur-v-kode.md)) — staging-ядро на моке, но интеграция
  push/pull-выплат с API мока не сделана; до неё реестр уходит в интернет-банк
  **руками** (статус pending; config/payouts.php — тарифы в комментариях §C2 #1).
  Репетиция реестров на моке — задача Б-5 ([00](00-zapusk-chego-ne-hvataet.md)).

## ПЭП-реестр НПД (SZ-055, реализовано 18.09)

- Таблица `pep_reports` (payout_id unique, payload jsonb, content_hash,
  otp_hash + expiry, статус pending|signed); домен `app/Domain/Compliance/`
  (PepReportService — issue/confirm/resend + verifyIntegrity; canonical-hash
  переживает пересортировку jsonb-ключей).
- Хук в `PayoutService::requestPull`: после коммита выплаты создаётся документ
  и уходит пуш «Код: N …»; сбой пуша не роняет (resend). API:
  `GET /pep/reports/pending`, `POST /pep/reports/{report}/confirm|resend`
  (routes/api.php:263–266). Подпись = код из пуша (решение владельца §C2 #4:
  достаточно до запуска и реальных чеков).

## Уровни карты PAY/PASS/VIP (SZ-058, 19.09)

- API уровней появился: `GET /v1/wallet` отдаёт `turnover_kopecks` — оборот
  по карте = Σ CONFIRMED платежей за **последние 30 дней** (скользящее окно от
  confirmed_at, WalletResource.php:39; решение владельца 18.09).
- Уровни: PAY (база) → **PASS** (активная подписка, см. выше) → **VIP**
  (оборот ≥ 300 000 ₽/30 дней; PARAMS). Приоритет VIP > PASS > PAY. Скин карты
  в app от реального статуса (b3460ee).

## Экраны app

- `/profile/wallet` «Счёт и операции»: контуры money/points; вкладка «Баллы» —
  только для личного счёта (ProfileWallet.vue:77–121). Экран «Мои баллы» удалён,
  redirect на wallet с `?tab=points` (router/index.ts:288–296). Блок «Подписка
  LOVII PASS» в статус-блоке экрана (SZ-056/057) — CTA «Подключить/Возобновить»,
  бейдж уровня и скин карты от реального статуса.
- «Карта»: сущности банковской карты НЕТ. Есть `Card` — внутренний идентификатор
  владельца счёта (16 цифр, Лун, пулы 9138/9142, выдаётся при регистрации —
  SendOtpAction.php:54, Card.php:10–24); номер **на счёт** в app рисуется на
  клиенте из FNV-хэша account_id с BIN 9643 (pay-card.ts:18–98).
  Уровни PAY/PASS/VIP — теперь от данных API (turnover/подписка, см. выше);
  pay-tier.ts статика осталась как фолбэк.
- **Личная карта PAY показывает баллы кошелька** (app fc8f780, SZ-045 §5.1):
  PayCard с пропом balanceUnit — personal-карта биндится на `wallets.balance`
  (unit «б.», label «Баллы»), company/nominal — рубли; пустая история —
  нейтральная подсказка. Регресс-тест юнита баланса.
- Лента операций: `subscription_payment` фильтруется по знаку (фикс 19.09,
  e93aece); подписка попадает в фильтр «Списания».

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

## Чего нет / ограничения (факты, на 19.09)

- **Банковское исполнение выплат** — нет: pull/push создают записи и проводки,
  но деньги из банка не уходят (тестовый контур Т-Банка ждётся; реестр — руками).
- **Внешняя карта в каскаде подписки** — каркас (попытка = failed
  `external_unavailable`); реальное снятие появится с банковским контуром.
- **P2P-переводы** — не реализованы (карточка SZ-NNN-p2p-transfers, P2; тарифная
  сетка и лимиты утверждены — gemini-code-1789669703545.md).
- Карта LOVII PAY как витрина счетов (банковская карта, привязка к счёту) —
  не собрана; номер на счёт рисуется клиентом (FNV).
- Доход представителя/амбассадора (экран/API «Доход») — по-прежнему ноль всегда.
- Фискальные чеки (ККТ) — отсутствуют.
- Сгорание баллов убрано (решение владельца), механизм expiration отсутствует.
- Таблицы `subscriptions`/`payouts`/`pep_reports` на staging **живые, но пустые**
  (SQL 19.09: 0 строк) — реальных подписок и выплат ещё не было.

## Кандидаты в «не хватает» (решает владелец)

1. Активное правило лояльности в БД (earn_percent) — без него кэшбэк не начисляется;
   проверить на staging/prod перед релизом.
2. ~~API уровней карты (PAY/PASS/VIP)~~ — сделано 18–19.09 (подписка + turnover).
   Остаток: карта-витрина LOVII PAY (контур «Зет») — банковская сущность карты.
3. Доход представителя (эндпоинт + экран) — сейчас ноль всегда.
4. ~~Подписка 599/199 + включение гейта доли~~ — сделано (SZ-052/053/056/057,
   EC-11 включён на staging). Остаток P2: sub-price-lock — сверка с каноном.
5. ~~Вывод средств~~ — каркас сделан (SZ-054/055); остаток = **тестовый контур
   банка** и автоматическое исполнение реестров (сейчас руками).
6. P2P-переводы (P2) и «Каникулы с компанией» (P3) — утверждены, не начаты.

## Сверка владельцем

(пока пусто)

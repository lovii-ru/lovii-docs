# 04. Баллы, кошелёк, счета, платежи — как есть

> Срез: 2026-09-17, **обновлено 2026-09-19** (дельта 18–19.09: подписка LOVII PASS,
> выплаты, ПЭП, VIP-оборот — разделы «Подписка», «Выплаты», «ПЭП»; старые факты —
> по срезу 17.09) и **2026-09-22** (дельта 20.09: тестовый контур tbank-mock —
> раздел «Выплаты»; личная карта показывает баллы — «Экраны app»). Рабочая
> заметка (класс W), не канон. Числовые параметры — канон `lovii_docs/canon/PARAMS.md`
> / договор Т-Банка. Формат — [README](README.md).
> **2026-09-25** (дельта 23–25.09: переводы PAY/Business — раздел ниже).
> **2026-09-29** (дельта 26–29.09: канон «PAY = баллы» реализован — T-023
> Фазы A/B в staging; каскад подписки инвертирован PAY→Business; переводы
> «по любому реквизиту», карта компании = адресат; провижининг МСП при
> апруве — сразу счёт + карта). **2026-10-04** (аудит Super Z: мок-исполнение
> выплат 30.09, П-8 доходы 30.09, карты — SZ-081 — отметки по тексту).

## Что это

Два денежных контура: **баллы лояльности** (кэшбэк за заказы, списание в чекауте)
и **рублёвые счета** (ledger: 90% точке, пул платформы 40/40/20). Платежи —
эквайринг Т-Банк (двухстадийный). Поверх них: **подписка LOVII PASS** (599/199 ₽,
SZ-052/053/056/057), **выплаты** (pull НПД + суточный push-реестр, SZ-054) и
**ПЭП-реестр** (SZ-055). Внешняя банковская карта (реальный эмитент) —
**не реализована**: карта в системе = счёт (детерминированные номера — SZ-081).

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
- `GET /wallet`: PAY-балл + card_number/card_number_formatted (WalletResource.php:28–34,
  номер отдаёт сервер — CardNumberIssuer).
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
  ~~Business → PAY → внешняя карта~~ **актуализация 29.09 (T-023 Фаза B,
  PR lovii-core#14, merge `132d30c`): каскад инвертирован — PAY (балльный
  кошелёк) по умолчанию → Business фоллбэком** (решение владельца 26.09 №2,
  закрытие F-059/F-067); проводка кошелька — `subscription_debit`, фоллбэк
  пишется парой ledger-строк `subscription_payment` c `meta.fallback=true`;
  fail-попытки в wallet_transactions не пишутся. Внешняя карта — прежний
  каркас (попытка = failed `external_unavailable`). Cron `subscriptions:charge`
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
- ~~⚠️ **Банк пока не исполняет**: ... интеграция push/pull-выплат с API мока не сделана~~ —
  **устарело (30.09, Б-5 первая половина)**: push-реестр и pull-выплата
  **исполняются через API tbank-mock** — `/e2c/v2/{Init,Payment,GetState}`,
  `TBankPayoutClient::fromChannel()` + `PayoutExecutionService` (pull гейтится
  подписанным ПЭП, комиссия ОПЕРАТОРА при исполнении), команда `payouts:execute`
  — **в крон только после «го» на боевой контур**. До банка осталось: боевой
  доступ 👤 + маршрут до получателя из `partner_payout_accounts`/карт НПД
  (репетиция на моке — готова).

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
- «Карта»: ~~сущности банковской карты НЕТ~~ — **уточнено 03.10 (SZ-081)**:
  в БД есть таблица `cards` (миграция 15.09, пулы 9138/9142/9000) — внутренний
  идентификатор владельца счёта; `Card` — карта счёта, не банковская карта.
  Номер карты счёта — детерминированный из account_id (BIN+FNV-1a+Луна):
  клиент рисует из account_id (pay-card.ts:18–98 — зеркало алгоритма),
  **ядро воспроизводит тот же алгоритм** (`LoyaltyCardNumber`, решение SZ-081
  28.09 — жёсткий контракт двух репо), а **API отдаёт номер с сервера**
  (`GET /wallet` `card_number`, WalletResource.php:28–34, `CardNumberIssuer`);
  выдача при регистрации — SendOtpAction.php:54, личная карта провижинится
  с этим же номером (F-071). Уровни PAY/PASS/VIP — от данных API
  (turnover/подписка, см. выше); pay-tier.ts статика осталась как фолбэк.
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
  доверяется** — статус перечитывается GetState (:54); confirmed назад не
  откатывается (:148–158); confirmed → created→submitted + кэшбэк + пул
  (:169–183); refunded/reversed/chargeback → возврат кэшбэка + зеркальный
  разворот пула (:185+). Линейки — на срезе core `333373d` (22.09).
- **Кэшбэк из доли точки** (T-014, core `333373d` 22.09 01:00): на CONFIRMED
  `earnFromOrder` начисляет баллы клиенту и проставляет `bonus_earned`, затем
  `DistributeOrderPoolAction` дебетует счёт точки: `cashback` (−100% кэшбэка)
  и `cashback_fee` (−25% от кэшбэка → Компания/реп/амб 10/10/5%), зеркала —
  на номинальном; в клиентской ленте списания нет — оно в ledger_entries
  счёта точки и выписке номинального. До `333373d` дебета не было
  («нарисованный» кэшбек — дыра приёмки 22.09, F-058). Без активной
  `loyalty_rules` (earn_percent) кэшбэк молча нулевой (LoyaltyService.php:29–36).
- Заглушка dev/staging: `PAYMENTS_FAKE`
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

## Чего нет / ограничения (факты, на 25.09; актуализация 04.10)

- ~~**Банковское исполнение выплат** — нет... реестр — руками~~ — **устарело
  (30.09)**: тестовый контур исполняет выплаты через API мока (`payouts:execute`);
  **боевое исполнение** — нет: ждёт доступ банка (Б-5 вторая половина) и «го»
  на крон.
- **Внешняя карта в каскаде подписки** — каркас (попытка = failed
  `external_unavailable`); реальное снятие появится с банковским контуром.
- ~~**P2P-переводы**~~ — **реализованы 24.09** в core и app, включая переводы
  между PAY и собственным Business-счётом. Открытый технический разрыв: клиент
  показывает и ограничивает ввод дефолтными лимитами, а не значениями,
  изменёнными суперадмином на backend (см. «Рантайм-лимиты переводов»).
- ~~Карта LOVII PAY как витрина счетов (банковская карта, привязка к счёту) —
  не собрана; номер на счёт рисуется клиентом (FNV)~~ — **устарело (правка
  03.10 по замечанию владельца)**: карта счёта есть и в БД — таблица `cards`
  (с 15.09, пулы 9138/9142/9000); номер детерминированный из счёта
  (BIN+FNV-1a+Луна) и **отдаётся сервером** — `GET /wallet` `card_number`
  (SZ-081, WalletResource.php:28–34). Нет по-прежнему только **внешней
  банковской карты** (реальный эмитент). Детали — as-is/12 «Чего НЕТ в коде».
- ~~Доход представителя/амбассадора (экран/API «Доход») — по-прежнему ноль всегда~~ —
  **устарело (30.09, П-8 закрыто)**: `RoleIncomeQuery` из ledger,
  `GET /representative/income`, экраны в app (RepresentativeIncome.vue /
  AmbassadorIncome.vue) — доход считается по реальным проводкам.
- Фискальные чеки (ККТ) — отсутствуют.
- Сгорание баллов убрано (решение владельца), механизм expiration отсутствует.
- ~~Таблицы `subscriptions`/`payouts`/`pep_reports` на staging **живые, но пустые**
  (SQL 19.09: 0 строк)~~ — **устарело**: с 22.09 есть живые данные — активная
  подписка Основателя (G5), контрольные заказы №375/№442, account_transfers 9
  (снимок 30.09, [11](11-baza-dannyh.md)).

## Дельта 23–25.09

### Переводы PAY / Business (Transfers 2.0, реализовано 24.09)

- **Модель и API:** добавлена таблица `account_transfers` с суммой, комиссией,
  тарифом, источником, статусом и meta
  (`2026_09_24_100000_create_account_transfers_table.php:17–27`); три
  авторизованных endpoint — предрасчёт, resolve получателя и исполнение
  (`routes/api.php:295–298`). В app экран доступен по `/profile/wallet/transfer`
  только авторизованному пользователю (`router/index.ts:298–313`).
- **Направления:** API принимает `pay→user`, `pay→business` и `business→pay`
  (`ExecuteTransferController.php:19–24, 29–50`). В app при наличии своего
  Business-счёта видны выбор источника «Баллы PAY / Счёт компании» и назначения
  «Другому / Себе на счёт компании» (`ProfileTransfer.vue:294–317`);
  `PAY→Business` и P2P используют общую сетку, `Business→PAY` — 0%. Нулевая
  ставка не отключает проверки суммы: `executeBusinessToPay()` всё равно вызывает
  `assertAmount()`, поэтому серверный минимум и максимум применяются к обоим
  внутренним направлениям; резерв проверяется только для списания PAY
  (`TransferService.php:195–223, 288–316`).
- **Адресация получателя:** `TransferResolver` последовательно ищет по телефону
  (11 цифр), активному личному промокоду представителя и номеру карты LOVII PAY
  (13+ цифр), возвращая способ в `via`
  (`TransferResolver.php:21–27, 31–90`). `/account/transfer/resolve` показывает
  имя и маскированный телефон, а саморазымен не раскрывает
  (`ResolveTransferDestinationController.php:23–35`). Выбранный UI-чип
  `destination_type` не ограничивает поиск: контроллер всё равно передаёт
  resolver строку и лишь записывает выбранный способ в meta
  (`ExecuteTransferController.php:66–89`; `ProfileTransfer.vue:319–326`).
- **Комиссия и история:** предрасчёт идёт по тарифной сетке; получатель получает
  сумму, отправитель списывает сумму и комиссию, а комиссионная проводка идёт на
  partner-счёт оператора (`TransferService.php:35–47, 84–100, 166–182,
  302–399`). В кошельке у отправителя создаются отдельные
  строки `transfer` и, при комиссии больше нуля, `fee`; у получателя — одна
  положительная строка `transfer` с именем и маской контрагента
  (`TransferService.php:102–134, 340–355`;
  `WalletTransactionType.php:18–21`). Направление `transfer`/`fee` в app
  определяется знаком суммы (`wallet-history.ts:22–28`).

### Рантайм-лимиты переводов

- **Фактические дефолты staging:** минимум 100 ₽, максимум 3 000 ₽,
  неснижаемый остаток PAY 100 ₽; тариф — семь ступеней от 0,5% с шагом
  0,5 п.п. (полная сетка — `config/transfers.php:12–29`). Ядро перед каждым quote и
  execute читает `payment_settings` по ключам `transfers.min_kopecks`,
  `transfers.max_kopecks`, `transfers.reserve_kopecks`; числовой override сильнее
  env-конфига и применяется без выкладки (`TransferService.php:415–445`).
- **Изменение без деплоя:** CLI `transfers:set-limit --max/--min/--reserve`
  записывает значения в эти ключи; `--reset` удаляет overrides и возвращает
  env-дефолты (`SetTransferLimitCommand.php:19–55`).
- **Клиентский разрыв:** app не получает runtime-настройки, а дублирует дефолты
  100/3 000/100 и свою сетку в константах (`ProfileTransfer.vue:74–90`), после
  чего ужимает введённую сумму до 3 000 ₽ и до доступной суммы с резервом
  (`ProfileTransfer.vue:103–145`). Поэтому backend может принять сумму выше
  3 000 ₽ после правки суперадмином, но UI продолжит показывать и ограничивать
  старый максимум.
- ~~**Расхождение с `PARAMS.md`:** `PARAMS.md:3–7` объявляет единый источник
  истины, однако версия 1.6 не содержит P2P-лимитов и тарифов.~~ —
  **устарело (закрыто владельцем 04.10, Б1 аудита)**: дефолты канонизированы
  в `PARAMS.md` **§1.9 (v1.7)**. Иерархия по решению владельца: настройка
  суперадмина в админке (`payment_settings`) сильнее дефолтов; дефолты кода
  равны канону; при отсутствии настроек и в спорных/конфликтных случаях
  действует канон §1.9. Значения этого раздела совпадают с §1.9 (совпадение
  с `PAY_POINTS_MODEL.md:78–85` также подтверждено).

## Кандидаты в «не хватает» (решает владелец)

1. Активное правило лояльности в БД (earn_percent) — без него кэшбэк не начисляется;
   проверить на staging/prod перед релизом.
2. ~~API уровней карты (PAY/PASS/VIP)~~ — сделано 18–19.09 (подписка + turnover).
   Остаток: карта-витрина LOVII PAY (контур «Зет») — банковская сущность карты.
3. ~~Доход представителя (эндпоинт + экран) — сейчас ноль всегда~~ — **сделано
   30.09** (П-8: `RoleIncomeQuery`, `/representative/income`, экраны app).
4. ~~Подписка 599/199 + включение гейта доли~~ — сделано (SZ-052/053/056/057,
   EC-11 включён на staging). Остаток P2: sub-price-lock — сверка с каноном.
5. ~~Вывод средств~~ — каркас сделан (SZ-054/055); ~~тестовый контур~~ — **мок
   работает с 30.09** (`payouts:execute`); остаток = **боевой банк** (доступ 👤,
   «го» на крон).
6. ~~P2P-переводы (P2)~~ — **реализованы 24.09** (см. «Дельта 23–25.09»; остаток
   — клиентский разрыв рантайм-лимитов, выше). «Каникулы с компанией» (P3) —
   утверждены, не начаты.

## Сверка владельцем

- **2026-09-22 (волна 1, Блок Б — дизайн-приёмка, staging):** кошелёк
  SZ-041B принят — «выглядит как банк», чек-лист 7/7 PASS (хедер, карусель,
  флип, баланс+динамика, уровни PAY/PASS/VIP, история, баллы); карты
  SZ-044 приняты — «все ок», три карты различимы (LOVII PAY / BUSINESS /
  NOMINAL), номинал «технический». Оговорка владельца про инцидент оплаты —
  вне скоупа (T-014, Б-10 в [00](00-zapusk-chego-ne-hvataet.md)).
- **2026-09-22 (вечер, Блок А — Шаг A):** оплата по публичной ссылке —
  прошла (T-014 PASS); кэшбэк-списание не увидено владельцем → маршрут
  разобран по коду (F-058): фикс `333373d` добавил дебет доли точки +
  комиссию 25% с раскладкой 40/40/20, нужен контрольный прогон после
  деплоя и проверка `loyalty_rules`; копирование кода/ссылки в кабинете
  не работает (F-058, доработка T-014; переоформление подписки — T-016).

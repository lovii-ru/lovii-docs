# 05. Роли и кабинеты (реп / амб / МСП) — как есть

> Срез: 2026-09-17, **обновлено 2026-09-19** (кабинет МСП v2: свитчер юрлиц и
> «+ Бренд»/«+ Точка»; подписка; T-010 промокод при подтверждении номера) и
> **2026-09-22** (дельта 20–21.09: три пути верификации заявки, реестр оферт,
> роутинг заявки по промокоду профиля, кабинеты платформы). Рабочая заметка
> (класс W), не канон. Числа (доли 40/40/20, подписка 599/199) — канон
> `PARAMS.md`. Формат — [README](README.md).
> **2026-09-25** (дельта 23–25.09: см. раздел ниже).

## Что это

Три совмещаемые роли поверх клиента: Представитель (промокод, приём заявок точек),
Амбассадор (ветка по префиксу, обучение), МСП (кабинет точки в app). Флаги ролей —
производные, отдельной таблицы ролей нет.

## Флаги ролей

`GET /profile` → `roles{}` (UserProfileResource.php:35–50):

| Флаг | Истинность |
|---|---|
| representative | есть активный `representative_promo_codes` (User.php:119–122) |
| ambassador | строка в `ambassadors` с is_active (User.php:124–127) |
| msp | есть запись в `lovii_b2b.partner_users` по core_user_id (:43–50) |

Нюанс: msp-флаг = факт PartnerUser, membership не проверяется — флаг может быть
true при битом кабинете (нет membership → `partner_not_found`).

## Промокоды и амбассадоры

- `representative_promo_codes`: code(6) = prefix(2, ветка амба) + suffix(4,
  случайный, алфавит без 0/1/I/O); частичный unique — один активный на юзера
  (RepresentativePromoService.php:23–89). Смена кода деактивирует старый; снимки
  на заявках не трогаются.
- Артан-команды (UI нет): `roles:issue-promo {phone} {--prefix=AA}` (печатает
  ссылку на форму МСП), `roles:assign-ambassador {phone} {prefix}` — амба
  назначает только Основатель вручную (AssignAmbassadorCommand.php:12–14).
- Иерархия rep→amb — **только по префиксу**, дерева нет
  (ListAmbassadorRepsController.php:18–19).
- `users.promo_code(6)` nullable — добавлена 2026-09-14 (промокод на этапе
  регистрации, миграция 2026_09_14_120001).

## Заявка МСП (partner_applications)

Полный enum статусов (PartnerApplicationStatus.php:19–37): `draft, submitted,
awaiting_rep_approval, invoice_issued, awaiting_payment, verifying, verified,
failed, expired`.

**Реально в коде существуют переходы** (с 20.09 верификация автоматизирована —
три пути, см. ниже):

| Переход | Кто | Где |
|---|---|---|
| создание → submitted (без промокода) / awaiting_rep_approval (с ним) | система | CreatePartnerApplicationAction.php:103–105 |
| awaiting_rep_approval → invoice_issued (апрув репа) / failed (reject) | реп | ApprovePartnerApplicationAction.php:34, RejectPartnerApplicationAction.php:29 |
| invoice_issued → awaiting_payment → verifying → verified | **автоматика (20.09)**: VER-платёж / прогон рубля / кнопка админки | MatchIncomingVerificationAction, RunPartnerVerificationAction, VerifyPartnerAction |

**Три пути верификации заявки (дельта 20.09 — в staging, закрывают Б-3/Б-4
из [00](00-zapusk-chego-ne-hvataet.md)):**

1. **Самосервисный VER-платёж** (решение владельца 20.09): МСП отправляет 1 ₽ со
   своего р/с (кнопка кабинета → `POST /msp/payment/sent`), банк/мок создаёт
   поступление и уведомляет платформу (`POST /payments/tbank/incoming`),
   `MatchIncomingVerificationAction` матчит **VER-код + ИНН + сумму** — гейт
   verified открывается сам, реквизиты плательщика становятся первой «карточкой
   компании» (`partner_payout_accounts`, lovii_b2b). Тесты VerificationIncomingTest
   4/4, дубль платежа покрыт.
2. **Автопрогон «рубля» через банк при аппруве представителя** (core 63b9d9d):
   `AccountVerificationClient` (канал через PaymentChannelManager) +
   `RunPartnerVerificationAction` — `verified_at` за секунды без ручных шагов;
   отказ банка → `failed`.
3. **Ручная из админки** (инструмент-исключение): `POST /api/internal/v1/partners/{id}/verify`
   (гейт I-5, Scout-реиндекс, повтор → 409 `partner_already_verified`, строка в
   `partner_audit_logs`); кнопка в lovii-admin (`INTERNAL_ADMIN_SECRET` —
   совпадает в core и admin).

- **Реестр приёма оферт (20.09)**: `partner_offer_acceptances` — append-only,
  одна строка на создание заявки (дата/время приёма, телефон, ИНН, флаги
  offer/pdn); пишется в `CreatePartnerApplicationAction` в обеих ветках,
  ресабмит не дублирует; миграция бэкфиллит существующие заявки.
- **Роутинг заявки по промокоду ПРОФИЛЯ (20.09)**: раньше ядро читало только
  `promo` из запроса (форма шлёт null) → заявки всегда уходили в `submitted` и
  не доходили до представителя. Теперь явный `promo` запроса старше, иначе
  мягкий резолв `users.promo_code` (только активный реп-код) — заявка уходит
  в `awaiting_rep_approval` и видна в `GET /representative/approvals`;
  амбассадорский код заявку не блокирует. Правило ИНН SZ-050 Ф2 не тронуто.
- Инсталляционный платёж 1 ₽ (100 коп., config/roles.php:14–27): VER-код
  `VER-<partner_id>-<суффикс>` собирается на лету (PartnerApplication.php:62–69),
  отдаётся в `GET /msp/payment`; матчинг входящего платежа — **реализован
  (20.09)**, путь №1 выше.
- Апрув репа: только владелец промокода (403), только из awaiting_rep_approval
  (422); ставит `partners.representative_approved_at` (гейт teaser витрины) и
  выпускает бизнес-карту (ApprovePartnerApplicationAction.php:28–84).
- Материализация в момент создания заявки: Partner (verified_at=null) + PartnerUser
  + membership owner (:249–270), Merchant `pending_moderation` (:115–129), филиал-
  черновик только при lat/lon+городе (:282–311).
- Промокод на заявке — снимок при создании; перепривязки нет.
  **T-010 (18.09, сделано)**: привязка промокода при подтверждении номера —
  любой суффикс `?ключ=значение` в ссылке (кроме резервных token/cart_id/utm_*)
  — носитель промокода; форма «Введите промокод» сохраняет ввод; ядро валидирует
  `referral_code` по `representative_promo_codes` и пишет в `users.promo_code`
  (только на пустое — идемпотентно; не-код/неизвестный — тихий игнор).
  Реп-профиль QR-ссылка `origin/?ref=КОД` (RepresentativeProfile.vue:25–28).

## Кабинет МСП v2: юрлицо → бренды → точки (SZ-050 Ф1–Ф2, 17.09)

- **Свитчер юрлиц в шапке** (паттерн СберБизнес): чип с ИНН-маской → шит
  «Мои юрлица» + «Добавить юрлицо»; контекст фильтрует Обзор/Заказы/Товары/
  Настройки/Команду; обзор отдаёт `partner_id`/`partner_name` мерчанта
  (core f2a4f06) — все юрлица, включая пустые.
- **«+ Бренд»**: `POST /msp/merchants` — бренд (= магазин) под своим юрлицем,
  право merchant.create. **«+ Точка»**: `POST /msp/branches` — точка под брендом,
  адрес геокодирует серверный Яндекс-геокодер (точке нужны city_id и координаты).
  CTA в пустых состояниях Обзора и в шапке «Рабочей точки».
- **Правило ИНН (закрывает дубли юрлиц)**: заявка с ИНН уже верифицированного
  своего юрлица (без промокода) → новый бренд в существующее юрлицо + заявка
  сразу Verified, без счёта 1 ₽; новый ИНН → новое юрлицо. Дубль «Пончики»
  (partner 271) слит в 263 — «Пончики» = второй бренд АТМОСФЕРЫ.
- Терминология в интерфейсах: юрлицо → бренд → точка; платформенный минимум
  в настройках называется «рекомендованный минимальный чек» (2e1ff81).

## Кабинеты платформы «Владелец»/«Инвестор» (дельта 21.09 — в staging)

- `GET /platform/owner` (founder-only, FounderQuery): KPI периода
  (week | 30d | month | quarter | all, по умолчанию 30d — решение владельца
  19.09): GMV по подтверждённым платежам, комиссия компании (pool_share
  split_role=company), LOVII PASS (subscription_payment), сальдо платформы
  (inflow − outflow по счёту оператора); GMV по месяцам (русские подписи —
  явный массив, локаль контейнера не гарантирована); юрлица (GMV, точки,
  верификация); точки платформы постранично (топ по выручке).
- `GET /platform/investor`: GMV, пользователи (всего + по месяцам), точки
  (активные/всего), средний чек, топ-5 точек, сальдо платформы, доля инвестора
  (`payments.investor_share`, по умолчанию 0.15), дивиденды = положительное
  сальдо × доля (при минусе — честный ноль).
- `GET /platform/overview` — пагинация операций и выплат
  (operations 20/макс 100, payouts 10/50, `meta.*.has_more`), обратная
  совместимость без параметров.
- App: `/cabinet/owner`, `/cabinet/investor`, `/cabinet/platform` (session 125).
  Честные цифры (PRODUCT_QUALITY_BAR): OPEX/CAPEX в системе не ведутся — в
  расчёты не входят, фронт подписывает это на карточках («сальдо банковского
  контура»); демо-заглушек нет. Тесты PlatformDashboardsTest 10 passed.

## Кабинет МСП в app

- Роуты `/cabinet/msp/*`: обзор, payment, orders, orders/:id, products, settings,
  team, starter (router/index.ts:609–709); табы с ability-проверками PartnerRole.
- Мультифилиальность (фаза D): селектор «Рабочая точка» в Обзоре
  (MspOverview.vue:428–470), `activeBranchId` в localStorage `loviMspBranchId`
  (msp.store.ts:14–29), branch_id во всех msp-запросах; чужой филиал → 404
  `branch_not_found` (MspAccess.php:69–89).
- Настройки точки из app: `PATCH /msp/branch/settings` — name, address_line,
  часы (24ч-селекты), min_order_amount_rubles (UpdateMspBranchSettingsController.php:33–71;
  право owner/manager). **Тумблеры доставки из app не меняются** (их в API нет —
  только b2b).
- Обновление 18.09: `min_order_amount_rubles` — 0/null → NULL, 1..499 ₽ →
  422 `min_order_amount_too_low` (пол 500 ₽ из конфига); ресурс отдаёт
  `min_order_amount_effective` (см. [02](02-korzina-checkout.md) «Минимум
  заказа»); смена `address_line` теперь **геокодируется** — location и city_id
  пересчитываются (репро владельца: точка пропала из каталога после переезда
  МСК→СПб, core `728f31e`); если геокодер не настроен/адрес не найден — текст
  сохраняется, координаты не трогаются, в ответе `address_geocode_warning`
  (app показывает тостом, `ae08535`; подробнее [08](08-dostavka-adresa-geo.md)).
- Карточка магазина: `PATCH /msp/merchant` (название/описание/логотип).

## Команда точки

- Роуты: `GET /msp/team`, `POST /msp/team/invitations`, `PATCH
  /msp/team/{membership}/role`, `DELETE /msp/team/{membership}` (routes/api.php:292–301).
- Приглашение по телефону, роль по умолчанию operator; manager — только при
  ability team.update_role (CreateMspInvitationController.php:41–64).
- Правила (MspTeamActions.php:45–243): себя нельзя, роль цели ≥ своей нельзя
  (owner rank 3 неприкосновенен), админ — только в своих филиалах, выдать можно
  manager/operator не выше своей роли; отзыв = suspended (не удаление); аудит
  `team.role_updated`/`team.revoked`; чужой/отозванный → 404 `member_not_found`.
- Роли: owner/manager/operator/catalog_editor (PartnerRole.php:22–94); manager
  имеет team.update_role/revoke (решение владельца 2026-09-16, SZ-047).
- Отдельный кабинет команды `/cabinet/team` (TeamOrders/TeamProducts/TeamTeam;
  товары и команда — manager-only), teamGuard с редиректом manager/operator на
  заказы (router/index.ts:716–758).

## Кабинеты репа и амбассадора

- Реп `/cabinet/representative` — Обзор (KPI: заявки, активные точки, доход 0
  «финконтур ещё не подключён»), Точки, Заявки (очередь апрувов), Доход (0 ₽),
  Профиль (промокод + **QR есть** — инлайн-SVG, реф-ссылка `?ref=КОД`).
- Амб `/cabinet/ambassador` — Обзор (prefix, reps_count, points_count, доходы 0),
  Структура (активные промокоды префикса), Обучение (статический трек из конфига,
  progress 0), Доход («честный ноль»). **QR у амба нет**.
- Чаты в обоих — заглушка «скоро» (ChatStub.vue:14–21), эндпоинтов в core нет.

## Права

- Гварды core: `role.representative` / `role.ambassador` → 403 «Представительские
  / Амбассадорские инструменты недоступны» (EnsureRepresentative.php:24);
  `/msp/*` без партнёрства → 404 `partner_not_found`.
- Гард app `rolesGuard`: без флага — редирект на профиль (не 403); manager/operator
  МСП автоматически уводятся в кабинет команды (teamToOwnCabinet).

## Чего нет (факты, на 22.09)

- Доходы репа и амба — всегда ноль (UI-хардкод / API `amount: 0`); `rank` в
  профиле репа — null. `subscription` в профиле репа — теперь из API
  `GET /v1/subscription` (см. [04](04-bally-koshelek-platezhi.md)); без подписки
  и при включённом гейте EC-11 доля пула репа уходит Компании.
- Ранги Мэр/Губернатор (30+/90+) — только в демо; в core нет.
- Чаты — заглушки. ~~Карточки «Владелец»/«Инвестор» в профиле — never-rendered~~ —
  **реализованы 21.09** (раздел «Кабинеты платформы» выше).
- ~~Верификация заявки (invoice → verified) не автоматизирована~~ — **закрыто
  20.09**: три пути (см. раздел «Заявка МСП»); вне кода остались только боевой
  банк (см. Б-5 в [00](00-zapusk-chego-ne-hvataet.md)) и инвойс PDF.

## Дельта 23–25.09

### `staging`: заявка МСП и настройки приложения

- **Контракт `activity_type` в core сделан необязательным.** Валидация принимает `sometimes|nullable` и enum (`lovii-core/app/Http/Requests/Api/V1/CreatePartnerApplicationRequest.php:26-28`), а оба пути создания записи сохраняют отсутствующее значение как `null` (`lovii-core/app/Domain/Business/Actions/CreatePartnerApplicationAction.php:120-123,306-310`); миграция `activity_type` в `nullable` — `lovii-core/database/migrations/2026_09_25_100000_make_partner_application_activity_type_nullable.php:9-21`.
  - Это изменение **не доведено до staging-app**: форма всё ещё показывает «Тип деятельности» (`lovii-app/src/modules/business-module/BusinessApply.vue:171-176`), делает выбор обязательным (`lovii-app/src/modules/business-module/composables/use-business-form.ts:83-85`) и отправляет значение в payload (`lovii-app/src/modules/business-module/composables/use-business-form.ts:110-115`; тип клиента остаётся non-nullable — `lovii-app/src/modules/business-module/api/business-api.ts:37-46`).
  - Ресурсы core пока не приспособлены к `null`: `PartnerApplicationResource.php:29-30` и `PartnerApplicationApprovalResource.php:29-30` обращаются к `->value`/`->label()` без guard. Это риск несогласованного nullable-контракта, а не подтверждение, что весь путь заявки уже синхронизирован.

- **DaData INN-lookup есть на backend staging.** `GET /business/inn-lookup` объявлен с `throttle:business-apply` в `lovii-core/routes/api.php:282-285`; контроллер принимает ИНН из 10 или 12 цифр, вызывает `findParty()` и возвращает ИНН, название, юридическую форму и адрес либо `404 party_not_found` / `503 lookup_unavailable` (`lovii-core/app/Http/Controllers/Api/V1/Business/LookupPartnerByInnController.php:27-58`).
  - В staging-app отдельного вызова lookup нет: `BusinessApply.vue:126-137` отправляет только заявку через store, а API-файл перечисляет submit и получение текущей заявки (`lovii-app/src/modules/business-module/api/business-api.ts:61-75`). Поэтому подтверждено наличие backend-эндпоинта, но не автозаполнение поля в мобильной форме.

- **Экран «Настройки» есть в staging-app.** Это отдельный `ProfileSettings` с разделами «Экран», «Приложение», «Уведомления» и «Безопасность» (`lovii-app/src/modules/profile-settings/ProfileSettings.vue:30-35`); пункт нижнего меню выводится в `NavBar.vue:39-43`, а маршрут `/settings` вложен в `MainLayout` (`lovii-app/src/router/index.ts:443-455`).
  - В staging-сторе нет `activeMerchantId`, `activeMerchant` или `setActiveMerchant`: state и getters содержат только выборы точки/юрлица и списки партнёров/мерчантов (`lovii-app/src/modules/roles-module/store/msp.store.ts:45-99`).

### Только feature-worktree: SZ-063, включение/выключение точки

> **Не относится к staging.** Ниже только код worktree `lovii-core-sz063` и `lovii-app-sz063` (`feat/sz063-branch-on-off`); карточка SZ-063 открыта, отдельного отчёта и приёмки нет. В staging-контрактах этих полей и методов нет: `lovii-app/src/modules/roles-module/api/roles-api.ts:332-382`, а валидация staging-core не содержит `status`/`pause_minutes` (`lovii-core/app/Http/Controllers/Api/V1/Msp/UpdateMspBranchSettingsController.php:79-133`).

- **App-контракт и UI.** `lovii-app-sz063/src/modules/roles-module/api/roles-api.ts:333-376` добавляет `status`, `paused_until_at`, `paused_until_local`, `availability` и `pause_options_minutes`; методы `mspSetBranchStatus()` и `mspPauseBranch()` — там же `:664-704`. Экран скрывает секцию состояния, если старый core не прислал `status` (`MspBranchSettings.vue:369-379`), и показывает включение, выключение и временное закрытие только при поддержке контракта (`MspBranchSettings.vue:1110-1201`).

- **Core-правила.** `lovii-core-sz063/app/Http/Controllers/Api/V1/Msp/UpdateMspBranchSettingsController.php:134-175` принимает из приложения только `active`/`inactive` или `pause_minutes`; одновременная передача обоих полей даёт конфликт. `applyStatus()` сбрасывает срок закрытия, а `applyPause()` ставит `closed` и `paused_until_at` после проверки активности (`:216-223,297-342`). Платформа отдаёт варианты `[30, 60]` минут (`lovii-core-sz063/config/branches.php:5-20`), а колонка срока добавлена как nullable с индексом (`lovii-core-sz063/database/migrations/2026_09_21_180000_add_paused_until_at_to_merchant_branches_table.php:10-31`). Для покупателя статус точки сильнее расписания (`lovii-core-sz063/app/Domain/Merchant/Services/BranchAvailabilityResolver.php:14-33`).

- **Отдельная feature-only работа SZ-076 — не часть SZ-063.** В `lovii-app-sz074` (ветка `feat/sz-076-demo-skin`) `msp.store.ts:22-24,48-53,110-120` добавляет `activeMerchantId` и `activeMerchant`, а `CabinetLayout.vue:5-6,222-226` подключает `MerchantSwitcher`/`BranchSwitcher`. Эти свитчеры нельзя приписывать SZ-063 или staging.

## Кандидаты в «не хватает» (решает владелец)

1. Инвойс PDF (выдача счёта на оплату) — путь VER-платежа его не требует,
   но классический invoice-флоу остался без документа.
2. ~~Промокод в форме заявки~~ — T-010 закрыл путь регистрации (любой суффикс
   `?ключ=` → `users.promo_code`); за подписку выдаётся личный код (SZ-057);
   роутинг заявки по промокоду профиля — сделан 20.09.
3. Доход репа/амба (эндпоинт + экраны) — всегда ноль (см. [04](04-bally-koshelek-platezhi.md)).
4. UI назначения амбассадора (сейчас только artisan) и ранги Мэр/Губернатор.
5. Тумблеры доставки точки — добавить в настройки app или зафиксировать «только b2b»
   (радиус SZ-066 уже в настройках app — см. [08](08-dostavka-adresa-geo.md)).

## Сверка владельцем

(пока пусто)

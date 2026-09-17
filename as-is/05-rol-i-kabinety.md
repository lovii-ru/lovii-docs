# 05. Роли и кабинеты (реп / амб / МСП) — как есть

> Срез: 2026-09-17. Рабочая заметка (класс W), не канон. Числа (доли 40/40/20,
> подписка 599/199) — канон `PARAMS.md`. Формат — [README](README.md).

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

**Реально в коде существуют переходы** (финконтур верификации не реализован):

| Переход | Кто | Где |
|---|---|---|
| создание → submitted (без промокода) / awaiting_rep_approval (с ним) | система | CreatePartnerApplicationAction.php:103–105 |
| awaiting_rep_approval → invoice_issued (апрув репа) / failed (reject) | реп | ApprovePartnerApplicationAction.php:34, RejectPartnerApplicationAction.php:29 |
| invoice_issued → awaiting_payment → verifying → verified | **никто — в коде переходов нет** | верификация ставится вручную (UPDATE); авто-матчинга платежа нет |

- Инсталляционный платёж 1 ₽ (100 коп., config/roles.php:14–27): VER-код
  `VER-<partner_id>-<суффикс>` собирается на лету (PartnerApplication.php:62–69),
  отдаётся в `GET /msp/payment`; матчинг входящего платежа — отсутствует
  (комментарий ShowVerificationPaymentController.php:17–18).
- Апрув репа: только владелец промокода (403), только из awaiting_rep_approval
  (422); ставит `partners.representative_approved_at` (гейт teaser витрины) и
  выпускает бизнес-карту (ApprovePartnerApplicationAction.php:28–84).
- Материализация в момент создания заявки: Partner (verified_at=null) + PartnerUser
  + membership owner (:249–270), Merchant `pending_moderation` (:115–129), филиал-
  черновик только при lat/lon+городе (:282–311).
- Промокод на заявке — снимок при создании; перепривязки нет.
  ⚠️ **Форма заявки в app промокод не передаёт** (`promo: null` —
  use-business-form.ts:123); в реп-профиле QR-ссылка `origin/?ref=КОД`
  (RepresentativeProfile.vue:25–28), а артан-ссылка — старый формат
  `/business/apply?promo=…`. Два формата ссылок — расходятся.

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

## Чего нет (факты)

- Доходы репа и амба — всегда ноль (UI-хардкод / API `amount: 0`); `subscription`
  и `rank` в профиле репа — null (RepresentativeProfileResource.php:31–34).
- Ранги Мэр/Губернатор (30+/90+) — только в демо; в core нет.
- Чаты — заглушки. Карточки «Владелец»/«Инвестор» в профиле — never-rendered
  записи без флагов (ProfileCabinets.vue:79–103).
- Верификация заявки (invoice → verified) и матчинг платежа — не реализованы.

## Кандидаты в «не хватает» (решает владелец)

1. Финконтур заявки: выдача счёта (invoice PDF), awaiting_payment → verifying,
   авто-матчинг платежа 1 ₽ — сейчас верификация только руками.
2. Промокод в форме заявки: app не передаёт promo; два формата ссылок (`?ref=` vs
   `?promo=`) — свести к одному и проверить сквозной путь «реп → точка».
3. Доход репа/амба (эндпоинт + экраны) — всегда ноль (см. [04](04-bally-koshelek-platezhi.md)).
4. UI назначения амбассадора (сейчас только artisan) и ранги Мэр/Губернатор.
5. Тумблеры доставки точки — добавить в настройки app или зафиксировать «только b2b».

## Сверка владельцем

(пока пусто)

# 09. Кабинет b2b (точки и партнёры) — как есть

> Срез: 2026-09-17. Рабочая заметка (класс W), не канон. Формат — [README](README.md).

## Что это

Filament-панель для партнёров (юрлиц) и их сотрудников: заказы (канбан),
каталог (позиции/категории), филиалы (часы, доставка, зоны), команда,
уведомления, аудит. Схема БД `lovii_b2b`; commerce-таблицы — core, пишутся
напрямую через соединение `pgsql_core`.

## Панель и структура

- Панель `partner` (путь /panel), tenancy по `Partner` (slug) —
  PartnerPanelProvider.php:40–70; пункт «Добавить компанию»; автодискавери ресурсов.
- Ресурсы (app/Filament/Resources/): Orders (OrderResource, OrderSubmissionResource),
  Catalog (PositionResource=MerchantOffer, CategoryResource), Merchants
  (MerchantResource=магазин, BranchResource=филиалы + зоны), Team
  (PartnerUserResource, InvitationResource), System (PartnerNotificationChannelResource,
  PartnerAuditLogResource, ImportJobErrorResource).
- Страницы: Dashboard (6 виджетов: верификация, статистика заказов, выручка,
  здоровье каталога, последние заказы, активность), OrderBoard (канбан),
  VerifyPartner, AddCompany, IntegrationHealth (read-only + resync).

## Данные и связь с core

- Схема `lovii_b2b` (миграция 000000); все B2b-модели на соединении `pgsql_b2b`,
  core-модели — `pgsql_core` (CoreModel.php:12). Дефолтное соединение b2b — своя схема.
- Таблицы: partners, partner_users (+partner_sessions), partner_invitations,
  partner_memberships (many-to-many юзер↔партнёр, роль, branch_ids jsonb, status),
  partner_audit_logs, partner_notification_channels, partner_ui_preferences;
  у партнёра: inn, dadata_party, **verified_at**, representative_approved_at.
- `partner_applications` живёт в **core** (public), с условным FK на
  lovii_b2b.partners; материализация черновика юрлица — оттуда.
- Cross-schema FK: `merchants.partner_id`, `merchant_branches.partner_id` →
  lovii_b2b.partners.

## Авторизация и роли

- Пользователь кабинета — `PartnerUser` со связью `core_user_id` (unique);
  **пароля нет** — вход по OTP через core API (requestCode/sendCode/confirm →
  `authenticateByOtp(coreUserId)` — CoreApiClient.php:26–55, PartnerAuthService.php:19–33).
- Доступ: статус active + активный membership; tenants = партнёры по memberships;
  лимит ≤5 неверифицированных юрлиц на юзера.
- Роли (PartnerRole.php:7–68): **owner** (всё, вкл. team.update_role/revoke,
  partner.verify, audit.view), **manager** (без смены/отзыва команды и верификации),
  **operator** (просмотры + toggle наличия + переходы/отмена заказов),
  **catalog_editor** (каталог без заказов). Проверка — `PartnerUser::grants()` по
  текущему membership. Shield/Spatie **не используются** — 13 явных политик.
- Обновление 2026-09-18: приглашать в команду может и **администратор**
  (team.invite; решение владельца 2026-09-17, b2b `d276ea6`, матрица прав и
  инвайты обновлены тестами).

## Позиции (товары)

- PositionResource: цена в рублях (хранение копейки), дерево категорий, до 10 фото
  (серверный ресайз Imagick: кап 2048px, цель ≤500 КБ, лестница качества 85/75/65 —
  ImageNormalizer.php:32–66), bulk вкл/выкл наличия, клон, inline-правка цены.
- Медиа хранятся на `catalog_products.media` (не на оффере); Product+Offer пишутся
  в одной транзакции pgsql_core.
- Привязка к филиалу (SZ-013): branch_id Select или «все филиалы» (NULL);
  при единственном активном филиале — авто-привязка.
- Реиндекс поиска: отдельного хука нет — Scout-трейт MerchantOffer сам индексирует
  при сохранении модели ( shouldBeSearchable = is_active && is_available).

## Заказы

- Канбан (8 колонок, drag-drop с проверками, поллинг 15 с) + таблица с фильтрами +
  деталка (timeline по историям статусов). Создание/редактирование запрещено
  политикой — заказы только из клиентского app.
- Скоупинг: юрлицо через merchant + whitelist филиалов оператора
  (partner_memberships.branch_ids, NULL = все).
- Действия: легальные переходы и отмена с причиной; запись в pgsql_core +
  аудит + мост в core (подробно в [03](03-zakazy.md)).
- Приватность телефона покупателя: полный номер 7 дней после completed, далее
  маска (OrderResource.php:297–323).

## Настройки точки (BranchResource)

- Часы работы (WorkingHoursField + серверный валидатор/нормализатор), тумблеры
  доставки/самовывоза, min/max_delivery_minutes, min_order_amount (ввод в рублях,
  хранение копейки), адрес с Яндекс-пикером, статус филиала, клон филиала.
- Зоны доставки — полноценный UI (см. [08](08-dostavka-adresa-geo.md)).
- Платформенный тариф точки (start/basic/pro) в b2b **не управляется**.

## Партнёры (юрлица) и верификация

- **PartnerResource не существует** — юрлица не редактируются из панели.
- Верификация: страница VerifyPartner для самого партнёра (read-only сводка
  DaData + ссылка на счёт; ability partner.verify), баннер-виджет до верификации.
- Установка `verified_at` — **только ручной UPDATE извне** (psql/Tinker из core;
  план предполагал админку lovii-admin — там ресурса на партнёров тоже нет).
  Арт. `b2b:partner:approve-representative` ставит только representative_approved_at.
- Счёт (invoice) — стаб 404 («real PDF is not implemented yet», routes/web.php:39–42).

## Аудит и фоновые процессы

- `partner_audit_logs` через AuditRecorder: merchant/branch/zone/category/product/
  offer/modifier/team/channel события + специализации (working_hours, availability,
  suspend/reactivate/role_updated); заказы — только явный order.status_transitioned.
- Планировщик: prune аудита (365 дней), prune приглашений (daily), чистка сессий
  (hourly). Очередь: Redis, отдельный docker-сервис `queue` (мост SZ-037).

## Чего нет (факты)

- Управление юрлицами (PartnerResource) и платёжные экраны — отсутствуют.
- Отправка писем из b2b — нет (b2b только управляет каналами, шлёт core).
- 2FA/SecuritySettings, «тест канала» (ждёт core-таблицу deliveries),
  восстановление пароля (паролей нет), Horizon, Sentry, /metrics — в tech-debt.
- Филиалы-«сети» без кабинета (авто-импорт) — контур отдельный (SZ-005).

## Кандидаты в «не хватает» (решает владелец)

1. Верификация юрлиц: единственный путь сегодня — ручной UPDATE в БД; нужен
   хотя бы минимальный UI (админка или b2b-страница оператора).
2. Тариф точки (start/basic/pro) нигде не переключается — поле есть, UI нет.
3. PDF счёта на заявку — стаб 404 (путь верификации платёжом живёт в app/core,
   но документ-счёт не существует).
4. Вход в b2b завязан на OTP core — при недоступности core кабинет недоступен
   (осознанно; зафиксировать).

## Сверка владельцем

(пока пусто)

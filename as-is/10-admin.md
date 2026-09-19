# 10. Админка lovii-admin — как есть

> Срез: 2026-09-17, **обновлено 2026-09-19** (первая редактируемая страница:
> платформенный минимум заказа — этап 2 №1 BACKLOG_REVIEW). Рабочая заметка
> (класс W), не канон. Формат — [README](README.md).

## Что это

Filament-панель супер-админа (`/admin`): просмотр заказов/пользователей/мерчантов,
чарджбэки, лояльность, интеграции, города, админ-пользователи (Shield).
Commerce-данные читаются из core через `pgsql_core`; **админка core-таблицы не
создаёт и не мигрирует** (правило репо, AGENTS.md:29–32).

## Состав панели

| Группа | Ресурсы | Режим |
|---|---|---|
| Заказы | OrderResource (+items/history/submissions/external states), ChargebackResource | просмотр; экшены retrySubmission, cancelOrder, процессинг чарджбэка |
| Пользователи | UserResource (+addresses/devices/orders/wallet), WalletTransactionResource, AuthOtpSessionResource, GuestSessionResource | просмотр; на юзере: блок/разблок, ручная корректировка баллов |
| Мерчанты | MerchantResource (+branches/offers/integrations), MerchantBranchResource, MerchantCategoryResource, MerchantOfferResource (+модификаторы) | просмотр + экшены статусов: activate/suspend/deactivate/featured/модерация |
| Каталог | CatalogCategoryResource, CatalogProductResource, ProductRequirementResource | CRUD каталога; requirement — список |
| Лояльность | LoyaltyRuleResource | CRUD правил (earn_percent, max_spend_percent) |
| Интеграции | IntegrationResource, ImportJobResource (+ошибки) | мониторинг + retry импортов |
| Система | AdminUserResource (ManageUsers), Roles (Shield), Activity (filament-logger), CityResource | админы/роли/аудит/города |

Дашборд: 6 виджетов (статистика заказов, разбивка по статусам, failures
submissions, мерчанты, здоровье интеграций, пользователи), поллинг 300 с.

## Страница «Платформенный минимум заказа» (единственная редактируемая)

- «Система → Платформенный минимум заказа» (`App\Filament\Pages\PlatformOrderSettings`,
  админка 6611e9e, этап 2 №1 BACKLOG_REVIEW): правит дефолт (600 ₽) и пол (500 ₽)
  строкой core `platform_order_settings` через модель-зеркало и соединение
  `pgsql_core`; своей таблицы/миграции у админки нет.
- Валидация: целые рубли, > 0, ≤ 100 000 ₽, **пол ≤ дефолта**. Правило чтения
  повторяет core `MinOrderPolicy`, без кэша — правка видна сразу.
- Право `View:PlatformOrderSettings` ролям по умолчанию не выдано — super_admin
  (через gate); сохранение пишет `activity('admin')`.

## RBAC (Shield)

- Роли сидом: `super_admin`, `support`, `operations`, `moderator`
  (RolesSeeder.php:13–27). super_admin — gate-bypass (`define_via_gate`,
  intercept before — config/filament-shield.php:74–78).
- Права `PascalCase:Model` (ViewAny:Order…), сидируются миграциями по 12 действий
  на модель; раздача ролям — assign-миграции (support: read заказы/юзеры/кошелёк;
  operations: мерчанты/интеграции; moderator: каталог).
- Политики пишутся вручную (`shield:generate` запрещён — AGENTS.md:120–121);
  create/update/delete на заказах/юзерах — жёстко false.
- Auth: AdminUser (схема lovii_admin), guard web (сессии), `canAccessPanel: true`
  для любого аутентифицированного.

## Схема lovii_admin

`admin_users` (+locale), sessions, password_reset_tokens, spatie-таблицы
(permissions/roles/model_has_*), activity_log, кэш/джобы. Схемы lovii_admin и
lovii_b2b создаёт первая миграция admin. Ядро admin-домена (AdminModel/AdminUser) —
единственные собственные модели.

## Чарджбэк-контур (главная операционная функция)

- Список: подтверждённые платежи (status=confirmed) + фильтр «обработан/не
  обработан» по наличию записи в core `chargeback_logs`.
- Страница ProcessChargeback: показывает ноги начислений (order_income,
  pool_share, payment_income) и предпросмотр зеркала (обратный знак, тип
  chargeback_reversal); оператор вводит комиссию банка в рублях → копейки;
  вызов `POST {CORE_API_URL}/api/internal/v1/orders/{id}/chargeback` с
  `X-Internal-Secret` (CoreApiClient.php:26–41); 409 «уже обработан» не блокирует.
- Core-сторона: атомарно зеркало всех ног + bank fee на счёт Точки + возврат
  баллов (ProcessChargebackController). Прав в Shield на чарджбэки отдельных нет —
  фактически только super_admin.

## Работа с core

- ~35 моделей-копий ядра на `pgsql_core` (синк скриптом core
  `scripts/sync-shared-models.sh`); read-only по умолчанию.
- Белый список записи в core: экшены статусов мерчантов, retrySubmission/cancelOrder,
  корректировка баланса (lockForUpdate + WalletTransaction, DatabaseWalletService.php:16–34).
- Scout/Meilisearch в админке подключён (поиск по каталогу).

## Инфра

- docker: app (:8001), scheduler; сети `caddy` + `lovii-core` (external);
  Postgres/Redis/Meilisearch — из стека core. Healthz/readyz есть.
- `INTERNAL_ADMIN_SECRET` в .env.example отсутствует (только в config/services.php) —
  при деплое задаётся вручную, должен совпадать с core.
- Деплой: staging автопуш, prod — ручной workflow_dispatch с master.

## Чего нет (факты)

- Партнёры b2b: модели есть, **ресурса нет** — верификацию юрлиц из админки не
  сделать (см. [09](09-kabinet-b2b.md)).
- Платежи как полноценный ресурс (список всех платежей, refunds) — нет; Payment
  используется только чарджбэками.
- Контент/CMS, настройки платформы, фичефлаги, рассылки — нет.
- Финансовые отчёты сверх 6 виджетов — нет.
- Password reset UI — таблица есть, формы нет.

## Кандидаты в «не хватает» (решает владелец)

1. Ресурс партнёров с кнопкой «верифицировать» (закрывает ручной UPDATE —
   главный операционный риск запуска МСП).
2. Список платежей (все Payment со статусами) — сейчас платежи видно только
   сквозь заказы/чарджбэки.
3. Проверить наличие `INTERNAL_ADMIN_SECRET` в env стенда (в .env.example забыт).
4. Минимальный финансовый отчёт (выручка/пул/комиссии за период) — данные в
   ledger_entries уже полные.

## Сверка владельцем

(пока пусто)

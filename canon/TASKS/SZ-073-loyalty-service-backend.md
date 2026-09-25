# SZ-073 — Сервис лояльности (бэкенд): модель, движок, контракт API, реальное время

> Статус: **Открыта** · Приоритет: **P1** · Этап 1 программы
> [`SZ-072`](SZ-072-promo-loyalty-program.md)
> Исполнитель: **не назначен** · Репо: **`lovii-core`**
> Источник: дизайн `lovii_docs/loyalty/`; решения владельца — `canon/BRD.md` §7.3.1
> Срез кода для ссылок: core `27f9b54` — перепроверить на HEAD.

## 1. Цель

Собрать лояльность как **изолированный домен (service-ready)**: свои таблицы,
свой движок правил, **публичный версионируемый контракт** для кабинетов (приложение
и b2b подключают его одинаково), применение без задержки.

## 2. Границы и структура

- Домен: `app/Domain/Loyalty/*` (существующий) расширяется до сервиса:
  `Services/PromoResolver`, `Actions/*`, `Queries/*`, `DTO/*`, `Enums/*`.
- Публичный контракт — только через контроллеры (`app/Http/Controllers/Api/V1/Loyalty/*`),
  кабинеты не обращаются к таблицам напрямую (для `b2b`, который сейчас читает
  схему `pgsql_core`, вводим API-путь для правил).
- События: `PromoRulePublished`, `PromoApplied` → в очередь (без синхронных
  внешних вызовов в request path).

## 3. Модель данных (миграции в `lovii-core`)

| Таблица | Назначение | Ключевое |
|---|---|---|
| `promo_rules` | правила механик | `merchant_id`, `branch_id`, `type` (`cashback/threshold/combo/stamps/hours`), `trigger/reward/limits/storefront` jsonb, `priority`, окно дат |
| `loyalty_product_groups` | группы товаров | `merchant_id`, `name`, `is_active` |
| `loyalty_group_categories` / `loyalty_group_products` | состав групп | FK-пивоты |
| `merchant_offer_bundle_items` | состав комбо | `offer_id`, `component_offer_id`, `qty` (комбо = `merchant_offers.offer_type='bundle'`) |
| бюджет | в `limits` | `budget`, `autostop`; расход — учитываемое поле/счётчик |

Миграция переносит текущую единственную глобальную строку `loyalty_rules` как
правило `type='cashback'`, `merchant_id = NULL` (платформенное).

## 4. Движок правил (поведение — по демо-эталону)

1. **Резолвинг по позиции:** товар → категория → группа → правило по умолчанию
   мерчанта → платформенное → ноль.
2. **Стекирование:** скидка и кэшбэк — разные линии; **база кэшбэка — фактически
   оплаченная сумма** (после скидок); между скидками — «лучшая для клиента»;
   лимиты на заказ/клиента.
3. **Механики:** порог чека (кэшбэк +N% / подарок), комбо (скидка на набор),
   штампы «N-й товар категории — подарок», счастливые часы (дни + интервал),
   бюджет с авто-стопом.
4. **Потолков % нет** — значение точки не ограничивается.
5. **Идемпотентность** начисления/возвратов (`wallet_transactions`) — сохранить.

## 5. Контракт API (версионируемый)

| Метод | Назначение |
|---|---|
| `GET /api/v1/loyalty/rules` | правила в контексте точки (для конструктора) |
| `POST/PATCH/DELETE /api/v1/loyalty/rules/{id}` | создание/правка/удаление правила |
| `GET /api/v1/loyalty/groups` (+ CRUD) | группы товаров |
| `GET /api/v1/loyalty/promos` | лента активных акций для главной (ротация), с `branch_id`/`merchant_id` |
| `GET /api/v1/loyalty/promos?branch_id=` | акции точки (блок на витрине) |
| `POST /api/v1/loyalty/preview` | расчёт выгоды для корзины/чекаута |
| `POST /internal/loyalty/apply` | применение при оформлении заказа |
| `GET /api/v1/loyalty/effect` (Ф2) | эффект акции (метрики) |

Также расширяется витрина: категория **«Комбо» первой** в `storefront/info`,
поля `StorefrontOfferCard` (`cashback_percent`, `promo_badges[]`, `bundle`).
Черновик контракта приложить к отчёту и внести в `canon/API_SPEC.md`.

## 6. Реальное время

- Сохранение правила инвалидирует кэш правил (Redis) — следующее чтение витрины
  отдаёт новое состояние **без задержки**.
- Тяжёлое (пересчёты, уведомления) — в очередь.

## 7. Критерии приёмки
1. Контракт покрыт feature-тестами; резолвинг — unit-тестами (приоритеты,
   пересечения, окна, штампы, бюджет, фолбэки).
2. База кэшбэка = фактически оплаченная сумма; проверено тестом со скидкой.
3. Комбо доступно как оффер-`bundle` с составом; категория «Комбо» отдаётся
   первой в витрине точки.
4. `wallet_transactions` и возвраты не изменились (тесты идемпотентности зелёные).
5. Правка правила видна в `GET /loyalty/promos` сразу.
6. Нет N+1 в горячих запросах; страж SZ-060 не деградировал.

## 8. Гейты
`docker exec lovii-core-app-1 composer test`; при изменении горячих путей — страж
SZ-060 на локальном стенде; миграции прогнать на staging.

## 9. Стоп-лист
Контракт кошелька не менять; потолки не вводить; внешние вызовы — только через
очередь; числа промо не размножать по докам (`PARAMS.md` — дом).

## 10. План отчёта
Что сделано (миграции/домен/эндпоинты) со ссылками на файлы и коммиты; черновик
контракта; прогон гейтов; внесённые канон-обновления; находки — `canon/FINDINGS.md`.

---

## Отчёт исполнителя

**Дата:** 2026-09-22/23 · **Исполнитель:** zcode (прогон через AutoCoder) + доработка документации
координатором · **Ветка:** `feat/sz-073-loyalty-service` (от `staging` `c098bfe`) · **Worktree:**
`lovii-core-sz073` · **Коммиты:** _(см. ниже — хеши ветки)_

### Что сделано
- **Миграции:** `promo_rules` (обобщение `loyalty_rules` + перенос глобальной строки как
  платформенного `cashback`; deprecated-представление `loyalty_rules` для `lovii-admin`),
  `loyalty_product_groups`, `loyalty_group_categories`, `loyalty_group_products`,
  `merchant_offer_bundle_items`, `promo_rule_customer_uses`.
- **Движок:** `App\Domain\Loyalty\{Services/PromoResolver, PromoRuleRegistry, PromoOfferDecorator,
  PromoAccess, DTO/*, Enums/*}`; `LoyaltyService` переведён на резолвер с сохранением контракта
  `wallet_transactions` и идемпотентности.
- **Контракт:** `app/Http/Controllers/Api/V1/Loyalty/*` (rules/groups/promos/preview/effect) +
  `app/Http/Controllers/Internal/V1/Loyalty/ApplyPromoToOrderController`; события
  `PromoRulePublished`/`PromoApplied` + листенеры; инвалидация кэша правил.
- **Витрина:** виртуальная категория «Комбо» первой в `storefront/info`; промо-поля карточки
  оффера (`cashback_percent`, `promo_badges[]`, `bundle`).
- **Тесты:** `tests/Unit/Domain/Loyalty/PromoResolverTest.php`,
  `tests/Feature/Loyalty/{PromoRuleContractTest, PromoFeedTest, PromoPreviewTest,
  StorefrontComboTest, InternalPromoApplyTest}.php`.

### Гейт
Команда: `docker exec`-эквивалент в изолированном контейнере на worktree
(`docker run --rm --network lovii-core_default -v <worktree>:/var/www/html -v <repo>/vendor:/var/www/html/vendor lovii-core/app-dev sh -c "rm -f bootstrap/cache/*.php; cd /var/www/html && composer test"`).
- `pint --test` exit 0, `rector --dry-run` OK, `type-coverage` 98.8% (≥90), `openapi:validate` valid.
- Полный сьют: **1495 passed (5445 assertions), exit 0** (последовательно, `-d memory_limit=3G`;
  `--parallel` не проходит по памяти контейнера — средовая особенность харнесса).
- Миграции прогнаны на тест-БД (`pgsql-testing`) через `RefreshDatabase` — зелено. Прогон на
  staging — при мерже.

### Отклонения
- **Право доступа** (§8 эпика, вопрос 2) не решён владельцем — использована существующая
  ability `merchant.update_profile`; вынесено как открытый вопрос.
- **`GET /loyalty/effect`** — каркас Ф2 (честно измеримое + `null` для uplift).

### Не сделано / не проверено
- Не проверено живьём на staging (нужен мерж + прогон миграций).
- Стресс-страж SZ-060 не гонялся (правило «по факту крупных обновлений»; витрина горячих
  путей затронута — рекомендуется локальный прогон перед приёмкой).
- Статус карточки не закрывается — приёмка владельца.
### Деплой (2026-09-23)
- Смержено в `staging` (fast-forward), пуш `16a34abf..a0b18231`; CI run `35901138375`: checks success + deploy-staging success (миграции применены).
- Живьём: `GET /api/v1/loyalty/promos` → 200; `/loyalty/rules` → 401; `/healthz` → 200.
- Промежуточный красный CI — PHPStan (не входит в `composer test`, см. F-061); фикс `a0b18231`.

**Статус:** на staging, ждёт приёмки владельца.

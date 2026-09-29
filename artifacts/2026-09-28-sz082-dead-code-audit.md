# SZ-082 · Фаза A — отчёт: карта неиспользуемого кода (read-only)

> Исполнитель: Super Z · Дата: 2026-09-29 · Срез: `staging` HEAD на 28.09 22:13–22:14 МСК
> (core `dd4d385`, app `9cc3a6e`, b2b `bb0e828`, admin `36aad0c`, demo `7d76150` — мастер demo)
> Метод: инвертированный grep много-стратегиями (тулкит `toolkit/`, выгрузки `findings/`)
> + ручная верификация каждого кандидата. **Ни одного удаления/переименования не произведено.**

## 1. Сводка

| Приоритет | Находок | Смысл |
|---|---|---|
| **P1 — точно мёртвое, безопасно к удалению** | **4** | остатки чистки иконок d7de859, 0 ссылок везде |
| **P2 — мёртвое/висячее с зависимостями** | **9** | API-контракт, in-flight фичи (T-023A, SZ-074), ops-инструмент, DS-baseline |
| **P3 — сомнительное, решение владельца** | **24** | enum-кейсы (ловушка DB-value), demo-playgrounds (дизайн-канон), контракт без имплементаций |
| Ложные срабатывания (механика → после проверки «оставить») | 60+ | см. §4 — подтверждает обязательность 2-проверочного протокола |
| Попутные наблюдения | 6 | §6 |

Эффект Фазы B (если владелец подтвердит P1+P2 на удаление): ~12 файлов, ~700 строк
исходников; бандл app почти не изменится (находки не в импорт-графе vite — они и сейчас
не попадают в чанки; проверка build-ом перенесена в Фазу B как пред-пост замер).

## 2. P1 — точно мёртвое (кандидаты на удаление)

| # | находка | репо/файл | почему кажется мёртвым | проверка (≥2 независимые) | вердикт |
|---|---|---|---|---|---|
| 1-4 | Иконки-обёртки `IconCoin2Fill`, `IconMoonRegular`, `IconRefreshRegular`, `IconSunRegular` (по 3 строки) | `lovii-app/src/components/icons/{shop-ecommerce,interface,arrows}/` | остатки массовой чистки 711 обёрток `d7de859` (13.09) — пропущенные 4 шт | S1 импорт имени=0 · S2 dynamic import=0 · S3 kebab-тег=0 · вне `LV_ICONS`-словаря · вне DS-baseline · вне ствола icons/README | **кандидат на удаление** (в точности профиль удалённых 711) |

## 3. P2 — мёртвое/висячее с зависимостями

| # | находка | репо/файл | почему кажется мёртвым | проверка | вердикт |
|---|---|---|---|---|---|
| 1 | `CartSummaryResource` | `lovii-core/app/Http/Resources/Api/V1/` | не используется ни одним контроллером/ресурсом/тестом/клиентом | S1 use=0 · S2 FQCN=0 · S3 имя=0 во всём кластере (app/b2b/admin/demo) · 9 соседних ресурсов живут | **кандидат (публичный API-контур — удалить только после сверки контракта владельцем)** |
| 2 | enum `FinancialTransactionType` целиком (113 строк, 15 кейсов) | `lovii-core/app/Domain/Billing/Enums/` | на staging 0 использований | S1/S2/S3=0; контекст: T-023A (финтипы) — enum положен впрок, Фазы B/C впереди | **оставить — in-flight зона T-023A; не мёртвое** |
| 3 | `LedgerTreeCommand` (`ledger:tree`) | `lovii-core/app/Console/Commands/` | нет ни в schedule, ни в кроне, ни в доках (core+canon+infra), ни в тестах | сигнатура=0 во всех источниках · интерактивный диагностический инструмент ledger-сходимости | **кандидат с оговоркой: ops-инструмент — либо задокументировать в canon runbook, либо удалить; решает владелец** |
| 4-8 | `MspGrowthSheet` (287 стр.), `PercentStepper`, `PromoBadge`, `ProfileBanner`, `ProfileCard` | `lovii-app/src/modules/{roles-module,profile-module}/` | 0 импортов/тегов/динамик в src | S1–S4=0 · единственное упоминание имени — метрики `src/__tests__/design-system.baseline.json` (DS-guard считает литералы по ВСЕМ src, присутствие в baseline ≠ использование) · контекст: зоны SZ-074 (msp/loyalty ветки существуют) и profile | **кандидаты, зависящие от фичевых планов: сверить с владельцем (этапные артефакты вёрстки SZ-074 / будущие экраны?)** |
| 9 | 8 экспортов helpers: `cashbackOperationSummary` (entries), `PAY_TIERS`, `payTierById` (pay-tier), `CARD_LENGTH`, `DESTINATION_TITLES`, `PROMO_LENGTH`, `TRANSFER_TIERS` (transfer-form), `walletDirection` (wallet-history) | `lovii-app/src/modules/profile-balance/helpers/` | 0 импортов и 0 упоминаний имени вне файла-определителя | S1=0 · S2=0 · файлы при этом живые (импортируются ProfileWallet/ProfileTransfer/тестами) | **⚠️ карточка прямо запрещает помечать зону T-020 Фаза В («слить, а не удалять») мёртвой → не удалять; разобрать при слиянии контуров кошелька** |

## 4. Ложные срабатывания механики (проверено — «оставить», метод для факт-чека)

Показываю выборку срабатываний, которые двух-стратегическая механика дала как кандидатов,
но ручная проверка вернула к жизни — это ядро доказательной ценности аудита:

| группа | шт | чем живут (свидетельства) |
|---|---|---|
| config-файлы: `cors`, `filesystems`, `essentials` (+7 framework-конфигов) | 10 | читаются vendor-слоем Laravel/NunoMaduro-Essentials — grep по app/ их не видит по определению |
| листенеры `app/Listeners/*` (боты, промо, возврат баллов) | 7 | автодисковери `withEvents(discover: true)` по type-hint `handle()`; канон закреплён регресс-тестом `tests/Feature/Events/ListenerRegistrationTest.php` (5 подписок OrderPlaced / 7 — OrderStatusChanged) |
| API-ресурсы `Api/V1/*` | 9 | используются сиблингами: `CartItemResource::collection()` в CartResource:71, `NearbyBranchResource` в HomeResource:39 и т.д. |
| blade: 4 email-шаблона + `docs.blade` | 5 | Mailables `view: 'emails.x'` (EmailVerificationMail:39, NewDeviceLoginMail:38, OrderCreatedMail:47) + `Route::get('/docs')` → `view('docs')` |
| api-endpoints (webhooks max/telegram, healthz/readyz, internal-контур, payments/pep/loyalty) | 24 | внешние контракты (боты платформ), инфра-зонды деплоя, упоминания в тестах (tbank/webhook: 12 тест-хитов) и в доках |
| artisan-команды | 6 | `cards:backfill`/`restrictions:report`/`mappings:export,import`/`subscription:reset` — в canon-доках (FINDINGS/STATUS/SECRETS_ROTATION) и Feature-тестах; `requirements:recalculate` — тест RestrictedOffersTest |
| базовые модели `CoreModel`/`B2bModel`/`AdminModel` + actions | 6 | `extends CoreModel` в 15+ моделях; DispatchOrdersAction←PlaceOrdersAction, ActivateUserAfterConfirmAction←ConfirmByBindingAction, CreatePartnerApplicationResult←CreatePartnerApplicationAction |
| Filament-ресурсы b2b (66) / admin (130) | 0 канд. | обе панели на `->discoverResources(...)` — всё под `app/Filament/Resources` зарегистрировано структурно; Shield-политики (13/20) — все с моделями и ссылками |
| app: компоненты/роуты/scss-агрегатор | — | scss-икон-каталог (18 файлов) подключен агрегатором `src/scss/icons/icons.scss` и канонизирован README иконок (решение 13.09 «библиотеку держать целиком») |

## 5. P3 — сомнительное (на решение владельца)

| # | находка | репо/файл | почему сомнительно |
|---|---|---|---|
| 1-11 | enum-кейсы без статических ссылок: `Gender::Male`, `StorefrontDeliveryOption::{CityDelivery,FreeDelivery,RussiaDelivery}`, `ConsentSource::AccountCreation`, `BadgeColor::Tertiary`, `PromoRewardKind::CashbackFixed`, `FinancialTransactionType::{ChargebackRelease,ChargebackReserve,RubleAdjustment,SubscriptionDebitFallback}` | `lovii-core/app/Domain/*/Enums/` | ловушка DB-value: кейс может жить в данных (from()/tryFrom по строке из БД). Удаление без сверки значений в БД и миграционного плана запрещено. Финтипы — вдобавок зона T-023A |
| 12-22 | `design/playground-*.html` (11 шт: badges, cart, categories, header, orders, products(+v9), search, stores, top, index) | `lovii-demo/design/` | 0 перекрёстных ссылок (открываются напрямую браузером) — но это рабочие инструменты дизайн-сессии, demo-канон обновлялся 28.09 23:59 («галерея утверждённых блоков»). Не мёртвое — зона сессии |
| 23 | интерфейс `OrderStatusSyncContract` | `lovii-core/app/Domain/Integration/Contracts/` | 0 имплементаций и использований — задел на синк статусов заказов; либо дока-план, либо кандидат Фазы B |
| 24 | экраны demo вне SCREEN_MAP | `lovii-demo` | `docs/SCREEN_MAP.md` в статусе Draft (prose-формат, машинная сверка «50 роутов» невозможна) — сверка картой отложена до её утверждения; инвентарь: 16 html / 21 js, 11 вне перекрёстной навигации (см. выше) |

## 6. Попутные наблюдения (без правок, по правилу карточки)

1. **Канон-гейты красные по чужим карточкам**: `task_guard` — `SZ-080` (неканонический формат строки Статус после мержа 28.09) и `T-028` (финальный статус «Закрыта» в canon/TASKS, требует переноса в archive/tasks). Возникли до моей сессии (мерж `c65a0df`), не трогал.
2. **`lovii-pay` — пустой репозиторий** (клон 29.09) — заготовка без коммитов.
3. **b2b/admin master отстаёт от staging** (b2b staging `bb0e828` 27.09) — к Фазе B актуализировать master или вести удаления сразу в staging по гейту.
4. **Dual-contour `ProfileWallet.vue`** (два контура, dual helpers/row-компоненты) — канонизировано как T-020 Фаза В; аудит подтверждает: 8 висячих экспортов живут именно в этих helper-файлах.
5. **Иконки: 3 системы** (scss-каталог 752 класса, LV_ICONS lucide-словарь, прямые `<img>`); app-словарь `LV_ICONS` сверён с demo-каноном `lovii-demo/js/icons.js` — использованные имена в словаре (расхождений used-but-undefined не найдено); дрейф состава словарей demo↔app не мерил (вне находок).
6. **Vite-manifest сверка** (правило 5 карточки): не выполнялась сборкой в Фазе A (npm-install + build на срезе — отдельный шаг); все P1/P2-находки вне импорт-графа роутера/ barrel-файлов, поэтому в текущий бандл попадать не могут. Точный до/после-замер — пред-гейт Фазы B.

## 7. Зоны дизайн-сессии («в работе, не аудитить») — контроль карточки

- `lovii-app`: ветка `audit-fixes-wave2` на origin отсутствует (сессия локальна, стенд :5175); зона SZ-080 (`auth-module/components/AuthCode.vue`, `AuthPhone.vue`, ассеты) — в staging, **живые**, в находки не попали.
- `lovii-demo`: `design/2026-09-28-*`, `approved-components/`, playgrounds — активная сессия (коммиты 28.09).
- Пересечений находок P1/P2 с зонами сессии нет (проверено пофайлово).

## 8. Приложение

- Тулкит (read-only, смоук-матрица 17/17 на фикстуре): `toolkit/` рядом с отчётом.
- Машинные выгрузки (findings.json/md по каждому репо, вердикты CANDIDATE/AMBIGUOUS/LIVE со стратегиями и цитатами): `findings/`.
- Срез: staging-клоны 28.09 (HEAD см. шапку); миграции не сканировались; `vendor/`, `node_modules` не трогались.

---

> **Постскриптум 29.09 (после Фазы B, пакет 1 — детали в карточке `canon/TASKS/SZ-082-dead-code-audit.md`).**
> Из P1 удалены 3 из 4 иконок (app `45ad525`) — `IconRefreshRegular` живой (использование
> в дизайн-сессии). Из P2 удалены `CartSummaryResource` (core `6568c09`) и 5 DS-baseline-компонентов;
> `DESTINATION_TITLES`/`CARD_LENGTH` — живые (последний — пробел метода: экспорт с
> внутрифайловым употреблением не висячий, тулкит правится до пакета 2), остальные 6 экспортов —
> зона T-020, не удалять. Бандл 1284 → 1284 КБ — предсказание §1 подтвердилось.

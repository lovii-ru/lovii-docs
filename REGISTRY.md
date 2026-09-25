# Реестр документов LOVII — единый каталог

> **Что это:** единый справочник документации платформы LOVII по **всем** репозиториям —
> документационный хаб, продуктовые репо, дизайн-система, публикация и контекст.
> Отвечает на три вопроса: **где что лежит**, **что там за документ** и **с чего начинать**,
> когда пришла задача. Единственное место, где каталог документации собран в одном виде.
>
> **Разделение труда карт:** `REGISTRY.md` — маршрутизация и каталог (этот файл);
> `canon/REFERENCE.md` — карточки доков `lovii_docs` (структура, ключевые факты, конвенции);
> `canon/FINDINGS.md` — журнал находок инженерии. Карта не дублирует карточки — она ведёт к ним.
>
> **Ведётся вручную** (`scripts/gen_registry.py` — DEPRECATED, не запускать).
> Обновлено: 2026-09-22. GitHub-идентификатор хаба: `bestdeejay-design/lovii_docs`;
> checkout — `lovii_docs`; workspace-алиас — `LOVII/lovii-docs` (черновик сессии,
> канал фиксации — карточки канона, F-057); будущий alias `lovii-docs` не является
> текущим slug.

---

## 0. С чего начинать при задаче

| Пришла задача про… | Начни отсюда (по порядку) |
|:---|:---|
| Любая задача агента или правка документа | корневой `AGENTS.md` → `DOCS_GUIDELINES.md` → `canon/AGENT.md` / `canon/WORK_PROTOCOL.md` |
| Числа: тарифы, комиссии, пулы, сплиты | `canon/PARAMS.md` → `canon/BRD.md` §7 → сверка с первоисточником (§2.5 этого файла) |
| Продуктовые правила, логика выплат, решения | `canon/BRD.md`; история решений — `canon/SAGA.md` |
| API: эндпоинты, контракты | `contracts/openapi/lovii.yaml` (машиночитаемая истина) → `canon/API_SPEC.md` → реализация `lovii-core` (§3.1) |
| Модель данных, сущности | `canon/DATA_MODEL.md` → миграции `lovii-core` |
| Архитектуру системы, окружения, стенды | `canon/ARCHITECTURE.md` → §3.0 (стенды и ветки) → `infra` (§3.6) |
| Дизайн: токены, компоненты, паттерны | Дизайн-система `lovii-design` (§4.1) → живой эталон — демо (§3.5) → `canon/DESIGN.md` |
| Новую фичу в core / b2b / admin / app | Спеки и планы репо (§3.1–§3.4) → очередь `canon/BACKLOG.md`, статус `canon/FEATURES.md` |
| Тесты: что гонять и где сюиты | §5 этого файла + `composer.json` / `package.json` репо |
| Деплой, CI, серверы | `lovii-core/docs/DEPLOY.md`, `lovii-app/DEPLOY.md`, sessions «staging» каждого репо, `infra` (§3.6) |
| Историю работ и решений по репо | `docs/sessions/NNN-*.md` репо (§3.1–§3.4), `canon/SAGA.md`, `canon/ADR/ADR-000.md` |
| Публичные и юридические документы | §2.3 (оферты, схема средств, публикация) |
| Инвесторские материалы, инвест-сайт | §4.3 (`lovii-invest`) |
| «Что-то сломалось» | `canon/TROUBLESHOOTING.md`; ловушки кода — `canon/FINDINGS.md` |
| «Где вообще искать X» | Этот файл (§1 — карта экосистемы, §2–§4 — каталоги) |

---

## 1. Карта экосистемы LOVII

### Документационный хаб

| Репозиторий | Роль | Каталог доков |
|:---|:---|:---|
| [`lovii-ru/lovii-docs`](https://github.com/lovii-ru/lovii-docs) | **Резервный бэкап-хаб**: полный корпус (канон, as-is, artifacts, оферты), Pages, CI-гейты. Роль (решение владельца 22.09, F-057 закрыт): синк по вехам — закрытие волны приёмок, значимое слияние, срез ревизии; не оперативный пуш-путь. Профиль `lovii-ru` — выделенный и изолированный (правила: `canon/WORK_PROTOCOL.md` §9) | §2 |
| [`bestdeejay-design/lovii_docs`](https://github.com/bestdeejay-design/lovii_docs) | **Основной канон-репозиторий** — F-051 закрыт 2026-09-22 (доступ восстановлен, корпус на HEAD) | §2 |

### Продуктовые репозитории (организация [`lovii-tech`](https://github.com/lovii-tech))

| Репозиторий | Роль | Каталог доков |
|:---|:---|:---|
| [`lovii-core`](https://github.com/lovii-tech/lovii-core) | Backend API, владелец commerce-таблиц и бизнес-инвариантов | §3.1 |
| [`lovii-b2b`](https://github.com/lovii-tech/lovii-b2b) | Кабинет партнёров (мерчантов) | §3.2 |
| [`lovii-admin`](https://github.com/lovii-tech/lovii-admin) | Супер-админка платформы | §3.3 |
| [`lovii-app`](https://github.com/lovii-tech/lovii-app) | Клиентский web-клиент (SPA/PWA) | §3.4 |
| [`mobiap-widget`](https://github.com/lovii-tech/mobiap-widget) | Демо и канон дизайна (lovii.mobiap.com) | §3.5 |
| [`infra`](https://github.com/lovii-tech/infra) | Ansible-каркас серверов | §3.6 |
| `producer_ai`, `domains_finder` | Сателлиты вне платформы, к LOVII отношения не имеют | — |

### Дизайн, публикация и контекст (аккаунт [`bestdeejay-design`](https://github.com/bestdeejay-design) — suspended с 2026-09-13, F-051)

| Репозиторий | Роль | Каталог доков |
|:---|:---|:---|
| [`lovii-design`](https://github.com/bestdeejay-design/lovii-design) | Дизайн-система бренда «Лови» — единый источник истины для клиентских продуктов | §4.1 |
| [`lovii-demo`](https://github.com/bestdeejay-design/lovii-demo) | Демо-витрина lovii.mobiap.com (GitHub Pages) + исследовательские доки | §4.2 |
| [`lovii-invest`](https://github.com/bestdeejay-design/lovii-invest) | Инвест-сайт и его документация | §4.3 |
| [`lovii-site`](https://github.com/bestdeejay-design/lovii-site) | Превью нового lovii.ru перед релизом | §4.4 |
| [`lovii-legacy`](https://github.com/bestdeejay-design/lovii-legacy) | Архив многоаудиторного сайта + ТЗ агенту | §4.5 |
| [`lovii`](https://github.com/bestdeejay-design/lovii) | Публичный хаб-профиль платформы | §4.6 |
| [`axiiom-ru/lovii`](https://github.com/axiiom-ru/lovii) | Целевой репо GitHub Pages: сюда публикуются оферты и схема средств | §2.3 |

> Связи и стенды продуктовых репо — блок `<lovii-platform-overview>` в `CLAUDE.md`
> каждого продуктового репо (копия ×4 — см. `canon/FINDINGS.md` F-011).

---

## 2. `lovii_docs` — хаб документации (SSOT)

### 2.1 Структура репозитория

```text
lovii_docs/
├── AGENTS.md / CLAUDE.md     # обязательная точка входа и указатель
├── README.md / REGISTRY.md   # лендинг и ручной реестр экосистемы
├── DOCS_GUIDELINES.md        # архитектура SSOT и гейты
├── canon/                    # канон и производные документы
│   └── TASKS/                # рабочие task-specs (класс W), не источник фактов
├── public/                   # четыре публикуемых документа класса C
├── archive/tasks/            # закрытые карточки с архивным баннером
├── archive/                  # остальные устаревшие документы и версии
├── contracts/openapi/        # машиночитаемый API-контракт
├── artifacts/ / marketing/  # рабочие и маркетинговые артефакты
├── loyalty/                 # наработки по лояльности/промо партнёра (дизайн + прототипы), не канон
├── tbank/                    # терминал-анкета; публичная база знаний API Мультисплита (docs/notes/openapi); договор — вне VCS
├── scripts/                  # проверки и публикация
└── .github/workflows/        # docs-governance и sync-public
```

Гигиена репо: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`.

### 2.2 `canon/` — живые документы (классы A + B)

Канон-источники (класс A) — единственные «дома» фактов; производные (класс B) — нарратив
без значений. Детальные карточки (структура, ключевые факты, конвенции) — `canon/REFERENCE.md` §3.

| Файл | Класс | Назначение |
|:---|:---:|:---|
| [`PARAMS.md`](canon/PARAMS.md) | A | КАНОН чисел: тарифы, пулы, сплит, комиссии, термины. При конфликте побеждает PARAMS |
| [`BRD.md`](canon/BRD.md) | A | Продуктовый канон: правила, решения, логика выплат |
| [`DATA_MODEL.md`](canon/DATA_MODEL.md) | A | Модель данных: сущности, поля, связи |
| [`DESIGN.md`](canon/DESIGN.md) | A | Дизайн-токены канона (сводка; живая система — §4.1) |
| [`FINANCIAL_MODEL.md`](canon/FINANCIAL_MODEL.md) | A | Юнит-экономика (входы — только из PARAMS) |
| [`FINANCIAL_CONTOUR.md`](canon/FINANCIAL_CONTOUR.md) | A | Механика контура: спец-счёт, верификация партнёра платёжом, контроль сбоев, нулевой баланс (черновик v0.1 — на утверждении владельца) |
| [`API_SPEC.md`](canon/API_SPEC.md) | A | API-контракт (нарратив; машиночитаемая истина — §2.5) |
| [`TEST_CASES.md`](canon/TEST_CASES.md) | A | Тест-утверждения по канону |
| [`ADR/ADR-000.md`](canon/ADR/ADR-000.md) | A | Архитектурные решения (журнал ADR) |
| [`VISION.md`](canon/VISION.md) | B | Зачем продукт существует |
| [`PRD.md`](canon/PRD.md) | B | Что строим |
| [`FEATURES.md`](canon/FEATURES.md) | B | Какие фичи готовы / запланированы |
| [`ROADMAP.md`](canon/ROADMAP.md) | B | Когда (вехи) |
| [`BACKLOG.md`](canon/BACKLOG.md) | B | Очередь задач: платформенные эпики P/E/S (§5) + сводный реестр треков I/R/C/O (§6) |
| [`ARCHITECTURE.md`](canon/ARCHITECTURE.md) | B | Как устроена система (уровень платформы) |
| [`SCREEN_MAP.md`](canon/SCREEN_MAP.md) | B | Карта экранов интерфейса |
| [`SAGA.md`](canon/SAGA.md) | B | Хроника прод-событий и решений |
| [`DEV_GUIDE.md`](canon/DEV_GUIDE.md) | B | Как собрать и опубликовать |
| [`TROUBLESHOOTING.md`](canon/TROUBLESHOOTING.md) | B | Известные ошибки и решения |
| [`REFERENCE.md`](canon/REFERENCE.md) | B | Карта документации `lovii_docs`: карточки каждого дока |
| [`FACT_MAP.md`](canon/FACT_MAP.md) | B | От чего зависит каждый факт |
| [`STATUS.md`](canon/STATUS.md) | B | Статус-срез проекта и проверки целостности |
| [`FINDINGS.md`](canon/FINDINGS.md) | B | Журнал находок инженерии (F-001…F-042) — ловушки кода, расхождения доков с реальностью; канал координации с zcode |
| [`AGENT.md`](canon/AGENT.md) | B | Ранбук: как агенту править корпус |
| [`WORK_PROTOCOL.md`](canon/WORK_PROTOCOL.md) | B | Протокол ролей, направлений T/SZ, статусов, отчёта, приёмки и архива |
| [`TASKS/README.md`](canon/TASKS/README.md) | W | Индекс активных task-specs; карточки не являются домом фактов |
| [`MINI_APPS_RESEARCH.md`](canon/MINI_APPS_RESEARCH.md) | B | Ресёрч мини-приложений Telegram/VK/MAX: публикация, валидация запуска, тихая авторизация, уведомления, платежи, матрица, MVP-рекомендация (SZ-014) |
| [`PUSH_NOTIFICATIONS_SPEC.md`](canon/PUSH_NOTIFICATIONS_SPEC.md) | B | Спека пуш-уведомлений: матрица сред РФ с цитатами, UX soft-ask, канальная матрица + анти-дубли, MVP + 🔶 (SZ-033 → SZ-010) |
| [`SECRETS_ROTATION.md`](canon/SECRETS_ROTATION.md) | B | Гигиена секретов: инвентаризация (12 позиций), план ротации до прода, инцидент-план «утечка секрета» (SZ-018, S-3) |

> `canon/TASKS/` — рабочие task-specs (шаблон — `WORK_PROTOCOL.md` §4): T-NNN
> обычно Super Z → zcode, SZ-NNN — zcode → Super Z; направление уточняется
> в карточке. Суффикс `B` входит в ID для нормализации дублей. Закрытые
> переезжают в `archive/tasks/` с баннером; живых Markdown-ссылок на архив нет.

### 2.3 `public/` — публикуемые документы (класс C)

| Файл | Роль | Аудитория |
|:---|:---|:---|
| [`public/Публичная_оферта.md`](public/Публичная_оферта.md) | Оферта купли-продажи | покупатели |
| [`public/Оферта_присоединения.md`](public/Оферта_присоединения.md) | Оферта присоединения (лицензия + сопровождение) | продавцы/лицензиаты |
| [`public/money_flow_public.md`](public/money_flow_public.md) | Схема движения средств (актуальная версия — в шапке файла) | обе |
| [`public/Политика_обработки_ПД.md`](public/Политика_обработки_ПД.md) | Политика обработки персональных данных (v1.0.1) | обе |

> Публикация: `scripts/sync-public.sh` при пуше в `main` переносит эти четыре файла + `README.md`
> в публичный репо [`axiiom-ru/lovii`](https://github.com/axiiom-ru/lovii) (GitHub Pages).
> Публичные доки правятся на месте, без смены имени файла. Конвейер починен 2026-09-06 (F-013).

### 2.4 `archive/` и `versions/` — архив (класс D)

Старые версии, дубли, черновики. Первая строка каждого файла — баннер «УСТАРЕЛ / НЕ АВТОРИТЕТЕН».

| Путь | Содержит |
|:---|:---|
| `archive/offers/` | Старые оферты |
| `archive/old_versions/` | Старые версии схемы движения средств (сравнение вариантов) |
| `archive/versions/` | Снепшоты по тегам (v0.9.0, v1.0.0, v2.0.0) |
| `archive/*.md` | Ранние версии BRD/PRD, аудит демо, конкурентный анализ, финмодели до канона, юр. черновики |
| `versions/` (gitignored) | Снепшоты опубликованных версий, генерируются `sync-public.sh`; в свежем клоне отсутствуют |

### 2.5 `contracts/` и первоисточник комиссий

| Источник | Где | Назначение |
|:---|:---|:---|
| OpenAPI-контракт | [`contracts/openapi/lovii.yaml`](contracts/openapi/lovii.yaml) | Машиночитаемая истина API-домена; нарратив — `canon/API_SPEC.md` |
| Договор Т-Банка № МР-08.26/АКС_01, Приложение №3 | **вне VCS** — `LOVII/lovii-docs/tbank/05_Мультирасчеты_без_акта_ООО_АКСИОМА.md` (локально у владельца, вне VCS) | ПЕРВООРИСТОЧНИК комиссий и юр. условий эквайринга. НЕ РЕДАКТИРОВАТЬ. В свежем клоне отсутствует — см. `canon/FINDINGS.md` F-014 |

### 2.6 Скрипты и CI

| Файл | Назначение |
|:---|:---|
| [`scripts/fact-guard.sh`](scripts/fact-guard.sh) | CI-страж числовых копий вне канон-доменов; task-specs проверяются отдельным гейтом |
| [`scripts/task_guard.py`](scripts/task_guard.py) | ID/H1, статусы, уникальность задач, архивные баннеры и ссылки |
| [`scripts/doc-canon-check.py`](scripts/doc-canon-check.py) | Старые факты, версии и битые markdown-ссылки |
| [`scripts/sync-public.sh`](scripts/sync-public.sh) | Пересборка и публикация `public/` в axiiom-ru/lovii |
| `scripts/debug-api.ts` | Отладка API |
| `scripts/gen_registry.py` | DEPRECATED — не запускать (перезапишет REGISTRY устаревшим содержимым) |
| `.github/workflows/fact-guard.yml` | CI-проверка на каждый пуш |
| `.github/workflows/sync-public.yml` | CI-публикация при изменении `public/` |

### 2.7 `marketing/` — презентации и инфопакеты (артефакты)

| Путь | Что это |
|:---|:---|
| [`marketing/prezentacii/`](marketing/prezentacii/README.md) | 5 презентаций LOVII (контент 2026-09-02, PDF для показа + PPTX-исходники): промт-гайд, представителям, амбассадорам, инвесторам, жителям района. Индекс и описания — README в папке |
| `marketing/LOVII_инфопакет_*.pdf` | Инфопакеты амбассадора и представителя |
| `marketing/screenshots/` | Скриншоты сайта |

Артефакты, не доки: числа внутри презентаций каноном не являются — при конфликте
побеждает `canon/PARAMS.md` (§2.2).

---

## 3. Продуктовые репозитории `lovii-tech` — каталог документации

### 3.0 Общее для всех продуктовых репо

| Документ | Где | Назначение |
|:---|:---|:---|
| `CLAUDE.md` / `AGENTS.md` | core, b2b, admin, app | Общий справочник платформы (текст одинаков ×4, блок `<lovii-platform-overview>` — F-011); точка входа агента |
| `CLAUDE.md` | widget, infra | Короткий справочник конкретного репо |
| `docs/sessions/NNN-*.md` | все | Нумерованные журналы рабочих сессий: что делалось, как деплоилось, какие решения |
| `docs/superpowers/plans/`, `specs/` | все | Планы реализации и дизайн-доки, созданные агентами |
| `.claude/skills/` (в b2b/admin ещё `.junie/skills/`) | все | Встроенные навыки AI-агентов (Laravel best practices, Pest, Livewire…) — инструмент, не продуктовая документация |

Окружения и ветки (одинаково в core/b2b/admin/app): `staging` → автодеплой на каждый пуш;
`master` → прод, деплой только вручную; doc-only изменения (`*.md`, `docs/`) CI не запускают.
Общие модели синхронизирует `lovii-core/scripts/sync-shared-models.sh`.

| Репо | Стек | Прод | Staging | Тесты (см. §5) |
|:---|:---|:---|:---|:---|
| core | PHP 8.5, Laravel 13 | api.lovii.ru | api-staging.lovii.ru | Pest: Unit, Feature, E2e |
| b2b | Laravel 13, Filament v5 | b2b.lovii.ru | b2b-staging.lovii.ru | Pest: Unit, Feature, E2e, Browser |
| admin | Laravel 13, Filament v5 | admin.lovii.ru | admin-staging.lovii.ru | Pest: Unit, Feature |
| app | Vue 3, TypeScript, Vite, Pinia | app.lovii.ru | app-staging.lovii.ru | Vitest, Playwright |
| widget | Vue 3, Vite | lovii.mobiap.com | — | нет |
| infra | Ansible (Ubuntu 24.04) | — | — | плейбуки `--check --diff` |

### 3.1 [`lovii-core`](https://github.com/lovii-tech/lovii-core) — Backend API (ветка `master`)

**Точка входа:** `CLAUDE.md`, [`README.md`](https://github.com/lovii-tech/lovii-core/blob/master/README.md).

| Документ | Назначение |
|:---|:---|
| [`docs/DEPLOY.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/DEPLOY.md) | Production Deployment Guide: прод-деплой core по шагам |
| [`docs/specs/lovii_technical_specification.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/specs/lovii_technical_specification.md) | Исходная тех. спецификация платформы (базовый документ; копия также в b2b) |
| [`docs/specs/working-hours-specification.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/specs/working-hours-specification.md) | Формат хранения часов работы точек |
| [`docs/backlog.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/backlog.md) | Список фич на будущее |
| [`docs/runbooks/db-dump.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/runbooks/db-dump.md) | Операционный ранбук: залить дамп БД на сервер |
| [`docs/features/catalog-product-merchant-ownership/`](https://github.com/lovii-tech/lovii-core/tree/master/docs/features/catalog-product-merchant-ownership) | Привязка catalog_products к merchant: ТЗ → план → дизайн → отчёт (полный цикл фичи) |
| [`docs/features/soft-deletes/`](https://github.com/lovii-tech/lovii-core/tree/master/docs/features/soft-deletes) | Мягкое удаление каталога и мерчантов: запрос, ADR, дизайн |
| [`docs/features/kuper-partner-provisioner/`](https://github.com/lovii-tech/lovii-core/tree/master/docs/features/kuper-partner-provisioner) | Редизайн Kuper PartnerProvisioner под саморегистрацию b2b (дизайн) |
| [`docs/reports/2026-04-02-gap-analysis.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/reports/2026-04-02-gap-analysis.md) | Gap-анализ «спека vs реализация» |
| [`docs/requests/2026-04-17-merchants-legal-fields.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/requests/2026-04-17-merchants-legal-fields.md) | Входящий запрос b2b: юр. поля `public.merchants` |
| [`docs/responses/2026-04-13-three-requests-response.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/responses/2026-04-13-three-requests-response.md) | Ответ b2b на три запроса фаз 7/8 |
| [`docs/sessions/001-server-migration-cicd-github-actions.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/sessions/001-server-migration-cicd-github-actions.md) | Миграция на сервер + перевод CI/CD на GitHub Actions |
| [`docs/sessions/002-staging-environment.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/sessions/002-staging-environment.md) | Staging-контур всех четырёх проектов, сброс прода, отключение Kuper |
| [`docs/sessions/013-telegram-multibot.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/013-telegram-multibot.md) | Три Telegram-бота (@loviiru_bot/@axiomru_bot/@lovii_pay_bot): мультибот-инфраструктура, two-way поддержка, статусы заказов МСП; зеркало MAX-мультибота (012) |
| [`docs/sessions/003-server-side-geocoding.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/003-server-side-geocoding.md) (ветка `staging`) | Геокодинг на бэкенде: resolve/reverse/suggest через Yandex server-side («гео в core») |
| [`docs/sessions/004-otp-dev-code-endpoint.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/004-otp-dev-code-endpoint.md) (ветка `staging`) | OTP: дев-эндпоинт последнего кода (`/dev/otp/last-code`), безопасный тестовый вход |
| [`docs/sessions/005-geo-resolve-house-parts.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/005-geo-resolve-house-parts.md) (ветка `staging`) | Дом в `/geo/resolve`: улица и номер дома в ответе резолва адреса |
| [`docs/sessions/008-otp-delivery-spec.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/008-otp-delivery-spec.md) (ветка `staging`) | Спека бесплатной доставки OTP (MAX/Telegram/WhatsApp) + coming_soon |
| [`docs/sessions/009-max-bot-staging-setup.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/009-max-bot-staging-setup.md) (ветка `staging`) | MAX Bot API на staging: env, вебхук, Russian Trusted CA в образе |
| [`docs/sessions/010-max-stale-chat-fallback.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/010-max-stale-chat-fallback.md) (ветка `staging`) | MAX: вебхук-спека по «живому» 400 Unknown recipient + фикс деградации |
| [`docs/sessions/011-max-user-id-addressing.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/011-max-user-id-addressing.md) (ветка `staging`) | MAX: корень «Unknown recipient» — адресация диалога (user_id в query) |
| [`docs/sessions/012-max-multibot-and-otp-security.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/012-max-multibot-and-otp-security.md) (ветка `staging`) | Мультибот MAX: поддержка + заказы для МСП, все три бота на одном ядре |
| [`docs/sessions/014-telegram-otp-bind-ux.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/014-telegram-otp-bind-ux.md) (ветка `staging`) | Telegram OTP-канал: диплинк-привязка, реальный отправитель, инструкции на экране (жалоба «нет инструкций») |
| [`docs/sessions/015-support-bot-rotation.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/015-support-bot-rotation.md) (ветка `staging`) | Ротация support-бота (@axiomru_bot → @axiiomru_bot); формат OTP: код первой строкой для «Скопировать код» в push |
| [`docs/sessions/016-telegram-network-polling.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/016-telegram-network-polling.md) (ветка `staging`) | Telegram на стейджинге: исходящие через хостовый прокси, входящие — getUpdates long-poll воркеры (вебхуки из РФ заблокированы), путь возврата к вебхукам |
| [`docs/sessions/017-performance-ux-email-security-strategy.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/017-performance-ux-email-security-strategy.md) (ветка `staging`) | Замеры/фиксы тормозов входа; стратегия e-mail (E1–E3) и безопасности (S1–S3: 2FA, passkeys/Face ID) — база к моменту денег в системе |
| [`docs/sessions/018-otp-config-dead-key-cleanup.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/018-otp-config-dead-key-cleanup.md) (ветка `staging`) | Зачистка OTP-каналов: удалён мёртвый ключ coming_soon.whatsapp (F-037, решение владельца), комментарий выправлен; контекст скрытия заглушек из списка (4d544ed) |
| [`docs/sessions/019-vk-otp-spec.md`](https://github.com/lovii-tech/lovii-core/blob/staging/docs/sessions/019-vk-otp-spec.md) (ветка `staging`) | SZ-001: спека-фаза VK в otp-delivery-channels.md v1.1 (верифицированная механика, Callback vs Long Poll, ref-привязка, F-038); docs-only |
| [`docs/integration/kuper-samples/`](https://github.com/lovii-tech/lovii-core/tree/master/docs/integration/kuper-samples) | Примеры интеграционных payload'ов Kuper (справочные образцы) |
| [`docs/superpowers/plans/2026-04-16-auto-partner-on-kuper-reconcile.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/superpowers/plans/2026-04-16-auto-partner-on-kuper-reconcile.md) | План: автосоздание Partner + приглашение владельца при Kuper reconcile |
| [`docs/superpowers/plans/2026-04-19-soft-deletes-core.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/superpowers/plans/2026-04-19-soft-deletes-core.md) | План реализации soft deletes в core |
| [`docs/superpowers/plans/2026-04-20-kuper-partner-provisioner-redesign.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/superpowers/plans/2026-04-20-kuper-partner-provisioner-redesign.md) | План редизайна PartnerProvisioner |
| [`docs/superpowers/plans/2026-09-05-staging-environment.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/superpowers/plans/2026-09-05-staging-environment.md) | План реализации staging-контура |
| [`docs/superpowers/specs/2026-09-05-staging-environment-design.md`](https://github.com/lovii-tech/lovii-core/blob/master/docs/superpowers/specs/2026-09-05-staging-environment-design.md) | Дизайн staging-контура (сводный для 4 проектов) |

> **Примечание (2026-09-09):** sessions 006 и 007 в VCS не существуют нигде
> (история коммитов проверена) — утеряны при сбросе рабочего контейнера до
> восстановления worklog. Восстановлению не подлежат; содержание утраченной
> цепочки частично отражено в 008–012.

### 3.2 [`lovii-b2b`](https://github.com/lovii-tech/lovii-b2b) — кабинет партнёров (ветка `master`)

**Точка входа:** `CLAUDE.md`, [`README.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/README.md).

| Документ | Назначение |
|:---|:---|
| [`specs/b2b-caveats.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/specs/b2b-caveats.md) | Известные ловушки и отложенные решения b2b — читать перед правками |
| [`specs/b2b-roadmap.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/specs/b2b-roadmap.md) | Дорожная карта b2b |
| [`specs/b2b-tech-debt.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/specs/b2b-tech-debt.md) | Тех-долг и отложенная работа |
| [`specs/lovii_technical_specification.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/specs/lovii_technical_specification.md) | Исходная тех. спецификация платформы (копия из core) |
| [`specs/adr/2026-04-18-soft-deletes-for-catalog.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/specs/adr/2026-04-18-soft-deletes-for-catalog.md) | ADR: soft deletes каталога |
| [`specs/lovii-core-requests/`](https://github.com/lovii-tech/lovii-b2b/tree/master/specs/lovii-core-requests) | 9 формальных запросов b2b→core: поиск каталога (Scout + Meilisearch), resync-триггер интеграций, обязательность catalog_product в merchant_offers, partner_id и юр. поля в merchants, sync статусов заказов, потребление каналов уведомлений, webhook HMAC, soft-deletes миграция |
| [`specs/lovii-admin-requests/2026-04-18-trash-and-restore-ui.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/specs/lovii-admin-requests/2026-04-18-trash-and-restore-ui.md) | Запрос b2b→admin: корзина и restore UI для каталога |
| [`docs/specs/2026-04-16-auth-registration-redesign.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/2026-04-16-auth-registration-redesign.md) | Редизайн авторизации и регистрации b2b |
| [`docs/specs/2026-04-18-drop-credentials-auth-design.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/2026-04-18-drop-credentials-auth-design.md) | Отказ от логина+пароля в пользу безпарольной схемы |
| [`docs/specs/2026-04-18-branch-address-picker-redesign-design.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/2026-04-18-branch-address-picker-redesign-design.md) | Форма филиала: адресный пикер, авто-таймзона, авто-создание городов |
| [`docs/specs/2026-04-18-catalog-ux-redesign-design.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/2026-04-18-catalog-ux-redesign-design.md) | UX-редизайн каталога (базовый дизайн) |
| [`docs/specs/2026-04-18-catalog-image-uploads-design.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/2026-04-18-catalog-image-uploads-design.md) | Загрузка изображений в каталоге |
| [`docs/specs/2026-04-18-catalog-media-cleanup-design.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/2026-04-18-catalog-media-cleanup-design.md) | Чистка медиа-загрузок каталога |
| [`docs/specs/2026-04-18-catalog-ui-polish-design.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/2026-04-18-catalog-ui-polish-design.md) | UI-полировка каталога |
| [`docs/specs/core-catalog-product-merchant-ownership.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/core-catalog-product-merchant-ownership.md) | ТЗ к core: привязка catalog_products к merchant |
| [`docs/specs/_wip/branch-address-picker-test-matrix.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/specs/_wip/branch-address-picker-test-matrix.md) | WIP: матрица интеракций адресного пикера |
| [`docs/plans/`](https://github.com/lovii-tech/lovii-b2b/tree/master/docs/plans) | 7 планов реализации фаз каталога и пикера адреса (P0 медиа-инфраструктура, P1 «Позиции», P2–P5, полировка) |
| [`docs/superpowers/plans/2026-04-16-e2e-smoke-test-suite.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/superpowers/plans/2026-04-16-e2e-smoke-test-suite.md) | План E2E smoke-сьюты b2b |
| [`docs/superpowers/plans/2026-04-17-partner-verification.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/superpowers/plans/2026-04-17-partner-verification.md) | План верификации партнёров |
| [`docs/visual-checkpoints/P0-media-upload.md`, `P1-position-resource.md`](https://github.com/lovii-tech/lovii-b2b/tree/master/docs/visual-checkpoints) | Визуальные чекпоинты приёмки (медиа-загрузка, ресурс «Позиции») |
| [`docs/sessions/001-server-migration-cicd-github-actions.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/sessions/001-server-migration-cicd-github-actions.md), [`002-staging-environment.md`](https://github.com/lovii-tech/lovii-b2b/blob/master/docs/sessions/002-staging-environment.md) | Журналы сессий: миграция+CI/CD; staging-контур, ветки, noindex |

### 3.3 [`lovii-admin`](https://github.com/lovii-tech/lovii-admin) — супер-админка (ветка `master`)

**Точка входа:** `CLAUDE.md`, [`README.md`](https://github.com/lovii-tech/lovii-admin/blob/master/README.md).

| Документ | Назначение |
|:---|:---|
| [`specs/01-users.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/01-users.md) | Спека секции «Пользователи» |
| [`specs/02-merchants.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/02-merchants.md) | Спека секции «Мерчанты» |
| [`specs/03-orders.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/03-orders.md) | Спека секции «Заказы» |
| [`specs/04-integrations.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/04-integrations.md) | Спека секции «Интеграции» |
| [`specs/05-catalog.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/05-catalog.md) | Спека секции «Каталог» |
| [`specs/06-loyalty.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/06-loyalty.md) | Спека секции «Лояльность» |
| [`specs/07-geography.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/07-geography.md) | Спека секции «География» |
| [`specs/08-auth-sessions.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/08-auth-sessions.md) | Спека секции «Авторизация и сессии» |
| [`specs/09-dashboard.md`](https://github.com/lovii-tech/lovii-admin/blob/master/specs/09-dashboard.md) | Спека секции «Дашборд и виджеты» |
| [`docs/superpowers/plans/`](https://github.com/lovii-tech/lovii-admin/tree/master/docs/superpowers/plans) | 10 планов реализации секций (в порядке спек выше) + фикс замечаний ревью |
| [`docs/superpowers/specs/2026-04-02-loyalty-design.md`](https://github.com/lovii-tech/lovii-admin/blob/master/docs/superpowers/specs/2026-04-02-loyalty-design.md) | Дизайн секции «Лояльность» |
| [`docs/sessions/001-server-migration-cicd-github-actions.md`](https://github.com/lovii-tech/lovii-admin/blob/master/docs/sessions/001-server-migration-cicd-github-actions.md) | Миграция + CI/CD на GitHub Actions |
| [`docs/sessions/002-shared-model-sync-b2b-mirror-deploy-node24.md`](https://github.com/lovii-tech/lovii-admin/blob/master/docs/sessions/002-shared-model-sync-b2b-mirror-deploy-node24.md) | Синк shared-моделей (b2b-зеркало), прод-деплой, Node 24 |
| [`docs/sessions/003-staging-environment.md`](https://github.com/lovii-tech/lovii-admin/blob/master/docs/sessions/003-staging-environment.md) | Staging-контур, ветки, noindex |

### 3.4 [`lovii-app`](https://github.com/lovii-tech/lovii-app) — клиентский PWA (ветка `master`)

> Sessions 005–006 живут на ветке `staging` (в `master` их пока нет — попадут при релизе).

**Точка входа:** `CLAUDE.md`, [`README.md`](https://github.com/lovii-tech/lovii-app/blob/master/README.md).

| Документ | Назначение |
|:---|:---|
| [`DEPLOY.md`](https://github.com/lovii-tech/lovii-app/blob/master/DEPLOY.md) | Deployment Guide: сборка и деплой frontend |
| [`docs/sessions/001-server-migration-cicd-github-actions.md`](https://github.com/lovii-tech/lovii-app/blob/master/docs/sessions/001-server-migration-cicd-github-actions.md) | Миграция frontend + CI/CD на GitHub Actions |
| [`docs/sessions/002-code-quality-bugfixes-tests-api-typing.md`](https://github.com/lovii-tech/lovii-app/blob/master/docs/sessions/002-code-quality-bugfixes-tests-api-typing.md) | Аудит и фиксы багов, покрытие тестами, типизация API |
| [`docs/sessions/003-bump-github-actions-node24.md`](https://github.com/lovii-tech/lovii-app/blob/master/docs/sessions/003-bump-github-actions-node24.md) | Апгрейд Actions на Node 24 |
| [`docs/sessions/004-staging-environment.md`](https://github.com/lovii-tech/lovii-app/blob/master/docs/sessions/004-staging-environment.md) | Staging-контур, ветки master/staging, robots |
| [`docs/sessions/005-server-side-geocoding-client.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/005-server-side-geocoding-client.md) (ветка `staging`) | Серверный геокодинг: формы адресов без Yandex-ключа в браузере |
| [`docs/sessions/006-lovii-design-system-phase-a.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/006-lovii-design-system-phase-a.md) (ветка `staging`) | Подключение дизайн-системы «Лови», фаза A (цветовой слой); провенанс снапшота токенов |
| [`docs/superpowers/plans/2026-06-20-audit-findings.md`](https://github.com/lovii-tech/lovii-app/blob/master/docs/superpowers/plans/2026-06-20-audit-findings.md) | Реестр находок аудита `src/` |
| [`docs/superpowers/plans/2026-06-20-code-quality-cycle1.md`](https://github.com/lovii-tech/lovii-app/blob/master/docs/superpowers/plans/2026-06-20-code-quality-cycle1.md) и парный [`design`](https://github.com/lovii-tech/lovii-app/blob/master/docs/superpowers/specs/2026-06-20-code-quality-cycle1-design.md) | Цикл качества №1: аудит, фиксы, тесты |
| [`docs/superpowers/plans/2026-06-20-typing-cycle2.md`](https://github.com/lovii-tech/lovii-app/blob/master/docs/superpowers/plans/2026-06-20-typing-cycle2.md) и парный [`design`](https://github.com/lovii-tech/lovii-app/blob/master/docs/superpowers/specs/2026-06-20-typing-cycle2-design.md) | Цикл №2: типизация API (ручные типы → vue-tsc 0) |
| [`docs/sessions/012-ui-audit-staging.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/012-ui-audit-staging.md) (ветка `staging`) | UI-аудит стейдинга (2026-09-07): находки F-015–F-028 с репро и рецептами фиксов; описания недокументированных фич; подтверждение фиксов нижней навигации |
| [`docs/sessions/013-checkout-address-picker.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/013-checkout-address-picker.md) (ветка `staging`) | Выбор адреса на чекауте (F-029, 2026-09-07): план по жалобе владельца → реализация Super Z (f242a18, общий AddressSelectSheet) → приёмка живьём и e2e 6/6 |
| [`docs/sessions/007-e2e-scenario-layer.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/007-e2e-scenario-layer.md) (ветка `staging`) | Сценарный E2E-слой покупателя (гость → точка → корзина → заказ) |
| [`docs/sessions/008-app-header.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/008-app-header.md) (ветка `staging`) | Единый хедер сайта на всех страницах (AppHeader + AppPageHeader) |
| [`docs/sessions/009-e2e-otp-real-code.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/009-e2e-otp-real-code.md) (ветка `staging`) | E2E: реальный OTP-код из лога core вместо бипаса, новый тестовый покупатель |
| [`docs/sessions/009-typography-font-scale.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/009-typography-font-scale.md) (ветка `staging`) | Типографика канона, масштаб текста, канон-хедеры (дубль номера 009 — исторически) |
| [`docs/sessions/010-geo-house-level-address.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/010-geo-house-level-address.md) (ветка `staging`) | Гео до дома в обе стороны: точный адрес при входе, адресный поиск на core, дистанции точек |
| [`docs/sessions/010-visual-audit.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/010-visual-audit.md) (ветка `staging`) | Аудит экранов на staging: адрес всегда виден, гео-кнопка, лого-жест (дубль номера 010 — исторически) |
| [`docs/sessions/011-canon-demo-alignment.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/011-canon-demo-alignment.md) (ветка `staging`) | Возврат к канону демо: хедер, плашка адреса, профиль |
| [`docs/sessions/018-anti-fouc-loading-order.md`](https://github.com/lovii-tech/lovii-app/blob/staging/docs/sessions/018-anti-fouc-loading-order.md) (ветка `staging`) | Анти-FOUC: мигание «Войти» при refresh профиля → authState pending/authed/guest + скелетоны; аудит порядка загрузки всех экранов (2026-09-09) |

### 3.5 [`mobiap-widget`](https://github.com/lovii-tech/mobiap-widget) — демо и канон дизайна (ветка `main`)

| Документ | Назначение |
|:---|:---|
| [`CLAUDE.md`](https://github.com/lovii-tech/mobiap-widget/blob/main/CLAUDE.md) | Фиксация статуса «демо = канон дизайна» и роль репо (см. `canon/FINDINGS.md` F-009) |
| [`README.md`](https://github.com/lovii-tech/mobiap-widget/blob/main/README.md) | Setup проекта |

> Живой эталон навигации, иконок и токенов для `lovii-app`. Подробная спецификация
> элементов канона — `lovii-app/docs/sessions/006` и `lovii-design` (§4.1).

### 3.6 [`infra`](https://github.com/lovii-tech/infra) — Ansible-каркас (ветка `master`)

| Документ | Назначение |
|:---|:---|
| [`README.md`](https://github.com/lovii-tech/infra/blob/master/README.md) | Ansible-каркас серверов: Ubuntu 24.04, Nginx+PHP-FPM, PostgreSQL, деплой Laravel, наблюдаемость |
| [`CLAUDE.md`](https://github.com/lovii-tech/infra/blob/master/CLAUDE.md) | Точка входа агента по инфраструктуре |

### 3.7 Сателлиты

`producer_ai`, `domains_finder` — вне платформы LOVII, документации в контексте платформы не имеют.

---

## 4. Дизайн, публикация и контекст (`bestdeejay-design`)

### 4.1 [`lovii-design`](https://github.com/bestdeejay-design/lovii-design) — дизайн-система (ветка `main`)

Единый источник истины по дизайну для всех клиентских продуктов (демо, lovii.ru, будущие
экраны всех ролей). Документация написана для людей и ИИ-агентов: у каждого раздела значения,
правила Do/Don't и чек-лист приёмки. Канон значений — демо lovii.mobiap.com (§3.5).

| Документ | Назначение |
|:---|:---|
| [`README.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/README.md) | Портал дизайн-системы: версия, канон, навигация |
| [`CHANGELOG.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/CHANGELOG.md) | SemVer токенов и правил: MINOR — совместимые значения, MAJOR — ломающие |
| [`docs/01-principles.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/01-principles.md) | Принципы системы |
| [`docs/02-color.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/02-color.md) | Цвет: палитра и токены |
| [`docs/03-typography.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/03-typography.md) | Типографика |
| [`docs/04-space-shape-motion.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/04-space-shape-motion.md) | Отступы, форма, движение, иконки |
| [`docs/05-theming.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/05-theming.md) | Темы: технический контракт (light/dark) |
| [`docs/06-application.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/06-application.md) | Применение системы в репозиториях LOVII |
| [`docs/07-patterns.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/07-patterns.md) | Библиотека паттернов (copy-paste сниппеты) |
| [`docs/08-recipes.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/08-recipes.md) | Рецепты для агента (типовые задачи) |
| [`docs/09-components.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/09-components.md) | Компоненты: анатомия и состояния |
| [`docs/10-ux-patterns.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/10-ux-patterns.md) | UX-паттерны: scroll, адаптив, PWA, hash-роутинг |
| [`docs/11-brand-voice.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/11-brand-voice.md) | Бренд и тон: голос, тексты, юр. блок, иллюстрации |
| [`docs/12-components.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/12-components.md) | Библиотека компонентов: полный набор |
| [`docs/13-site-longform.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/13-site-longform.md) | Сайт продукта и лонгрид |
| [`docs/checklist.md`](https://github.com/bestdeejay-design/lovii-design/blob/main/docs/checklist.md) | Чек-лист приёмки вёрстки |

### 4.2 [`lovii-demo`](https://github.com/bestdeejay-design/lovii-demo) — демо-витрина (ветка `master`)

Живое демо: [lovii.mobiap.com](https://lovii.mobiap.com) (GitHub Pages, домен привязан `CNAME`).

| Документ | Назначение |
|:---|:---|
| [`README.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/README.md) | Витрина LOVII: что это, как работает, где живёт |
| [`docs/PRD_DEMO.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/docs/PRD_DEMO.md) | PRD демо (историческая основа продуктового канона) |
| [`docs/ARCHITECTURE.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/docs/ARCHITECTURE.md) | Архитектура демо (клиентская, без бэкенда) |
| [`docs/SCREEN_MAP.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/docs/SCREEN_MAP.md) | Карта экранов демо |
| [`docs/DESIGN.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/docs/DESIGN.md) | Ранняя дизайн-система демо (живой канон значений — сам код демо) |
| [`docs/UIUX_BEST_PRACTICES.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/docs/UIUX_BEST_PRACTICES.md) | UI/UX-практики, применённые в демо |
| [`docs/COMPETITOR_ANALYSIS.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/docs/COMPETITOR_ANALYSIS.md) | Конкурентный анализ |
| [`docs/STORES_NEARBY_RESEARCH.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/docs/STORES_NEARBY_RESEARCH.md) | UI-исследование «магазины рядом» и принятое решение |
| [`docs/PROJECT_CONTEXT.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/docs/PROJECT_CONTEXT.md) | Контекст проекта на момент демо |
| [`LOVII_APP_AUDIT.md`](https://github.com/bestdeejay-design/lovii-demo/blob/master/LOVII_APP_AUDIT.md) | Аудит состояния клиента (app.lovii.ru) на дату аудита |

### 4.3 [`lovii-invest`](https://github.com/bestdeejay-design/lovii-invest) — инвест-контур (ветка `main`)

| Документ | Назначение |
|:---|:---|
| [`README.md`](https://github.com/bestdeejay-design/lovii-invest/blob/main/README.md) | Презентационный сайт и документация: концепция для инвесторов |
| [`CONTEXT_MAP.md`](https://github.com/bestdeejay-design/lovii-invest/blob/main/CONTEXT_MAP.md) | Источник истины инвест-сайта: equity-модель (доля вместо ЦФА), оценка из юнит-экономики |
| [`NAVIGATION_RULES.md`](https://github.com/bestdeejay-design/lovii-invest/blob/main/NAVIGATION_RULES.md) | Правила адаптивной навигации сайта по брейкпоинтам |
| [`docs/PUBLISH.md`](https://github.com/bestdeejay-design/lovii-invest/blob/main/docs/PUBLISH.md) | Как публиковать сайт |

### 4.4 [`lovii-site`](https://github.com/bestdeejay-design/lovii-site) — превью нового lovii.ru (ветка `main`)

| Документ | Назначение |
|:---|:---|
| [`README.md`](https://github.com/bestdeejay-design/lovii-site/blob/main/README.md) | Превью нового lovii.ru перед релизом на главный домен; живое превью — bestdeejay-design.github.io/lovii-site |

### 4.5 [`lovii-legacy`](https://github.com/bestdeejay-design/lovii-legacy) — архив сайта (ветка `main`)

| Документ | Назначение |
|:---|:---|
| [`README.md`](https://github.com/bestdeejay-design/lovii-legacy/blob/main/README.md) | Архивная многоаудиторная версия сайта (Главная, Клиентам, Бизнесу, Партнёрам, Амбассадорам, Инвесторам) |
| [`ТЗ_для_агента_LOVII.md`](https://github.com/bestdeejay-design/lovii-legacy/blob/main/ТЗ_для_агента_LOVII.md) | ТЗ ИИ-агенту на сопровождение и деплой сайта lovii-site |

### 4.6 [`lovii`](https://github.com/bestdeejay-design/lovii) и [`axiiom-ru/lovii`](https://github.com/axiiom-ru/lovii) — публичный контур

| Репозиторий | Назначение |
|:---|:---|
| `bestdeejay-design/lovii` | Публичный хаб-профиль платформы (README.ru/EN, гигиена репо, шаблоны PR) |
| `axiiom-ru/lovii` | Целевой репо GitHub Pages: оферты и схема средств, публикуются из `lovii_docs/public/` (§2.3) |

---

## 5. Тестирование платформы

> Кросс-репо обзор сьютов (закрытие `canon/FINDINGS.md` F-001 и F-002). Точные команды —
> секция `scripts` (`test*`) в `composer.json` / `package.json` каждого репо.

| Уровень | Репо | Инструмент | Запуск | Когда гонять | В CI |
|:---|:---|:---|:---|:---|:---|
| Backend API: unit/feature | `lovii-core` | Pest | `composer test:unit`; полный прогон — `composer test:ci` | после правок моделей/бизнес-логики | да (unit + coverage) |
| Backend API: E2E через nginx | `lovii-core` | Pest `tests/E2e` | `composer test:e2e` — нужен поднятый стек (nginx → PHP-FPM, localhost:8080) | после правок чекаута/гео/каталога; перед ручным деплоем `master` | нет (`--exclude-testsuite=E2e`) |
| B2B: unit/feature/E2e/Browser | `lovii-b2b` | Pest | `composer test:unit` / `test:e2e` / `test:browser` | после правок кабинета партнёра | unit — да |
| Admin | `lovii-admin` | Pest | `composer test:unit` | после правок админки | да |
| Frontend: unit | `lovii-app` | Vitest | `yarn test:unit`; полный прогон — `yarn test` (format+lint+types+build) | после правок stores/компонентов | да |
| Frontend: E2E UI | `lovii-app` | Playwright | `yarn test:e2e` (конфиг `e2e/playwright.config.ts`) | перед релизными вехами | нет (локально) |
| Статический анализ | core/b2b/admin — pint+rector (+phpstan в `test-strict`); app — oxlint+eslint+vue-tsc+stylelint | — | `composer test:lint` / `yarn lint` | всегда (часть CI) | да |

Примечания:

- E2e-сьют `lovii-core` бьёт реальными HTTP-запросами через полный стек (ловит ошибки конфигурации nginx/PHP-FPM, а не только код), поэтому не живёт в CI и требует окружения (F-001).
- У `lovii-admin` скрипт `test:e2e` объявлен, но каталога `tests/E2e/` нет — сейчас запуск упадёт (F-012).
- У `mobiap-widget` тестов нет; у `infra` — плейбуки с `--check --diff` вместо тестов.
- Тест-утверждения продуктовой логики (что именно проверять) — `canon/TEST_CASES.md`.

---

## 6. Поддержка каталога

- Новый, переименованный или удалённый док в любом репо → строка в таблице соответствующего раздела этого файла. Для `canon/` дополнительно карточка в `canon/REFERENCE.md` §3 (чек-лист — `DOCS_GUIDELINES.md` §6).
- Ссылки на внешние репо — абсолютные (`blob/<ветка>`), ветки: core/b2b/admin/app/infra — `master`, widget/design/invest/site/legacy/lovii — `main`, demo — `master`. При смене дефолтной ветки репо — поправить ссылки.
- Обнаружил ловушку, расхождение дока с кодом или устаревшую ссылку → `canon/FINDINGS.md` (F-NNN), не правь молча.
- Каталог описывает состояние на дату в шапке; помечай дату обновления при существенных изменениях.

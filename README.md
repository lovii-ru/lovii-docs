# LOVII — документация (публичное зеркало)

> **Что это:** полный архив документации платформы LOVII для работы и фиксации правок.
> **Срез:** 2026-09-17.
> **Источник истины:** workspace `LOVII/lovii_docs/` — канон правится локально и расходится по зеркалам.
> **Зеркала:** `bestdeejay-design/lovii_docs` (приватный; пуш из workspace недоступен при F-051) ·
> `axiiom-ru/lovii` (лендинг, 4 файла) · **этот репо `lovii-ru/lovii-docs` — публичный полный корпус
> и единственный рабочий пуш-путь на GitHub** (см. `canon/FINDINGS.md` → `F-051`).
> **Путь обновления:** правка в workspace → commit в `LOVII/lovii_docs` (main) → `git push mirror main`,
> где `mirror` = `git@github.com-lovii-ru:lovii-ru/lovii-docs.git` (SSH-ключ `lovii_ru_ed25519`,
> Host `github.com-lovii-ru`). Не копить локальные коммиты: пушим в рабочее зеркало сразу.

## Раскладка

| Каталог | Что внутри |
|---|---|
| [`as-is/`](as-is/) | 13 модулей «как есть» по коду (витрина, корзина, заказы, баллы, роли/кабинеты, вход/OTP, пуши, доставка, b2b-кабинет, админка, БД, финансовый контур, сущности b2b) + индекс |
| [`canon/`](canon/) | **Каноны** — единый источник истины: BRD, PRD, VISION, ROADMAP, PARAMS, FINANCIAL_CONTOUR/MODEL, ARCHITECTURE, DATA_MODEL, API_SPEC, DESIGN, PRODUCT_QUALITY_BAR, STATUS, BACKLOG, FINDINGS, FEATURES, + ADR/, + TASKS/ |
| [`artifacts/`](artifacts/) | Ресёрчи, БД-разбор (db-schema-analysis — 85 таблиц), карта экранов, точечные отчёты |
| `archive/` | Исторические версии канонов (BRD_v1.0, FINANCIAL_MODEL_REVIEW), аудиты, юр-документы |
| [`public/`](public/) | Опубликованные юр-документы (публичная оферта, оферта присоединения, политика ПД, money_flow_public) |
| [`contracts/`](contracts/) | OpenAPI-контракты |
| [`scripts/`](scripts/) | Гварды пайплайна (doc-canon-check, fact-guard, sync-public, task_guard) |
| [`marketing/`](marketing/) | Материалы для амбассадоров/представителей, презентации, скриншоты |
| [`tbank/`](tbank/) | Договор Т-Банк (BANK_TERMINAL_INFO) |
| [`briefs/`](briefs/) | Мастер-брифы бренда v2/v3, content brief для LLM |
| [`decisions/`](decisions/) | Открытые вопросы, требующие решения владельца (decisions-needed) |
| [`workspace/`](workspace/) | Оперативные runbooks (status, auth-staging, manual-msp-cycle, superz-schedule) |
| [`RELEASE_READINESS.md`](RELEASE_READINESS.md) | Вердикт готовности к релизу v1.0 (v0.1, 2026-09-17) |
| [`REVISION_2026-09-21.md`](REVISION_2026-09-21.md) | Полная ревизия платформы: карта документов, сверка «код ↔ канон», техаудит трёх репо, приоритеты (задача 90) |

## Корневые мета-файлы

`LICENSE`, `AGENTS.md`, `CLAUDE.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
`DOCS_GUIDELINES.md`, `REGISTRY.md`, `SECURITY.md`, `SUPPORT.md` — рабочая
документация системы (устав SSOT, реестр репо, контакты).

## Принципы

- **Факт = `file:line`** из актуального среза кода; при изменении кода правь ссылку.
- **«Как есть» ≠ «как надо»** — предложения только в раздел «Кандидаты»
  внутри конкретного документа.
- **Числовые параметры** (%, суммы, пороги) — только ссылкой на `canon/PARAMS.md`,
  без копирования.
- **Канон > производный документ** (см. `DOCS_GUIDELINES.md` §4).
- **Что нельзя публиковать** исключено из этого репо: бинарь `.pptx`,
  файлы с реальными токенами/паролями/API-ключами, секретные хендоффы
  (см. исключения в коммит-сообщениях коммитов миграции).

## История коммитов

```
442e5de docs(workspace-loose): mirror briefs, decisions, workspace runbooks
5cbe907 docs(contracts+scripts+marketing): mirror workspace technical + brand assets
54227bf docs(public+tbank): mirror public legal docs and bank contract info
adf78ac docs(archive): mirror workspace lovii_docs/archive/ (historical versions)
18a04f7 docs(artifacts): mirror workspace lovii_docs/artifacts/ (research, db-schema)
490b0cc docs(canon): mirror workspace lovii_docs/canon/ (35 source-of-truth docs)
9f8034b docs(meta): mirror workspace root meta (LICENSE, AGENTS, CLAUDE, etc)
4a72660 docs(repo): restructure into meta-root + content folders
ec71121 docs(release-readiness): publish v0.1 readiness review (srez 2026-09-17)
4f7a39c docs(as-is): publish initial module descriptions (srez 2026-09-17)
```

— по этой истории можно пройти diff'ом и вернуть любой шаг отдельно.

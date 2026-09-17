# LOVII — Fact & Parameter Dependency Map

<!-- fact-guard: allow — FACT_MAP содержит полную таблицу параметров (%, суммы, пороги) для трассировки зависимостей; канон: PARAMS.md, BRD.md -->

> **Purpose:** Single inventory of every key parameter (tariffs, %, shares, roles, names, domains, colors, dates) and the documents that reference it. This is the foundation for the user's planned "dynamic cross-document linking" system — when one fact changes (e.g. commission 8% → 10%), this map shows exactly which docs must be updated.
>
> **Sources analyzed:**
> - Chats (24 LOVII chats from project `515928be-c9a9-4576-9ab0-e41b11fade96`) → `lovii_summary.md`
> - `PROJECT_CONTEXT.md` v5.1, `COMPETITOR_ANALYSIS.md` v1.0, `ARCHITECTURE.md`, `DESIGN.md`, `SCREEN_MAP.md`, `LOVII_APP_AUDIT.md`, `STORES_NEARBY_RESEARCH.md`
> - `LOVII_General.pdf` (14p), `LOVII_4Investors.pdf` (15p), `LOVII_4Suppliers.pdf` (13p) — image-based, extracted via OCR
> - `Юридическая_структура_платформы.docx` — legal structure
>
> **Legend:** 🟢 consistent · 🟡 drift/ambiguity · 🔴 contradiction

---

## 1. COMMISSION / TARIFF MODEL

> **Канонический источник:** `PARAMS.md` (v1.6+). Все расчёты — оттуда.

### 1A. Нагрузка на точку (МСП)

| Параметр | Значение | Источник |
|---|---|---|
| **Полная нагрузка** | **10%** от суммы заказа (0% на баллы) | PARAMS.md §1.1, PROJECT_CONTEXT.md |
| **Чистый пул LOVII** | **6,84%** (карты) / **9,3%** (СБП) | PARAMS.md §1.1 = 10% минус банк |
| **Комиссия за перечисление** | **0,5%** от суммы выплаты (на Компанию) | PARAMS.md §1.1 |

### 1B. Тарифные планы для МСП

| Тариф | Комиссия | Абонентка | Описание |
|---|---|---|---|
| **СТАРТ** | 0% | 0 ₽ | Пробный период (до 30 000 ₽ выручки или до конца следующего месяца); банк оплачивает Компания |
| **БАЗОВЫЙ** | 10% | 0 ₽ | Платите только когда продаёте |
| **PRO** | 4–7% | 2 990 ₽/мес | Выделенное место, аналитика, свои акции |

> Источник: PARAMS.md §1.3

### 1C. Тарифы Т-Банк (Договор №МР-08.26/АКС_01, Прил. №3)

| Операция | Ставка | Минимум | Примечание |
|---|---|---|---|
| Карты | **2,59%** + НДС 22% = **3,16%** | 3,49 ₽ | НДС сверху |
| СБП | **0,7%** | — | Без НДС |
| T-Pay | **2,59%** | 3,49 ₽ | НДС не облагается |
| Перевод Получателю | **1%** | 30 ₽ | Физлица/самозанятые |
| Перечисление 3-му лицу | **0,5%** | — | ЮЛ/ИП (клиенты МСП) |

> Источник: PARAMS.md §1.2

### 1D. Подписка Представителя

| Параметр | Значение |
|---|---|
| Без акции | **599 ₽/мес** |
| По акции (промокод от Амбассадора) | **199 ₽/мес** |
| Списание | Автоматически с баланса → карта |
| Назначение | 100% Компании (инфраструктура) |

> Представитель / Мэр / Губернатор — все обязаны иметь подписку. Источник: PARAMS.md §1.5

### 1E. Конкуренты

| Рынок | Комиссия |
|---|---|
| Официальная | 15–35% |
| Реальная | ~20–45% |

> Источник: COMPETITOR_ANALYSIS.md §4

---

## 2. INCOME SPLIT (distribution vs legal — TWO DIFFERENT MODELS)

### 2A. Distribution model (demo / marketplace docs + chats)
```
Компания 40% | Представитель 40% | Амбассадор 20%
```
| Referenced in | PROJECT_CONTEXT.md, lovii_summary.md (chats) | ✅ Consistent |

### 2B. Legal / food-court model (Юридическая_структура.docx)
```
ТСП (точка) 70% | Арендодатель 20% | Оператор 6,5% | Банк 3,5% <!-- doc-canon: historical -->
```
| Referenced in | Юридическая_структура_платформы.docx §1.2, §6.2 | ✅ Internal only |

**✅ РЕШЕНО (владелец, §12.2):** 2A — **базовая** схема распределения комиссии LOVII (40/40/20).
2B — **вариация / другая система** (маршрутизация 1000₽ клиента на уровне банка, фудкорт).
Не путать: 2A = кто получает комиссию платформы, 2B = кому уходит платёж клиента.
В КБ держать раздельно: «Distribution split (базовая)» vs «Legal split (фудкорт, вариация)».

---

## 3. ROLES & LADDER

### 3A. Internal representative ladder (chats + PROJECT_CONTEXT)
| Level | Threshold | Income | Docs |
|---|---|---|---|
| **Представитель** | до 30 точек | 40% | PROJECT_CONTEXT, PROJECT_CONTEXT, chats |
| **Мэр** | от 30 точек | 40% + бейдж | PROJECT_CONTEXT, PROJECT_CONTEXT |
| **Губернатор** | 3+ города × 30+ точек, выручка сети ≥ 15 млн ₽/мес | 40% + все привилегии | PROJECT_CONTEXT, PROJECT_CONTEXT |
| **Амбассадор** | (external chain) | 20% | PROJECT_CONTEXT, PROJECT_CONTEXT |
| **Основатель** | top | — | chats (ladder mention) |

> Note: user confirmed ladder changed from `Посланник → Мэр → Губернатор → Амбассадор → Основатель` to `Представитель → Мэр → Губернатор → Амбассадор → Основатель`. The "Посланник" level was dropped.

### 3B. External distribution chain (chats + PROJECT_CONTEXT)
```
Компания → Амбассадор → Представитель → Партнёр (Точка) → Клиент
```
| Referenced in | PROJECT_CONTEXT.md; lovii_summary.md | ✅ Consistent |

### 3C. PDFs use different terminology
- "Цифровые мэры" = regional managers (LOVII_General p8, LOVII_4Investors p4, p12, p15; LOVII_4Suppliers p12)
- "Микробизнес" = supplier/seller tier
- NO ladder (Представитель/Губернатор/Амбассадор/Основатель) appears in any PDF
- NO "Партнёр (Точка)" role name in PDFs — they say "Микробизнес" / "Поставщики"

**✅ РЕШЕНО (владелец, §12.4):** «Цифровой мэр / региональный менеджер» (PDF) = «Представитель/Мэр»
(MD). Унифицировать под лестницу: **Представитель → Мэр → Губернатор**. Это **цифровые
роли внутри Лови**, без привилегий в реальном мире — только заслуги и поощрения от компании.

---

## 4. EXAMPLE CALCULATIONS (single point)

| Parameter | Value | Source |
|---|---|---|
| Средний чек | **1 200 ₽** | PROJECT_CONTEXT.md, PARAMS.md §1.3 |
| Заказов/день | **4** | PROJECT_CONTEXT.md, PARAMS.md §1.3 |
| Дней/мес | **30** | PROJECT_CONTEXT.md, PARAMS.md §1.3 |
| Выручка точки | **144 000 ₽** | PARAMS.md §1.3 |
| **Тариф БАЗОВЫЙ:** | | |
| Комиссия (10%) | **14 400 ₽** | PARAMS.md §1.3 |
| Абонентка | **0 ₽** | PARAMS.md §1.3 |
| Итого доход с точки | **14 400 ₽** | PARAMS.md §1.3 |
| **Тариф PRO:** | | |
| Комиссия (4–7%) | **5 760–10 080 ₽** | PARAMS.md §1.3 |
| Абонентка | **2 990 ₽** | PARAMS.md §1.3 |
| Итого доход с точки | **8 750–13 070 ₽** | PARAMS.md §1.3 |

> ⚠️ Примеры выше приведены для тарифа БАЗОВЫЙ (10%, без абонентки). Тариф PRO: 4–7% + 2 990 ₽/мес.

### Governor network example (тариф БАЗОВЫЙ)
| Parameter | Value | Source |
|---|---|---|
| Городов | 3 | PARAMS.md §1.3 |
| Точек на город | 30 | PARAMS.md §1.3 |
| Всего точек | 90 | PARAMS.md §1.3 |
| Выручка сети | **12 960 000 ₽/мес** | PARAMS.md §1.3 |
| Комиссия 10% | **1 296 000 ₽** | PARAMS.md §1.3 |
| Доход губернатора (40%) | **518 400 ₽/мес** | PARAMS.md §1.3 |

---

## 5. FINANCIAL TARGETS / METRICS (from PDFs)

| Metric | Value | Source |
|---|---|---|
| Целевая капитализация | **3 млрд ₽** | LOVII_General.pdf p1, LOVII_4Investors.pdf p14 |
| MVP GMV (СМУ, 6 мес) | **> 25 млн ₽** | LOVII_General.pdf p10, LOVII_4Investors.pdf p13 |
| MVP активные пользователи | **> 5 000** (or 25 000 — 🟡 OCR ambiguity) | LOVII_4Investors.pdf p13 |
| MVP точки | **> 30** | LOVII_General.pdf p10, LOVII_4Investors.pdf p13 |
| MVP Loyalty CRM рост | **> 40%** | LOVII_General.pdf p10 |
| Порог масштабирования GMV | **> 5 млн ₽/мес** | LOVII_General.pdf p12, LOVII_4Investors.pdf p12 |
| Порог масштабирования поставщики | **> 50** | LOVII_General.pdf p12, LOVII_4Investors.pdf p12 |
| Порог масштабирования Retention | **> 40%** | LOVII_General.pdf p12, LOVII_4Investors.pdf p12 |
| Зрелая локация: точки | **> 200** | LOVII_General.pdf p10, LOVII_4Investors.pdf p13 |
| Зрелая локация: EBITDA | **> 0 / > 20** (🟡 ambiguous) | LOVII_General.pdf p10 |
| Зрелая локация: доля платных тарифов | **> 30%** | LOVII_4Investors.pdf p13 |
| 30-дневный Retention | **> 40%** | LOVII_4Investors.pdf p13 |
| LTV/CAC | **> 3** | LOVII_4Investors.pdf p13 |
| Время оформления заказа | **< 3 минут** | LOVII_4Investors.pdf p13 |
| Первые заказы (ожидание) | **4–5 месяц** | LOVII_4Investors.pdf p15 |
| Онбординг бизнеса | **5 минут** (QR) | LOVII_General.pdf (implied), LOVII_4Investors.pdf p5/p11, LOVII_4Suppliers.pdf p9 |
| Ступень 1 поставщики | **10–20** | LOVII_General.pdf p11, LOVII_4Investors.pdf p12 |

---

## 6. LOYALTY / POINTS MODEL

> **Канонический источник:** `PARAMS.md` §4

| Параметр | Значение | Источник |
|---|---|---|
| Балл = Рубль | **1 балл = 1 ₽** (фиксированный курс) | PARAMS.md §4 |
| Срок жизни | **не сгорают** | PARAMS.md §4 |
| Ликвидность | **100%** внутри локации | PARAMS.md §4 |
| Оплата | гибридная: рубли + баллы | PARAMS.md §4 |
| Вывод | в рубли через **СБП** | PARAMS.md §4 |
| Внешние сертификаты | будущие релизы (Ozon, WB) | PARAMS.md §4 |

### 6A. Как формируются баллы

> **Важно:** Баллы НЕ копятся с каждой покупки автоматически.

| Правило | Описание |
|---|---|
| **Конструктор лояльности** | Точка сама решает: как, сколько и за что начислять кэшбэк |
| **Комиссия на кэшбэк** | Обязательна (мера противодействия махинациям) |
| **Трекинг** | Каждый рубль кэшбэка привязан к конкретному чеку |
| **Натуральный обмен** | Подарок/скидка/пицца в подарок — дело точки, комиссии НЕТ |

### 6B. Комиссия платформы за кэшбэк

| Параметр | Значение |
|---|---|
| Комиссия LOVII | **25%** от суммы начисленного кэшбэка |
| Распределение (40/40/20) | Компания **10%**, Представитель **10%**, Амбассадор **5%** |

> Пример: кэшбэк 600 ₽ → комиссия 25% = 150 ₽ → Компания 60 ₽ + Представитель 60 ₽ + Амбассадор 30 ₽.

---

## 7. DOMAINS / URLS / CONTACTS

| Item | Value | Source | Status |
|---|---|---|---|
| Demo domain | **lovii.mobiap.com** | PRD_DEMO.md, ARCHITECTURE.md, SCREEN_MAP.md | ✅ |
| Live app | **app.lovii.ru** | LOVII_APP_AUDIT.md | ✅ |
| Live API | **api.lovii.ru/api/v1** | LOVII_APP_AUDIT.md | ✅ |
| Partner site (PDF) | **lovii.ru** (General p14) / **partners.lovii.ru** (Suppliers p13 — 🟡 OCR "lovil") | LOVII PDFs | 🟡 verify exact |
| Telegram (General) | **@lovii_partner** | LOVII_General.pdf p14 | ✅ |
| Telegram (Suppliers) | **@lovii_manager** | LOVII_4Suppliers.pdf p13 | 🟡 different handle |
| Chat project_id | `515928be-c9a9-4576-9ab0-e41b11fade96` | chat-export JSON | ✅ |

### 7A. Staging-окружение (актуально, 2026-09-10)

| Item | Value | Source | Status |
|---|---|---|---|
| App staging | **app-staging.lovii.ru** | WORK_PROTOCOL, SZ-задачи | ✅ |
| API staging | **api-staging.lovii.ru/api/v1** (с префиксом `/api`) | SZ-004/SZ-006 проверки | ✅ |
| B2B staging | **b2b-staging.lovii.ru** (media: `/storage/...`) | SZ-006 §1 | ✅ |
| Staging-сервер | **89.19.223.16** (SSH, серверная зона zcode) | WORK_PROTOCOL | ✅ |
| **Телефон партнёра «Пышки & Пончи»** (логин b2b staging) | **+79119287478** | владелец, чат 2026-09-10 | ✅ |

> Вход в b2b: телефон + OTP (OTP на staging самовыдывается через
> `GET /api/v1/dev/otp/last-code?phone=+79119287478`, роут существует только при
> `OTP_DEV_BYPASS=1`). Факт записан, чтобы не спрашивать телефон владельца
> заново в каждой секции (SZ-006 §2, SZ-011).

---

## 8. BRAND COLORS / DESIGN TOKENS

### 8A. Demo design system (DESIGN.md — canonical for demo app)
| Token | Value |
|---|---|
| `--pink` (primary) | `#f64a8a` |
| `--pink-dark` | `#c92a6a` |
| `--tiffany` (secondary) | `#0ABAB5` |
| `--gold` (tertiary) | `#D4A854` |
| `--chiffon` | `#F5E6CC` |
| `--sand` | `#E8D5B7` |
| `--bg` | `#ffffff` |
| `--surface-secondary` | `#F8F8F8` |
| `--text-primary` | `#1a1a1a` |
| `--text-secondary` | `#888888` |
| `--text-dim` | `#bbbbbb` |
| `--success` | `#34D399` |
| Font | Inter (400–800) |
| Card radius | 12px (`--radius-lg`) |
| Bottom nav | 50px height, 4 tabs |

### 8B. Live app (LOVII_APP_AUDIT.md — COMPLETELY DIFFERENT palette)
| Token | Value |
|---|---|
| Brand 500 | `#7e90c2` (muted slate-blue) |
| Brand 600/700/990 | `#7282b0` / `#63729a` / `#0d111b` |
| Accent 500 | `#ef66ff` (magenta) |
| Accent 400/600 | `#f285ff` / `#d95de8` |
| Purple (link) | `#9924ff` |
| Page bg | `#f6f7fa` (light blue-grey) |
| Font | Inter (woff2) |
| Bottom nav | 60px height, 4 tabs |
| Icons | custom icon-font (`icon-*-regular`/`*-fill`) — NOT Tabler SVG |

**✅ РЕШЕНО (владелец, §12.3):** Базовая палитра = **белый фон + французский розовый `#f64a8a`**
(проект `lovii.mobiap.com`). 8A — базовая (canonical). 8B (живая палитра `app.lovii.ru`) —
**НЕ базовая**, отдельная ветка продукта (решение об унификации не срочное, см. §13.1).
Палитра из чатов (терракота) — **устарела**.

---

## 9. LEGAL / COMPLIANCE REFERENCES

> **Канонические источники:** `docs/money_flow_public.md` v2.0.3, `docs/Публичная_оферта.md`, `docs/Оферта_присоединения.md`, `canon/PROJECT_CONTEXT.md`

| Норматив | Суть | Где применяется | Источник |
|---|---|---|---|
| **Гл. 52 ГК РФ** | Агентская схема (Поверенный/Агент) | Модель взаимодействия Правообладателя и Лицензиата | money_flow_public.md, PROJECT_CONTEXT.md |
| **ст. 860.1–860.6 ГК РФ** | Номинальный счёт | Приём платежей покупателей, расщепление | money_flow_public.md, Оферта присоединения §1.1.10 |
| **54-ФЗ** | Онлайн-кассы / фискальные чеки | Обязанность по фискализации на Правообладателе (облачная ККТ) | money_flow_public.md §4, PROJECT_CONTEXT.md |
| **161-ФЗ** | Национальная платёжная система | Передача данных в банк для проведения платежей | Публичная оферта §9.7, Оферта присоединения §8.2 |
| **152-ФЗ** | Персональные данные | Сбор, обработка, хранение данных Покупателей и Лицензиатов | Публичная оферта §9.1, Оферта присоединения §3.1.5 |
| **103-ФЗ** | Платёжные агенты | Исключение из-под 103-ФЗ (агентская модель ≠ платёжный агент) | money_flow_public.md, Оферта присоединения §2.5 |
| **Ст. 145 НК РФ** | Освобождение от НДС | До 60 млн ₽/год (с 01.01.2025) | Юридическая_структура.docx §1.1 |

### Банковский партнёр

| Параметр | Значение |
|---|---|
| Банк | **АО «Т-Банк»** |
| Продукт | **Мультирасчёты** (номинальный счёт + мультисплит) |
| Договор | №МР-08.26/АКС_01, Приложение №3 |
| Рекомендуемые банки (alternatives) | CloudPayments, ЮKassa, Точка |

---

## 10. TECH STACK

| Компонент | Демо (PRD_DEMO → archive) | Продакшн (README, PROJECT_CONTEXT) |
|---|---|---|
| **Frontend** | Vanilla HTML/CSS/JS, GitHub Pages | React + Vite + Tailwind CSS |
| **Мобильные** | — | React Native + Expo (PWA → нативные приложения) |
| **Backend** | — | Микросервисы (Go), event-driven |
| **Очереди** | — | Kafka (CQRS, Saga) |
| **БД** | localStorage / mock | PostgreSQL (кластер 2N+1), Redis, ClickHouse |
| **Платёжный партнёр** | mock | Т-Банк (Мультирасчёты, номинальный счёт) |
| **Фискализация** | — | Облачная ККТ (54-ФЗ), ОФД |
| **Геолокация** | — | Яндекс Карты |
| **Домен** | lovii.mobiap.com (archive) | app.lovii.ru, lovii.ru |

> **Примечание:** Demo (PRD_DEMO.md) перенесён в `archive/`. Продакшн стек описан в README.md и PROJECT_CONTEXT.md.

---

## 11. CROSS-DOCUMENT DEPENDENCY EDGES (for dynamic linking)

> При изменении параметра **X** — обновить все указанные документы.

| Параметр | Документы для обновления |
|---|---|
| **Комиссия % (нагрузка)** | PARAMS.md §1.1, PROJECT_CONTEXT.md, FACT_MAP.md §1, COMPETITOR_ANALYSIS.md §4 |
| **Тарифы (СТАРТ/БАЗОВЫЙ/PRO)** | PARAMS.md §1.3, PROJECT_CONTEXT.md, FACT_MAP.md §1B |
| **Банковские ставки** | PARAMS.md §1.2, PROJECT_CONTEXT.md (диаграмма), FACT_MAP.md §1C |
| **Подписка Представителя** | PARAMS.md §1.5, PROJECT_CONTEXT.md, FACT_MAP.md §1D |
| **Сплит 40/40/20** | PARAMS.md §1.5, PROJECT_CONTEXT.md, FACT_MAP.md §2A |
| **Домены** | README.md, PROJECT_CONTEXT.md §1, ARCHITECTURE.md |
| **Роли/лестница** | PROJECT_CONTEXT.md §2, FACT_MAP.md §3, README.md |
| **Юридическая модель** | PROJECT_CONTEXT.md §1, money_flow_public.md, Оферта присоединения, Публичная оферта |

---

## 12. РЕШЕНИЯ ВЛАДЕЛЬЦА (Source of Truth)

> **Канонический источник:** `canon/PARAMS.md` (v1.6+), `canon/PROJECT_CONTEXT.md` (v5.1)
> При расхождении — побеждает PARAMS.md.

### 12.1. Комиссия и тарифы

> **Канон:** `canon/PARAMS.md` §1.1–§1.3. Все значения — только там.
> При расхождении — побеждает PARAMS.md.

| Параметр | Канон |
|---|---|
| Нагрузка на точку, пулы, ставки банка, НДС | PARAMS.md §1.1–§1.2 |
| Тарифы СТАРТ/БАЗОВЫЙ/PRO, абонплата | PARAMS.md §1.3 |

### 12.2. Подписка Представителя

> **Канон:** `canon/PARAMS.md` §1.5.

### 12.3. Базовая схема распределения дохода

> **Канон:** `canon/PARAMS.md` §2 (сплит 40/40/20).

- Это **базовая** схема. Все прочие (с банком, арендодателем, ТСП 70/20/6,5/3,5 и т.д.)
  — **вариации / другие системы** для отдельных кейсов, НЕ базовая.
- Юридическая схема `ТСП 70% / Арендодатель 20% / Оператор 6,5% / Банк 3,5%` <!-- doc-canon: historical -->
  (из DOCX) описывает **маршрутизацию 1000₽ клиента на уровне банка**, а НЕ
  распределение комиссии LOVII. Не путать с 40/40/20.

### 12.4. Бренд-палитра (базовая)

> **Канон:** `canon/DESIGN.md` §Палитра.

### 12.5. Роли и лестница

> **Канон:** `canon/PARAMS.md` §Термины (создаётся) + `canon/BRD.md` §Роли.

- Цепочка распространения: `Компания → Амбассадор → Представитель → Партнёр (Точка) → Клиент`
- Лестница: `Представитель → Мэр → Губернатор → Амбассадор → Основатель`

### 12.6. Юридическая модель

> **Канон:** 3 публичных документа `docs/` (класс C) + `canon/Юридический_документ_от_юриста.md`.

### 12.7. Прочее

> **Канон:** `canon/PARAMS.md` §Термины (баллы, домен, онбординг).

---

## 13. OPEN QUESTIONS

1. **Живая палитра `app.lovii.ru`** (сине-серая/маджента) — унифицировать под розовую базу или оставить?
2. **Баллы 5%** — прописаны только в PDF, отсутствуют в PARAMS.md. Уточнить у владельца.
3. **Активные пользователи MVP** — PDF даёт «>5 000» (OCR-неоднозначно). Уточнить при необходимости.

---

*Generated by Sisyphus from full document corpus analysis.*
*Канонический источник: `PARAMS.md`, `PROJECT_CONTEXT.md`, `docs/money_flow_public.md`, `docs/Публичная_оферта.md`, `docs/Оферта_присоединения.md`.*

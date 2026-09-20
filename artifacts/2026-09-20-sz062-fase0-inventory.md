# SZ-062 · Фаза 0 — Свежие клоны и инвентаризация (ART-0)

**Задача:** SZ-062 · **Фаза:** 0 — свежие клоны и инвентаризация
**Загружен:** 2026-09-20 · **Проверено на:** lovii-demo `master` a8a86be · lovii-design `main` 0e93f47 · lovii-app `staging` 6d1d79e · lovii_docs `main` 959c563 (дата клонов 2026-09-20)
**Статус:** 🟩 — инвентаризация выполнена; расхождение с Приложением A спеки (см. §4)

## 1. Клоны (свежие, чистые, 2026-09-20)

| Репо | Ветка | Commit | Роль в задаче |
|---|---|---|---|
| lovii-demo | master | `a8a86be` | правим CSS/иконки |
| lovii-design | main | `0e93f47` (v1.16.2) | только чтение (канон токенов) |
| lovii-app | staging | `6d1d79e` | только сверка |
| lovii_docs | main | `959c563` | артефакты |

Клоны: `~/LOVII/sz062-2026-09-20/` (git clone --depth 1, чистые).

## 2. Инвентаризация CSS/JS

| Объект | Значение |
|---|---|
| `css/lovii.css` | 3915 строк, 1755 правил (по `{`), 919 уникальных классов (селекторная сторона) |
| `assets/lovii-tokens.css` | 103 токена (108 определений с dark-оверрайдами); 4 токена в `lovii.css` |
| JS-файлы | 18 в `js/` + `sw.js` (классические скрипты, общий window-скоуп) |
| `index.html` | 43 class-атрибута, 17 id (дублей нет), `?v=` версии: css/v53, tokens/v19 |
| Иконки | `js/icons.js`: реестр `LV_ICONS` — **61 иконка** (в тексте спеки было «49» — устарело) |
| design/ | 12 playground-страниц (не часть продакшн-витрины) |

## 3. Реестр иконок (61)

`pin search sliders minus cart bag package chev-down chev-left chev-right x footprints sparkles star clock plus trash check arrow-right store user heart bar-chart line-chart trending-up trending-down users crown wallet send message settings edit download building network arrow-up-right banknote percent check-circle pie logout moon sun share smartphone monitor copy qr rotate arrow-down-left gift ticket shield nfc bell lock info coins delete scan-face`

## 4. Роуты — расхождение с Приложением A спеки ⚠️

Авторитетный источник — `parseHash()` в `js/app.js`. Фактический `known`-список:

`home, store, product, search, cart, orders, order, profile, wallet, stores, popular, settings, checkout, addresses, address, profile-edit, auth, apply, dash, chat, msp-signup, msp`
+ спец-обработка `#/cab/rep`, `#/cab/amb`, `#/cab/msp` (сидят роль).

**Спека (Приложение A) не содержит** `#/search`, `#/cart`, `#/profile`, `#/profile-edit`, `#/apply`, `#/chat` — они есть в коде. На фазе 0 список роутов уточнён; объём валидации фазы 5 должен это учесть.

## 5. Сверка снимка «Входное состояние» — совпадает

Все контрольные числа совпали с таблицей спеки (3915 строк, 52 hex, 3 `!important`, 103 токена). Обновлено: число иконок (61, не 49).

## 6. Базовое состояние (runtime, локальный стенд)

Локальный стенд: `python3 -m http.server 8090` из клона demo; обход системным Chrome через playwright. Рантайм-обход Приложения A (390/1280 × light/dark): **0 ошибок консоли, 0 горизонтальных переполнений, 0 видимых SVG 0×0**. Баг стрелок профиля (RES-009 §1) в a8a86be закрыт (осталось только у скрытых `display:none` svg — ложные срабатывания).

## 7. Доработки инструментария (копия в tools-audit обновлена)

- `lv_tokdiff.py` / `lv_cabvals.py` / `lv_cabdiff.py` — убран хардкод путей прошлой сессии, теперь принимают `<demo-root> <app-root>` из argv.
- `lv_runtime_audit.py` — добавлен `--channel` (системный chrome) и **фильтр видимости** SVG (скрытые `display:none` больше не дают ложных 0×0).

## 8. Сырьё артефакта

`_audit/audit-out.txt` (полный прогон фаз 1), `_audit/runtime-classes.json` (549 классов в DOM на базовом рендере), `_audit/shots-before/` (базовые скриншоты).

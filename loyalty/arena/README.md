# arena/ — пакет «Конструктор лояльности» (arena-ветка axiiom)

**Дата:** 2026-09-22
**Источник:** ветка `arena/01a0c9b6-axiiom` репозитория
`bestdeejay-design/axiiom` (коммит `93e791b`, автор Arena Agent).
Архив: `https://github.com/bestdeejay-design/axiiom/archive/refs/heads/arena/01a0c9b6-axiiom.zip`
Живой сайт (пока 404 — ветка не смержена в `main`): `axiiom.ru/docs/lovii-loyalty-constructor/`, `axiiom.ru/demo/app/loyalty-constructor/`.

## Состав

| Папка | Что это |
|---|---|
| `lovii-loyalty-constructor/` | пакет документации: README + AGENTS.md + главы 01–10 (18 механик LM-01…LM-18, движок правил, модель данных, API, UI, аналитика, интеграции, NFR, план E0–E13) + `schema/` (JSON Schema кампании, OpenAPI 3.1, DDL PostgreSQL) + `examples/` (20 кампаний, 36 golden-кейсов, раннер) + `index.html` (одна собранная страница) |
| `prototype/` | интерактивный прототип (механика → настройка → клиент → касса): `engine.js` — референсный движок quote/commit/планировщик, `templates.js` — 18 шаблонов, `demo-data.js` |

## Локальная проверка

```bash
# golden-кейсы (пути run-golden.mjs / build-examples.mjs переведены на ../prototype/)
cd lovii_docs/loyalty/arena/lovii-loyalty-constructor
node examples/run-golden.mjs          # ожидание: 36 passed, 0 failed

# просмотр
cd lovii_docs/loyalty/arena && python3 -m http.server 4175
# док-пак: http://localhost:4175/lovii-loyalty-constructor/index.html
# прототип: http://localhost:4175/prototype/index.html
# (обе страницы рассчитаны на окружение сайта axiiom.ru — часть хрома
#  /styles.css, /nav.js и шрифты локально 404, это не влияет на содержимое;
#  прототип самодостаточен: app.js импортирует ./engine.js и т.д.)
```

## Связь с остальным комплектом

Соседние `cashback-constructor.md` (SZ-070) и `promo-constructor.md` (SZ-071) —
**другая модель** того же продукта (6 триггеров × 5 наград, `promo_rules` jsonb,
комбо = `merchant_offers` bundle, демо в `lovii-demo` #/msp). Пакет arena — 18
механик со своей кампанией-spec и движком. Модели НЕ совместимы напрямую; какую
считать каноном — решение владельца. До решения ни один из комплектов не является
источником истины для реализации.

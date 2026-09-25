# Примеры и тесты

| Папка / файл | Что это |
|---|---|
| [`campaigns/`](campaigns/lm-01-threshold.json) | 20 валидных спецификаций кампаний (`spec_version` 1.0) — по одной на механику LM-01…LM-18 плюс режимы LM-04 (`flat`, `ladder`, `category`). Файлы `lm-NN-*.json`. |
| [`build-examples.mjs`](build-examples.mjs) | Генерирует `campaigns/*.json` из шаблонов прототипа (`/demo/app/loyalty-constructor/templates.js`) с демо-параметрами. Запуск: `node examples/build-examples.mjs`. |
| [`testcases/`](testcases/README.md) | Golden-кейсы: вход `quote`/планировщика → ожидаемый результат. Описание формата и правила добавления — в [testcases/README.md](testcases/README.md). |
| [`run-golden.mjs`](run-golden.mjs) | Раннер golden-кейсов на референсном движке (`node examples/run-golden.mjs`, `--update`, фильтр по подстроке). Код выхода ≠ 0 при расхождениях — годится для CI. |

Проверка схемы примеров:

```bash
npx --yes ajv-cli validate -s schema/campaign.schema.json -d "examples/campaigns/*.json" --spec=draft2020
```

Список файлов кампаний:

* [`lm-01-threshold.json`](campaigns/lm-01-threshold.json) — `От 450 ₽ — +60 баллов`
* [`lm-02-bundle.json`](campaigns/lm-02-bundle.json) — `Кофе + выпечка = 349 ₽`
* [`lm-03-addon.json`](campaigns/lm-03-addon.json) — `Чизкейк за 199 ₽ к кофе`
* [`lm-04-cashback-category.json`](campaigns/lm-04-cashback-category.json) — `Кэшбэк по категориям: десерты 10 %, кофе 3 %`
* [`lm-04-cashback-flat.json`](campaigns/lm-04-cashback-flat.json) — `Кэшбэк 5 % баллами`
* [`lm-04-cashback-ladder.json`](campaigns/lm-04-cashback-ladder.json) — `Кэшбэк до 8 % — чем больше чек, тем выше`
* [`lm-05-happy-hours.json`](campaigns/lm-05-happy-hours.json) — `Выпечка −30 % ежедневно 19:00–21:00`
* [`lm-06-stamps.json`](campaigns/lm-06-stamps.json) — `6-й напиток бесплатно`
* [`lm-07-tiers.json`](campaigns/lm-07-tiers.json) — `Уровни: bronze → silver → gold`
* [`lm-08-subscription.json`](campaigns/lm-08-subscription.json) — `Абонемент: 10 напитков за 1 800 ₽`
* [`lm-09-challenge.json`](campaigns/lm-09-challenge.json) — `Утренний ритуал: 3 визита за 7 дн. → +300 баллов`
* [`lm-10-welcome.json`](campaigns/lm-10-welcome.json) — `+100 баллов за первую покупку`
* [`lm-11-referral.json`](campaigns/lm-11-referral.json) — `Приведи друга — +500 баллов`
* [`lm-12-cross-promo.json`](campaigns/lm-12-cross-promo.json) — `Купон −15 % в «Слойка» после покупки`
* [`lm-13-coupon.json`](campaigns/lm-13-coupon.json) — `Промокод DAILY15: −15 % на завтраки`
* [`lm-14-winback.json`](campaigns/lm-14-winback.json) — `Мы скучали: +300 баллов на 10 дней`
* [`lm-15-birthday.json`](campaigns/lm-15-birthday.json) — `Десерт в подарок ко дню рождения`
* [`lm-16-instant-win.json`](campaigns/lm-16-instant-win.json) — `Крути колесо от 700 ₽`
* [`lm-17-gift-card.json`](campaigns/lm-17-gift-card.json) — `Подарочные сертификаты 2 000 ₽ / 3 000 ₽ / 5 000 ₽`
* [`lm-18-review.json`](campaigns/lm-18-review.json) — `+50 баллов за отзыв с фото`

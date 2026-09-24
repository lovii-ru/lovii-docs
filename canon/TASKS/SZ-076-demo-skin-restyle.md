# SZ-076 — Натянуть дизайн-систему демо на приложение (рестайл по экранам)

**Статус:** предложен (ждёт подтверждения владельца) · **Репо:** `lovii-app` (+ мелкие правки `lovii-core` при необходимости)
**Источник шкурки:** `lovii-demo/css/lovii.css` (3882 строки, ~200 семейств классов) + `css/loyalty.css`
**Эталон:** <https://lovii.mobiap.com/#/msp> и кадры `lovii-demo/shots/`, `lovii_docs/loyalty/prototypes/assets/lv-demo/`

## Идея
Демо проработано по дизайн-системе и «выглядит так, как хочу видеть». Приложение на staging
устроено иначе. Задача — **перенести шкурку демо** на приложение, экран за экраном, не меняя
логику: посмотрел экран демо → натянул → сверил → подправил → следующий.

## Принцип работы (на каждый экран)
1. Снять демо-кадр (Playwright, 390 и 1280) и кадр приложения того же экрана.
2. Перенести разметку/классы экрана на компоненты шкурки (`mini-card`, `row-item`, `seg`,
   `stat-pill`, `f-field`, `paycard`, `home-hero`, `nearby-store`, `cart-summary`, `order-*` …),
   на токенах `lovii-design`. Хардкод цвета/радиуса запрещён (DS-guard).
3. Сверить кадры, поправить расхождения (сетка/отступы/типографика/состояния).
4. Гейт `yarn test` (format/lint/unit/type-check/build + DS-guard) → мерж в `staging` → деплой.
5. Строка в трекере: экран, коммит, скрин-пара, отклонения.

## Общий слой
- `src/scss/demo-skin/` — примитивы шкурки (карточки/строки/пилюли/сегменты/поля/таб-бар/хедер)
  как порт `lovii.css` на токены. Экраны подключают примитивы, не дублируют.
- Для лояльности это уже сделано: `modules/roles-module/msp/loyalty/loyalty.scss` (порт `loyalty.css`).

## Список экранов (предлагаемый порядок)
### A. Покупатель
| # | Экран | Приложение | Демо | Статус |
|---|---|---|---|---|
| 1 | Главная | `home-module/HomeModule.vue` | `renderHome` | не начат |
| 2 | Популярное | `popular-stores/PopularStores.vue` | `home-popular` | не начат |
| 3 | Каталог точек | `stores-catalog/StoresCatalog.vue` | `renderSearch`/stores | не начат |
| 4 | Витрина точки | `store-module/StoreModule.vue` | `renderStore` | не начат |
| 5 | Товар | `store-product/StoreProduct.vue` | `renderProduct` | не начат |
| 6 | Корзина | `cart-module/CartModule.vue` | `renderCart` | не начат |
| 7 | Оформление | `create-order/CreateOrder.vue` | `checkout` | не начат |
| 8 | Заказы / заказ | `profile-orders/OrdersModule.vue`, `profile-order/ProfileOrder.vue` | `renderOrders` | не начат |
| 9 | Профиль | `profile-module/ProfileModule.vue` | `profile` | не начат |
| 10 | Кошелёк/баланс/операции/переводы | `profile-balance/*` | `wallet` | не начат |
| 11 | Адреса | `profile-addresses/ProfileAddresses.vue` | `addresses` | не начат |
| 12 | Авторизация/OTP | `auth-module/AuthModule.vue` | `auth` | не начат |

### B. Кабинет МСП (`dash`/`msp`)
| # | Экран | Приложение | Демо | Статус |
|---|---|---|---|---|
| 13 | Обзор точки | `roles-module/msp/MspOverview.vue` | `dash` | не начат |
| 14 | **Промо** | `roles-module/msp/MspLoyalty.vue` | `msp` | **сделано** (шкурка `lv-*`) |
| 15 | Товары | `roles-module/msp/MspProducts.vue` | `msp` | не начат |
| 16 | Настройки точки | `roles-module/msp/MspBranchSettings.vue` | `msp` | не начат |
| 17 | Команда | `roles-module/msp/MspTeam.vue` | `msp` | не начат |
| 18 | Заказы точки / чаты | `roles-module/team/*`, `ChatStub.vue` | `dash` | не начат |

### C. B2B / платформа
| # | Экран | Приложение | Демо | Статус |
|---|---|---|---|---|
| 19 | Заявка/лендинг бизнеса | `business-module/*` | `cab` | не начат |
| 20 | Представитель | `roles-module/representative/*` | `dash` | не начат |
| 21 | Платформа (владелец) | `platform-module/*` | `dash` | не начат |

## DoD экрана
- Скрин-пара «приложение ↔ демо» на 390 и 1280, расхождения устранены.
- Нет хардкода цвета/радиуса (DS-guard), `yarn test` зелёный.
- Смержено в `staging`, деплой успешен, строка в трекере обновлена.

## Дальше
Начать с №1 «Главная» (самый видимый экран). По ходу уточнять список (демо покрывает не всё
один-в-один; экраны без демо-эталона помечаем отдельно).

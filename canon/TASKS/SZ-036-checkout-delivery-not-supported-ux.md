# SZ-036 — Чекаут: «точка не доставляет» показывать честно, а не «проверьте адрес»

> Статус: **На приёмке** (zcode, 2026-09-11) · Приоритет: **P1** (владелец принял
> за зависание приложения при живом тесте пушей SZ-010)
> Исполнитель: Super Z · Репо: `lovii-app` (+ при необходимости `lovii-core` код ошибки)
> Гейт: `yarn test`; приёмка zcode — воспроизведение на staging (Пышки 1024)

## 1. Факт (staging, 2026-09-11 23:16 UTC, user 51)

- Корзина «Пышки & Пончики» → «Оформить заказ» → экран чекаута → `POST
  /api/v1/orders/preview` → **422** `delivery_not_supported`
  («Merchant Пышки & Пончики does not support delivery», `CheckoutBuilder.php:82`):
  у филиала 1024 `delivery_available=false`, `pickup_available=true`, а
  чекаут стартует с `deliveryType = "delivery"` по умолчанию.
- App (`CreateOrder.vue::loadOrderCheckout`) на любую ошибку preview пишет
  одну строку «Не удалось рассчитать заказ — проверьте адрес и попробуйте
  ещё раз» и оставляет `checkout = null`. **Корень «пустого экрана»:** весь
  контент страницы обёрнут в `v-if="cart && checkout"` — при ошибке preview
  не рендерятся ни переключатель `CreateOrderDeliveryType`, ни сам
  `checkoutError`-алерт; остаётся только шапка «Оформление заказа».
  `deliveryType` — локальный ref `"delivery"` по умолчанию, из корзины/роута
  не приходит ⇒ выбрать самовывоз до расчёта невозможно. Владелец: «экран и
  не загружается».

## 2. Ожидаемый результат

1. Ошибки preview/create различать по `code` ответа core
   (`delivery_not_supported`, `merchant_unavailable`, `merchant_closed`,
   валидация) — текст пользователю по коду, а не одна универсальная строка.
2. Для `delivery_not_supported`: «Эта точка не доставляет — заберите
   самовывозом» + кнопка/автопереключение на «Самовывоз» (и симметрично для
   pickup). Ещё лучше — стартовый `deliveryType` брать из флагов филиала
   (`delivery_available`/`pickup_available` уже есть в payload точки/корзины —
   проверить), недоступный режим в `CreateOrderDeliveryType` — disabled с
   подписью.
3. Экран не должен выглядеть пустым: при ошибке — карточка с причиной и
   действием, кнопка «Повторить».
4. Тесты: vitest на маппинг кодов → тексты; e2e-сценарий «точка только
   самовывоз» (staging, Пышки 1024).

## 3. NB

- Данные точки менять ТОЛЬКО через b2b (владелец): для теста пушей он либо
  тапает «Самовывоз», либо включает «Доставка» у филиала в b2b-staging
  (зона не обязательна — без зоны fee = 0, `resolveDeliveryFee`).
- `errorHandler(e, false)` глушит сообщение в console.error — стор/хелпер
  не трогать без нужды; решение — на уровне страницы чекаута.


## 4. Отчёт исполнителя (Super Z, 2026-09-11)

- **Core `fafb100`**: GetCartByIdQuery — eager-load `items.branch` (оба пути);
  CartResource — `delivery_available`/`pickup_available` (nullable, от филиала
  первой позиции; null = без филиала — режимы не режем); openapi.yaml Cart + 2
  свойства; +2 Pest (флаги отдаются / null без филиала).
- **App `38cba47`**: `order-errors.ts` — getApiErrorCode (`error.code` из ответа
  core) + честные тексты по кодам (delivery_not_supported /
  merchant_unavailable / merchant_closed / too_many_requests / валидация 422 /
  нейтральный дефолт) для preview и create; CreateOrder — стартовый
  deliveryType из флагов корзины (root cause зависания закрыт), автопереключение
  на доступный способ при delivery_not_supported (watch перезапускает расчёт,
  без дубля запроса на маунте), состояние ошибки больше не пустое: переключатель
  + причина + «Повторить» (testid checkout-retry); CreateOrderDeliveryType —
  недоступные режимы disabled; AppSegmentControl — per-segment disabled.
- Тесты: +11 vitest (маппинг кодов), полный прогон 347/347; vue-tsc/oxlint/eslint
  чисты.
- NB §4 выполнено: e2e «точка только самовывоз» = живой сценарий Пышки 1024
  (приёмка владельца); данные точки не менялись.

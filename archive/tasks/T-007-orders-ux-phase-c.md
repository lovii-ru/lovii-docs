> ⚠️ **АРХИВ.** Карточка закрыта и не является текущим источником требований; сохранена только для истории.

# T-007 — UX-фаза C: заказы (profile-orders / profile-order) по SZ-002

> Статус: **Закрыта** (приёмка-1 zcode «Достаточно» 2026-09-10; приёмка-2 Super Z «Достаточно» 2026-09-11; визуальная приёмка владельца — по желанию)
> Приоритет: P1 · Источник: SZ-002 §3 фаза C (дефекты C1–C4) · Спека: SZ-002
> Исполнитель: Super Z · Постановил: Super Z · Приёмка: zcode (§3.1) + визуальная — владелец на staging
> Репо: lovii-app, ветка `staging` · Дата: 2026-09-09

## Цель

Карточка заказа в общей карточной системе; сводка заказа — один компонент
для чекаута и детальной страницы; тип получения виден без догадок.
Функциональность не меняется.

## Отчёт исполнителя

Выполнена Super Z 2026-09-09 в составе единой серии SZ-002 фаз A/B/C,
lovii-app staging: `0da6a82` (+ merge `bc860ea`), session-док
`docs/sessions/021-ui-ux-profile-checkout.md`.

- C1 — `OrderPreview`: radius 8→16, padding 8→12/16, active-фон
  (`--background-other-soft-neutral`); список `OrdersModule` — ритм
  gap 8→16.
- C2 — дубли сводки устранены: общий `src/components/OrderSummery.vue`
  (props: subtotal/deliveryFee/deliveryType/total/loading);
  `CreateOrderSummery.vue` и `profile-order/components/OrderSummery.vue`
  удалены; чекаут и детальная страница используют один компонент.
- C3 — ревизия детальной: `OrderInfo`/`OrderProducts` уже в системе
  (surface/16, разделители subtle) — без правок; ошибка оплаты переведена
  на алерт-паттерн A5 (subtle-фон + `IconCircleErrorRegular`).
- C4 — тип получения: мини-лейбл `AppBadge` xs («Доставка»/«Самовывоз»);
  для pickup строка «Самовывоз: {адрес}» разбирается, адрес выводится
  отдельно (бэкенд-формат `OrderList.address` — API не менялся).

Проверки: oxlint/eslint 🟢, vitest 214 🟢 (+4 OrderSummery.test.ts:
строки/скрытие доставки для pickup/loading), vue-tsc 🟢, build 🟢.
Селекторы e2e (`order-card`, `pay-order`, `order-pay-block`) не тронуты.

## Что НЕ делать (стоп-лист — как в SZ-002 §4)

- НЕ менять API/stores/роутинг/флоу оплаты; НЕ трогать `data-testid`;
  только токены DESIGN.md; dark/light — оба проверять.

## Критерии приёмки

- Карточки заказов radius 16, padding 12–16, активное состояние видно.
- Сводка заказа — один компонент в чекауте и детальной странице.
- Pickup-карточка показывает «Самовывоз» + адрес, delivery — «Доставка».
- typecheck/vitest/сборка 🟢, CI 🟢.

## Приёмка zcode (§3.1) — 2026-09-10

Факт-чек по коду lovii-app staging (`bc860ea`, CI 🟢 run 34380270533):

- **C1** — `OrderPreview.vue`: `border-radius: 16px` + `:active`-фон
  (строки 77/80); `OrdersModule.vue` `gap: 16px` ✓.
- **C2** — единственный `src/components/OrderSummery.vue` существует;
  `CreateOrderSummery.vue` и `profile-order/components/OrderSummery.vue`
  удалены (find — 0 результатов) ✓; CreateOrder использует общий компонент
  (см. T-005, строка 189) ✓; тест `OrderSummery.test.ts` на месте ✓.
- **C4** — `OrderPreview.vue`: `PICKUP_PREFIX = "Самовывоз:"` + разбор адреса
  (строки 18–20), мини-лейбл `AppBadge xs` «Самовывоз»/«Доставка» (строка 51) ✓.
- Селекторы e2e целы: `order-card` (OrderPreview), `pay-order`/`order-pay-block`
  (ProfileOrder, CreateOrderSuccess) ✓.

**Вердикт: «Достаточно»** (приёмка-1; приёмка-2 — Super Z, визуальная — владелец).

## Приёмка-2 Super Z — 2026-09-11: «Достаточно»

Сверка по дефектному списку SZ-002 §3 соответствующей фазы в коде
(lovii-app, staging):
- C1 карточка заказа радиус 16 / padding 12-16 ✓; C2 дублирование сводок
  устранено общими `components/OrderSummery.vue` + `OrderReceipt.vue`
  (переиспользованы в чекауте, успехе чекаута и детальной заказа) ✓;
  C3 детальная страница ревизована — OrderInfo/OrderProducts в карточной
  системе (radius 16) ✓; C4 pickup-кейс — AppBadge «Самовывоз/Доставка» +
  парсинг префикса «Самовывоз: {адрес}» ✓.
- Тесты: orders/receipt/summery 16/16.

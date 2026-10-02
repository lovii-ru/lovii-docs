# APP-M-009 — Информация о заведении (StoreInfoSheet)

<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код; канон — canon/PARAMS.md -->

- Статус: живая
- Открытие: компонент `StoreInfoSheet` — `modules/store-module/components/StoreInfoSheet.vue`; нижняя шторка на базе `AppBottomSheet` (StoreInfoSheet.vue:4). Точка входа: `modules/store-module/components/StoreCard.vue:4` (StoreCard рендерится на странице заведения — `modules/store-module/StoreModule.vue:2`)
- Родитель: APP-P-004 (карточка заведения)
- Назначение: шторка с деталями точки заведения — адрес, график работы, минимальная сумма заказа, статус доступности.
- Функциональные блоки:
  - #address — адрес точки (`branch.address_line`); StoreInfoSheet.vue:89–93
  - #schedule — график работы из `branch.schedule` (человекочитаемые строки); StoreInfoSheet.vue:67, 94–100
  - #availability — человекочитаемый статус точки из availability (SZ-024 §2.4); StoreInfoSheet.vue:19+
  - #min-order — минимальная сумма заказа (`min_order_amount`, formatPrice); StoreInfoSheet.vue:49+
- Состояния: данные точки есть / данные ветки отсутствуют (секции скрываются по v-if) / закрыта
- Зависимости: `useStoreStore` (store, branch), `formatPrice`, иконки `IconMapPinRegular`/`IconScheduleRegular`, `AppBottomSheet`
- Переходы: → APP-P-004 (закрытие возвращает на страницу заведения)
- Сверка: роутер n/a / код ✓ / UI ✗ (скрины — отдельный съём)

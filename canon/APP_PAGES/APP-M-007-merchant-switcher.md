# APP-M-007 — Свитчер мерчантов/брендов (MerchantSwitcher)

<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код; канон — canon/PARAMS.md -->

- Статус: живая
- Открытие: компонент `MerchantSwitcher` — `modules/roles-module/components/MerchantSwitcher.vue`; нижняя шторка на базе `AppBottomSheet` (MerchantSwitcher.vue:4, инстанс :67). Точка входа: `modules/roles-module/CabinetLayout.vue:5,222` (по meta `cabinetPartnerSwitcher`)
- Родитель: APP-P-044 (и другие страницы кабинета МСП в CabinetLayout)
- Назначение: выбор мерчанта (бренда) внутри активного юрлица — средняя ступень каскада «юрлицо → мерчант → точка» (SZ-076).
- Функциональные блоки:
  - #chip — чип активного бренда со статистикой «N точек · M товаров» (offers_count); MerchantSwitcher.vue:22–26
  - #merchant-list — список брендов юрлица из `msp.store` (`partnerMerchants`), выбор активного; шит :67+
  - #add — emit `add` → добавление мерчанта (обрабатывает CabinetLayout)
- Состояния: один бренд / несколько брендов / бренды не загружены (кэш обзора пуст)
- Зависимости: `useMspStore` (partnerMerchants, activeMerchant), `plural` (money.ts), `AppBottomSheet`, `AppButton`
- Переходы: → смена бренда обновляет точки/KPI кабинета APP-P-044+; переключает контекст APP-M-008
- Сверка: роутер n/a / код ✓ / UI ✗ (скрины — отдельный съём)

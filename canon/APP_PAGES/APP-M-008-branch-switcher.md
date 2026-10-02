# APP-M-008 — Свитчер точек (BranchSwitcher)

<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код; канон — canon/PARAMS.md -->

- Статус: живая
- Открытие: компонент `BranchSwitcher` — `modules/roles-module/components/BranchSwitcher.vue`; нижняя шторка на базе `AppBottomSheet` (BranchSwitcher.vue:4, инстанс :73). Точка входа: `modules/roles-module/CabinetLayout.vue:6,226` (по meta `cabinetPartnerSwitcher`)
- Родитель: APP-P-044 (и другие страницы кабинета МСП в CabinetLayout)
- Назначение: выбор торговой точки внутри выбранного бренда — нижняя ступень каскада «юрлицо → мерчант → точка» (SZ-076). Точка определяет заказы, настройки и KPI кабинета.
- Функциональные блоки:
  - #chip — чип активной точки с подписью «адрес · N товаров» (паттерн бренда); BranchSwitcher.vue:19–23
  - #branch-list — список точек активного мерчанта (`merchantBranches`), выбор `activeBranchId`; шит :73+
  - #add — emit `add` → добавление точки (обрабатывает CabinetLayout)
- Состояния: одна точка / несколько точек / точек у бренда нет
- Зависимости: `useMspStore` (merchantBranches, activeBranchId), `AppBottomSheet`, `AppButton`
- Переходы: → смена точки обновляет контекст APP-P-044+; добавление точки → APP-P-022/запуск точки APP-P-052
- Сверка: роутер n/a / код ✓ / UI ✗ (скрины — отдельный съём)

# APP-M-006 — Свитчер юрлиц (PartnerSwitcher)

<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код; канон — canon/PARAMS.md -->

- Статус: живая
- Открытие: компонент `PartnerSwitcher` — `modules/roles-module/components/PartnerSwitcher.vue`; нижняя шторка на базе `AppBottomSheet` (PartnerSwitcher.vue:2, инстанс :60, открывается только если юрлиц больше одного). Точка входа: `modules/roles-module/CabinetLayout.vue:4,206` (по meta `cabinetPartnerSwitcher`)
- Родитель: APP-P-044 (и другие страницы кабинета МСП в CabinetLayout — шапка кабинета)
- Назначение: переключение активного юрлица (ИНН) в кабинете МСП — верхняя ступень каскада «юрлицо → мерчант → точка» (SZ-050 Ф1).
- Функциональные блоки:
  - #chip — чип в шапке с маской ИНН (`····NNNN`); PartnerSwitcher.vue:20–22, template :36+
  - #partner-list — список юрлиц из кэша обзора `msp.store`, выбор `setActivePartner(id)`; PartnerSwitcher.vue:26–29, шит :60+
  - #add — «Добавить юрлицо» → существующая заявка с ИНН; PartnerSwitcher.vue (шит, кнопка добавления)
- Состояния: одно юрлицо (чип без шита) / несколько юрлиц (чип открывает шит) / нет активного юрлица (чип скрыт)
- Зависимости: `useMspStore` (partners, activePartner, setActivePartner), localStorage (последний выбор), `AppBottomSheet`, `AppButton`
- Переходы: → APP-P-022 (добавление юрлица, /business/apply); переключение меняет контекст APP-P-044+
- Сверка: роутер n/a / код ✓ / UI ✗ (скрины — отдельный съём)

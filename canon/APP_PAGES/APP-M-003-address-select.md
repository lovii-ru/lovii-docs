# APP-M-003 — Выбор адреса доставки (AddressSelectSheet)

<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код; канон — canon/PARAMS.md -->

- Статус: живая
- Открытие: компонент `AddressSelectSheet` — `components/AddressSelectSheet.vue`; нижняя шторка на базе `components/Ui/AppBottomSheet.vue` (AddressSelectSheet.vue:4, инстанс :91). Точки входа: `components/AppHeader.vue:8` (пилюля адреса), `modules/geolocation-module/components/GeolocationSearch.vue:8` (кнопка «из сохранённых» внутри APP-M-002), `modules/create-order/components/CreateOrderDeliveryType.vue:9` (чекаут, «карандаш» адреса)
- Родитель: APP-P-001 (шапка) и APP-P-007 (шаг доставки чекаута); также внутри APP-M-002
- Назначение: общий шит выбора адреса доставки — из списка сохранённых адресов пользователя или переход к добавлению нового (карта). F-029: пилюля шапки и чекаут используют один и тот же шит.
- Функциональные блоки:
  - #saved-list — список сохранённых адресов (`useAddressStore`), выбор адреса emit `selected` и закрытие; AddressSelectSheet.vue:27–51, список в template :95–140
  - #edit — кнопка-карандаш у адреса (переход к правке адреса); AddressSelectSheet.vue:121
  - #add-new — «Добавить новый адрес» → emit `open-map`: карту открывает родитель (владелец карты — родитель); AddressSelectSheet.vue:145
- Состояния: пустой список (только «добавить») / список сохранённых / загрузка адресов
- Зависимости: `useAddressStore` (modules/address/store/address.store.ts), `useSystemStore`, `formatAddressLabel`, `AppBottomSheet`
- Переходы: → APP-M-002 (карта, через open-map); → APP-P-017/018/019 (правка адреса, через карандаш); выбор адреса возвращает значение родителю (APP-P-001/APP-P-007)
- Сверка: роутер n/a / код ✓ / UI ✗ (скрины — отдельный съём)

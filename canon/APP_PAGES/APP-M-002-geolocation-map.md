# APP-M-002 — Карта выбора адреса (GeolocationModule)

<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код; канон — canon/PARAMS.md -->

- Статус: живая
- Открытие: компонент `GeolocationModule` — `modules/geolocation-module/GeolocationModule.vue`; fullscreen-оверлей через `<Teleport to="body">` (GeolocationModule.vue:168); точки входа: `components/AppHeader.vue:7` (пилюля адреса в шапке) и `modules/create-order/components/CreateOrderDeliveryType.vue:8` (шаг доставки чекаута)
- Родитель: APP-P-001 (шапка — пилюля адреса, доступна на всех страницах с шапкой) и APP-P-007 (выбор адреса доставки на чекауте)
- Назначение: полноэкранный выбор адреса доставки на карте Яндекс.Карт: перетаскивание маркера, поиск строки, обратное геокодирование, определение «моего местоположения».
- Функциональные блоки:
  - #map — YandexMap с маркером и слушателем действий; GeolocationModule.vue:169–196
  - #zooms — регулятор «ближе/дальше» (+/−); GeolocationModule.vue:202–222
  - #my-location — кнопка центрирования по геолокации пользователя (запрашивает разрешение браузера); GeolocationModule.vue:224–235
  - #search — поисковая панель GeolocationSearch (строка поиска, подсказки `/geo/suggest`, выбранный адрес, кнопка «готово»); GeolocationModule.vue:237–246 + components/GeolocationSearch.vue
- Состояния: карта не готова (скелет/ожидание ymaps) / загрузка геокодирования / ошибка геолокации (toast) / закрыт
- Зависимости: `@yandex/ymaps3-types` (Yandex JS API — ключ `VITE_YANDEX_MAP_API_KEY`), `/geo/reverse` (geoReverse), `/geo/suggest` (через GeolocationSearch), `useSystemStore`, `useUserGeolocation`, AddressSelectSheet (вложенный выбор из сохранённых, GeolocationSearch.vue:8)
- Переходы: → закрытие возвращает адрес в точку открытия (шапка APP-P-001 или чекаут APP-P-007); внутри — открытие APP-M-003
- Сверка: роутер n/a / код ✓ / UI ✗ (скрины — отдельный съём)

# 08. Доставка, адреса, география — как есть

> Срез: 2026-09-17. Рабочая заметка (класс W), не канон. Чекаут-проверки —
> подробнее в [02](02-korzina-checkout.md). Формат — [README](README.md).

## Что это

Доставка = тумблер точки + зоны (радиус/полигон с ценой), самовывоз = тумблер.
Адреса хранятся в профиле (PostGIS). Геокодирование — серверный прокси к Яндексу.
Курьеров, слотов и трекинга нет.

## Тумблеры точки

- `merchant_branches.delivery_available / pickup_available`, boolean default false
  (миграция 000006:20–21).
- Включаются **только в b2b**: BranchResource:95–100 (секция operations, рядом
  min/max_delivery_minutes и min_order_amount).
- Из кабинета МСП в app тумблеры **недоступны** — UpdateMspBranchSettings
  принимает только name/address/часы/min_order (UpdateMspBranchSettingsController.php:28–33).
- Проверка — в чекауте (`delivery_not_supported`, CheckoutBuilder.php:81–87);
  на витрину пробрасываются флагами корзины (CartResource.php:32–43).

## Зоны доставки (MerchantDeliveryZone)

- Поля: zone_type (radius/polygon), radius_meters, polygon (geography, GIST-индекс),
  delivery_fee, free_from_amount, min/max_eta_minutes, is_active (миграция 000008
  + 2026_03_24_000005).
- **UI есть в b2b**: RelationManager у филиала — круг или полигон на Яндекс-карте,
  fee/free_from/ETA (DeliveryZonesRelationManager.php:38–186; полигон пишется через
  `ST_GeogFromText`). Сидеров зон нет.
- **Использование в чекауте — урезанное**: берётся **первая активная** зона точки
  (без сортировки, без проверки адреса на вхождение) только для расчёта fee:
  subtotal ≥ free_from → 0, иначе delivery_fee; зоны нет → 0
  (CheckoutBuilder.php:111–125). `min/max_eta_minutes` нигде не читаются.
- Гость видит `delivery_options` в инфо-карточке точки — захардкоженный enum
  («Бесплатная доставка» и т.п.), с реальными тумблерами не связан (см. [01](01-vitrina-katalog.md)).

## Расстояния и города

- `distance_km` — PostGIS `ST_Distance(location, point)/1000`, считается в SQL
  выборках (GetHomeQuery.php:124–138, GetStoresQuery.php:44–109 — ближайший филиал
  через `DISTINCT ON (merchant_id)`), GIST-индексы на cities/branches/addresses.
- Города: дедуп дублей сделан миграцией SZ-004 (канон = строка с максимумом
  ссылок, rebind веток/адресов/корзин).
- Выборка витрины по городам: только через координаты — города в радиусе 30 км
  (`GEO_NEARBY_RADIUS_KM`, FindNearbyCitiesQuery.php:33–42, кэш ~1 ч, фолбэк —
  ближайший город) → `whereIn(city_id)`. Прямого city_id-параметра у витрины нет;
  `GET /cities` — поиск по префиксу (ё→е), `GET /cities/nearest` — тот же радиус.

## Адреса пользователя

- `UserAddress`: city_id, label, address_line, street/house, entrance/floor/
  apartment/intercom, comment, location geography (lat/lon выдаются через ST_X/ST_Y —
  UserAddress.php:43–55), is_default.
- Ограничения: lat/lon обязательны и приходят от клиента (геокодинг клиентом через
  серверный `/geo/*`); сервер сам Яндекс не вызывает. Лимита на количество адресов нет.
- CRUD: `/profile/addresses` (owner-scoped); `is_default` снимается у остальных
  при установке (CreateAddressAction.php:36–41).
- В чекауте адрес без id автоматически сохраняется в профиль (`ensureSavedAddress`,
  CreateOrder.vue:77–121).

## Гео-эндпоинты и карта

- `POST /geo/{resolve,reverse,suggest}` — публичные, серверный прокси к Яндексу
  (geocode/suggest-maps.yandex.ru); без ключа — 503 `geocoder_not_configured`;
  кэша нет; ключ `YANDEX_GEOCODER_API_KEY` + заголовок Referer (config/geo.php:15–24,
  YandexGeocoder.php:179–197).
- Карта в app (Yandex JS API через vue-yandex-maps, `VITE_YANDEX_MAP_API_KEY`) —
  только в geolocation-module: выбор адреса на карте (из шапки и чекаута) и пин в
  форме адреса (AddressPointMap, reverse с дебаунсом 800 мс). На карточке точки
  карты нет.
- Локальное ограничение: JS-ключ привязан к Referer lovii.ru — на localhost карта
  не инициализируется (геокодинг при этом работает — серверный); e2e адресов —
  staging-only с моками `/geo/*`.

## Чего нет (факты)

- Слоты/интервалы доставки — не существуют (ETA зоны хранится, но не используется).
- Курьеры как сущность — нет; «курьерские» статусы ставит сама точка
  (MspOrderActions.php:25–29), интерфейса курьера нет (фаза D).
- Трекинг заказа на карте — нет.
- ПВЗ — нет (самовывоз = выдача из самой точки).
- Проверка адреса на вхождение в зону — нет (главный функциональный пробел доставки).

## Кандидаты в «не хватает» (решает владелец)

1. Гео-проверка зоны: адрес попадает в radius/polygon? (сейчас точка обязана
   доставить куда угодно, если включён тумблер).
2. Правильный выбор зоны (самая дешёвая/содержащая точку), а не «первая активная».
3. ETA из зоны → показ покупателю («доставка 30–60 мин») — данные уже есть.
4. Связать `delivery_options` инфо-карточки с реальными тумблерами точки.
5. Лимит количества адресов / лимит rate на гео-эндпоинты (сейчас публичные без кэша —
   расход квоты Яндекса).

## Сверка владельцем

(пока пусто)

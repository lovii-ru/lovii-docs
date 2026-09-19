# 01. Витрина и каталог — как есть

> Срез: 2026-09-17, **обновлено 2026-09-19** (чипы типов убраны с витрины —
> app d8c3037, минимум заказа энфорсится). Рабочая заметка (класс W), не канон.
> Проценты/суммы — ссылками на канон (`lovii_docs/canon/PARAMS.md`).
> Формат и правила — [README](README.md).

## Что это

Покупатель видит локальные точки (магазины/общепит/услуги/клубы), открывает
карточку точки с товарами, ищет точки и товары. Витрина собирается из двух
каталогов: МСП (`merchant_offers` — создаются точками в b2b) и Kuper-импорт
(`catalog_products` — товары ритейла, привязанные к офферам).

## Путь покупателя (экраны lovii-app)

| Роут | Экран | Что показывает |
|---|---|---|
| `/` | HomeView (`modules/home-module/HomeModule.vue`) | «Популярные заведения» (чипы типов убраны 19.09), статичный баннер (3 webp без API — HomeBanner.vue:4–10), блок «Рядом с вами» из `near_you` |
| `/popular` | PopularStores (`modules/popular-stores/`) | лента «Популярные заведения», курсорная догрузка (PopularStores.vue:31–43) |
| `/stores` | StoresCatalog (`modules/stores-catalog/`) | список точек (чипы типов убраны 19.09), фильтр категорий; при вводе в «Магазин или товар» — debounce 1 с → поиск точек (CatalogSearch.vue:32–46) |
| `/stores/:id` | StoreModule (`modules/store-module/`) | карточка точки (логотип, статус открытия, дистанция, избранное, инфо-лист) + товары; teaser-точка — плашка «Скоро» вместо витрины (StoreModule.vue:22, 70–76) |
| `/stores/:id/product/:productId` | StoreProduct (`modules/store-product/`) | карточка позиции, ± корзина, рекомендации |

Поиск внутри точки — поле «Поиск в заведении» (StoreProducts.vue:113) →
`/search/offers` с `branch_id` (StoreSearch.vue:31–38).

## API (все публичные, без auth — lovii-core `routes/api.php:153–172`)

| Метод + путь | Контроллер | Отдаёт |
|---|---|---|
| GET `/v1/home` | ShowHomeController (api.php:164) | `cities`, `popular_stores`, `popular_restaurants`, `near_you` (HomeResource.php:35–40) |
| GET `/v1/popular-stores` | ListPopularStoresController | курсор `PopularMerchantResource` |
| GET `/v1/stores` | ListStoresController | курсор `StoreCardResource` + категории в `additional` (ListStoresController.php:54–55) |
| GET `/v1/merchants`, `/v1/merchants/{id}` | List/ShowMerchantController | `MerchantResource` (offset-пагинация); teaser-точка в карточке = 404 (ShowMerchantController.php:18–20) |
| GET `/v1/storefront?branch_id=` | ShowStorefrontController | **только** коллекция карточек товаров (ShowStorefrontController.php:31) |
| GET `/v1/storefront/info?branch_id=` | ShowStorefrontInfoController | `branch` (адрес, часы, min_order, дистанция), `merchant` (описание, телефоны, обложка), `delivery_options`, `categories` (строки 39–81) |
| GET `/v1/offers/{id}`, `/offers/{id}/recommendations` | Show/ListOfferRecommendations | полный оффер + `may_like`/`other_store` по 6 шт. |
| GET `/v1/search/offers`, `/v1/search/merchants` | Search*Controller | offset-пагинация; `q`, `branch_id`, `category_id`, `types[]` |
| GET `/v1/cities`, `/v1/cities/nearest` | — | города |

`types[]` валидируется `in:store,restaurant,services,club` (HasMerchantTypes.php:27–32).

## Бизнес-правила

### Гейт верификации витрины (`STOREFRONT_VERIFICATION_GATE`, config/storefront.php:27)
Три состояния (`app/Domain/Storefront/StorefrontState.php:11–21`):
- **Hidden** — нет апрува представителя: точка не показывается вообще;
- **Teaser** — апрув представителя есть, комплаенс (`partners.verified_at`) нет:
  видна в списках с плашкой «Скоро», товары/корзина закрыты;
- **Active** — верифицирована: всё доступно.

Логика: `MerchantVisibility` (`app/Domain/Storefront/MerchantVisibility.php`:
SQL-гейт :51–82, `allowsOrders()` :102–105, `state()` :111–143).
Исключения (всегда Active): `partner_id IS NULL` (:113) и Kuper-импорт
(`integration_entity_mappings.entity_type='retailer'`, :40, :75–80).
Применение: страница teaser-точки = 404 (GetStorefrontCatalogQuery.php:84–90),
в списках teaser виден, офферы/поиск товаров teaser не отдают; карточка товара
не Active = 404 (GetOfferQuery.php:20–24). Индексация поиска гейтится тем же
(`shouldBeSearchable()` у Merchant/MerchantOffer/CatalogProduct).

### Типы точек (merchant_type)
Enum `store | restaurant | services | club`, лейблы «Сети-ритейл / Общепит /
Услуги / Клубы» (`app/Domain/Merchant/Enums/MerchantType.php:9–33`).
**19.09 — чипы типов убраны с витрины** (решение владельца; app d8c3037,
merge 0973a77): на главной и в каталоге фильтров по типам больше нет,
`?types=`-чипы удалены. Бэкенд не тронут: `types[]` в API остаётся
(`HasMerchantTypes.php:27–32`), витрина без `types` отдаёт все типы
(GetStoresQuery.php:26–32). На главной `popular_restaurants` = только общепит
(GetHomeQuery.php:46–55). Впереди — динамические категории по тегам
(механику придумает владелец).

### Схема id
`/stores/:id` = **branch_id** филиала (`exists:merchant_branches,id`,
ShowStorefrontRequest.php:16; StoreModule.vue:31–45). Следствие коллизии
merchant/branch id — решено в SZ-005. `branch_id` в `MerchantResource` — первый
активный филиал, приходит только из поисковой выдачи (MerchantResource.php:32–36).

### «Открыто/закрыто»
Считает **API**: `WorkingHoursService::availability()` (WorkingHoursService.php:50–88).
Статусы: `open, closes_in, opens_at, opens_tomorrow, closed_until,
temporarily_closed` (BranchAvailabilityStatus.php:9–15); `closes_in` — за ≤60 мин.
Пустое расписание = «открыто» (:54–66). Клиент только рендерит (StoreInfoSheet.vue:18–46).

### Категории
- Витрина: дерево `catalog_categories` мерчанта (2 уровня), кэш 2 ч; показываются
  только категории с доступными офферами (GetStorefrontCatalogQuery.php:24, 146–157).
- Чипы категорий в списке `/stores`: `merchant_categories` (many-to-many);
  «взрослые» категории скрыты у гостей/до 21 (ListStoresController.php:43–66).

### Поиск (Scout/Meilisearch)
- Драйвер — `SCOUT_DRIVER` (дефолт `collection`, config/scout.php:25) — без env
  Meilisearch не включён. Индексы: `offers` (MerchantOffer), `merchants`,
  `catalog_products` (настройки scout.php:148–163).
- Поиск товаров: 1 запрос к Meili на (q, branch_id, category_id), до 96 id
  кэшируются 5 мин, страницы собираются из БД (SearchOffersQuery.php:19–66).
- Товары до ввода запроса в разделе поиска не показываются (решение владельца).
- Индексация: Scout сам переиндексирует при UI-сохранениях; массовые SQL-апдейты
  мимо моделей индекс НЕ обновляют (урок SZ-013).

### География
Явного `city_id` в витринных эндпоинтах нет: из координат берутся города в
радиусе `GEO_NEARBY_RADIUS_KM` (30 км, config/geo.php:7; FindNearbyCitiesQuery.php:44–65,
кэш 1 ч) → `whereIn(city_id)` (GetStoresQuery.php:57 и др.). `/v1/merchants`
фильтрует по slug города (ListMerchantsQuery.php:28–33).

### Инфо-карточка точки (`/storefront/info`)
`branch` (адрес, availability, готовые строки расписания, min_order, дистанция),
`merchant` (name, description, logo/cover, phone, support_phone, is_teaser),
`delivery_options` (захардкоженный enum: бесплатная/по городу/по России/самовывоз —
StorefrontDeliveryOption.php:9–27), `categories`. Клиент скрывает пустые поля
(StoreInfoSheet.vue:95–140).

## Чего нет / ограничения (факты)

- Рейтинги: `rating_avg/rating_count` отдаются API, но в UI карточек не рисуются.
- Баннер главной — статичные картинки без API.
- `branch.badges` читается клиентом (StoreCard.vue:27–30), но бэкенд поле не отдаёт.
- Фото товара — только первое изображение `catalog_products.media`; своих фото у
  оффера нет; у карточки товара нет fallback-заглушки (ProductPreview.vue:61).
- Платформенный запрет товаров (SZ-016): механизм есть, список правил пуст
  (config/restrictions.php:40–46).
- `GET /home` отдаёт `cities`/`popular_restaurants`, но app их не использует
  (home-api.ts:9–13, home.store.ts:17–18).
- `GET /v1/storefront` отдаёт только офферы; app реально использует пару
  `/storefront/info` + `/storefront` («not described in openapi», store-api.ts:19–21).
- Возраст 18+/21+: гости не видят `is_restricted` офферы и взрослые категории
  (GetStorefrontCatalogQuery.php:253–276).
- Kuper-автоимпорт выключен (`INTEGRATIONS_ENABLED=false`).

## Кандидаты в «не хватает» (решает владелец)

1. ~~Серверная проверка `min_order_amount`~~ — **сделано 18.09** (№1 BACKLOG_REVIEW,
   см. [02](02-korzina-checkout.md) «Минимум заказа»); витринные ресурсы отдают
   `min_order_amount_effective[_rubles]` (StoreCard/NearbyBranch/StorefrontInfo
   считаются через MinOrderPolicy).
2. Рейтинги и бейджи точек — данные есть, UI нет (или убрать из API).
3. `delivery_options` в инфо-карточке захардкожен и не связан с реальными
   тумблерами доставки точки (`delivery_available/pickup_available`).
4. Единый контракт витрины: `/storefront` отдаёт только офферы — openapi расходится
   с фактом; либо довести комбинированный ответ, либо описать split.
5. Зона по городу: выборка «городов в радиусе 30 км» — сегментация по городам
   фактически по координатам; для франшизы (гео-изоляция) нужен явный скоуп (C-1).
6. Динамические категории на витрине по тегам merchants (вместо убранных чипов
   типов) — механику определяет владелец.

## Сверка владельцем

(пока пусто)

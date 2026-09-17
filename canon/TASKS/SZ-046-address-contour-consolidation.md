# SZ-046 — Консолидация адресного контура app: единое добавление, единый выбор, единый вывод

> Статус: **На приёмке** — хирургия + комплекс §3 целиком в staging (2026-09-13, атомы 23548aa→340e6cb); приёмка: zcode (гейты/контракт) + владелец
> Приоритет: ~~P2~~ — волна zcode пришла (2f3b8af/91d78dd: МСП + фикс сужения
> типов в formatAddressLabel, построен поверх 6a0d259), комплекс исполнен
> атомами 23548aa→340e6cb без конфликтов
> Исполнитель: **Super Z** · Репо: `lovii-app` · Гейт: `yarn test` + vue-tsc + prettier
> Источник: владелец 2026-09-13 — «надо все привести к единой функции добавления
> адреса, единой функции выбора текущего адреса, вывод адреса в каждой из функций
> и в хедере чтобы было понятно что за адрес; тут не просто хирургическая правка
> нужна а комплекс, но начинать конечно надо с хирургии, потом сделать ресерч
> состояния и аккуратно подготовить коммиты чтобы они не исчезли при большом
> параллельном апдейте».

## 1. Хирургия (выполнена, в staging)

| Коммит | Что |
|---|---|
| `5616e66` | **city_id при редактировании**: форма update не имела ни поля, ни каталога городов (SZ-020/C-1 был только в create) — UpdateCitySearchInput портирован из create-версии, `city_id` в payload/типе/гидратации; сброс city_id при точке с карты в обеих формах. Core update `city_id` уже принимал — правка только app. |
| `6a0d259` | **Единый вывод адреса**: helper `formatAddressLabel` (`package/global-helpers/address-helpers.ts`) — канон «Город, улица, дом», IAddress+IDeliveryAddress; подключён в AppHeader (пилюля теперь с городом — «понятно что за адрес»), HomeHero, AddressSelectSheet. |

## 2. Ресёрч состояния (карта контура, 2026-09-13)

### Создание адреса — 3 пути

1. **`CreateAddress.vue`** (форма «Мои адреса» + из чекаута `?return=checkout&cart_id=`):
   `create-address.store` → `POST api/v1/profile/addresses`. Label обязателен,
   city_id — после хирургии.
2. **`GeolocationSearch.vue`** (гео-модуль, онбординг/шит): для авторизованного —
   **тот же** `createAddressStore.createAddress`, но **без label** и с
   `house: "-"` fallback → мусорные адреса в списке («без названия», дом «-»).
   Для гостя — локальный `IDeliveryAddress` в system.store.
3. (Вариант пути 1 через чекаут — отдельный вход, единая форма.)

### Выбор текущего адреса — 5 точек, все → `systemStore.setDeliveryAddress`

Механизм уже единый (один стор + localStorage `deliveryInfo`). Шит общий (F-029):
AppHeader, CreateOrderDeliveryType (чекаут), SettingsSheet — три потребителя
`AddressSelectSheet`. Плюс карточка `AddressItem` («Мои адреса», тап = выбрать)
и свой `selectAddress` внутри `GeolocationSearch` (дубль выбора из сохранённых).

### Вывод адреса

- `formatAddressLabel` — AppHeader, HomeHero, AddressSelectSheet (после `6a0d259`).
- Raw `address_line` — AddressItem, строки шита, чекаут. Core собирает
  `address_line = «Город, улица, дом»` (UpdateAddressAction/CreateAddressAction),
  т.е. содержимое совпадает с helper; перевод на helper — чистая унификация.

### Сторы и API (тонкие обёртки, по одной на операцию)

`create-address.store` (18 стр., POST) · `update-address.store` (18 стр., PATCH) ·
`profile-addresses.store` (37 стр., GET/DELETE + кэш списка) · `system.store`
(текущий адрес). Три store+api-пара на три операции одного ресурса.

### Инпуты поиска (клоны)

`CitySearchInput` (create) ↔ `UpdateCitySearchInput` (update): теперь
байт-близнецы, кроме `onMounted`-гидратации (update). `StreetSearchInput` ↔
`UpdateStreetSearchInput`: тот же паттерн (diff 19 строк = гидратация + имя).
Плюс свои поиски в `GeolocationSearch` и `BusinessAddressInput` (b2b — вне
контура, отдельный контекст).

## 3. Комплекс — ВЫПОЛНЕН (2026-09-13, после волны zcode)

| Атом | Коммит | Что |
|---|---|---|
| §3.4 | `23548aa` | Единый вывод: AddressItem, строки шита, чекаут → formatAddressLabel |
| §3.2 | `88532dd` | Единые инпуты города/улицы (src/components/address) с пропом hydrate; Update-клоны удалены; тесты F-020 + справочник SZ-020/C-1 |
| §3.3 | `38eac40` | Единый выбор: гео-дровер открывает AddressSelectSheet (событие selected аддитивно), свой selectAddress удалён |
| §3.1 эт.1 | `d18f3c9` | Единый useAddressStore + address-api; чекаут ensureSavedAddress → единая функция добавления; кэш-инвалидация внутри стора |
| §3.1 эт.2 | `dfd59ce` | Единая AddressForm create/update + useAddressForm; модули-клоны удалены (net −365 строк) |
| §3.5 | `340e6cb` | Гео-путь: «Оставить этот адрес» не создаёт сохранённый адрес молча (был мусор: без label, house="-") |

План исходный (для истории):



1. **Единая форма адреса**: `useAddressForm` composable + форма-компонент с
   режимами create/update (вместо двух модулей-клонов); один
   `address.store` (create/update/delete/list+кэш) и один api-модуль вместо трёх пар.
2. **Единые инпуты**: `CitySearchInput`/`StreetSearchInput` с пропом
   `hydrate` (onMounted-гидратация), Update-клоны удалить.
3. **Единый выбор текущего**: убрать `selectAddress` из GeolocationSearch в
   пользу `AddressSelectSheet`; AddressItem оставить как карточку списка.
4. **Единый вывод**: AddressItem и чекаут перевести на `formatAddressLabel`.
5. **Данные**: гео-путь — либо не создавать сохранённый адрес без label
   (только текущий), либо нейтральный label («Точка на карте») и честный house.

## 4. Режим работы при параллельной волне zcode

- Исполнено: 6 атомов, каждый — отдельный коммит с пушем сразу после гейтов (директива владельца против потери работы при параллельном апдейте);
  перед стартом — `git pull --rebase`, после — проверка конфликтов с волной
  (ожидаемо трогают profile-модуль и сценарии экранов).
- «го» получено 2026-09-13 («проверь — от zcode пришли коммиты? если да, то продолжаем»); волна подтянута rebase-ом до старта работ.

## 5. Отчёт о реализации (2026-09-13)

- Гейты каждого атома: prettier → vue-tsc → oxlint+eslint (по изменённым) → vitest (финал 430/430) → prod-build; каждый коммит запушен сразу после гейтов, CI staging 🟢.
- Регресс приёмки SZ-002 после волн: реестры A1–A8/B1–B8/C1–C4 подтверждены в коде на app 5b2042c (в т.ч. `checkout-address-edit`, role=alert, sticky-CTA, скелетон, OrderSummary/OrderReceipt, AppBadge «Самовывоз/Доставка»), F-041 (само-паддинг страниц адресов) и F-042 (у «Оставить этот адрес» есть обработчик) соблюдены.
- Бонус-факт ресёрча: гео-путь создавал сохранённые адреса без названия с house="-" — источник мусора в «Мои адреса» (закрыто атомом §3.5).
- Приёмка: zcode (гейты/контракт) + владелец (UX единого адресного контура).

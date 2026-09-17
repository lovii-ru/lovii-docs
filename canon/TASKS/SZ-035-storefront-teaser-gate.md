# SZ-035 — Гейт витрины: страница точки с плашкой «скоро» (итерация I-5)

> Статус: **На приёмке** (2026-09-11, Super Z — отчёт §4; core
> `83d54b5` staging, app `40db7f5` staging, b2b `1ab413b` master). Приёмка:
> zcode (код, composer test в docker) + владелец (живая витрина staging).
> Приоритет: **P1** — до публичного показа витрины
> Исполнитель: Super Z · Репо: `lovii-core` + `lovii-app` · Гейт: composer + yarn
> База: I-5 реализован и live на staging за флагом `STOREFRONT_VERIFICATION_GATE`
> (исключение «импортирован интеграцией» спасает Kuper-витрину)

## 1. Решение владельца (2026-09-11)

Не «прятать полностью»: **страница торговой точки показывается БЕЗ списка
товаров, с плашкой «Скоро»** — после апрува представителем (SZ-034 фаза B).
До апрува — точка не показывается вовсе. Товары открываются после полного
апрува.

## 2. Что

1. Состояния точки на витрине: `hidden` (нет апрува) → `teaser` (страница +
   плашка «Скоро», без товаров) → `active` (полная витрина). Маппинг
   состояний на verified/представитель-апрув — по итогу SZ-034;
2. Страница-teaser: шапка точки (SZ-024 инфо-карточка!), плашка «Скоро»,
   БЕЗ позиций и корзины;
3. Флаг `STOREFRONT_VERIFICATION_GATE` — переработать логику под три
   состояния; Kuper-импорт — вне гейта (исключение сохранить);
4. Тесты: три состояния, исключение импорта, guard корзины/заказа для teaser.

## 3. Приёмка

- Владелец: неверицированная точка не видна; апрувнутая — видна с плашкой и
  без товаров; полностью верифицированная — полная витрина.
- zcode: приёмка кода.

## 4. Отчёт исполнителя (Super Z, 2026-09-11)

**Модель состояний.** Новый enum `StorefrontState` (Hidden/Teaser/Active) +
`MerchantVisibility::state(Merchant)` — единая точка правды:
`verified_at` → Active; иначе `representative_approved_at` → Teaser;
иначе Hidden. Исключения сохранены: мерчант без партнёра (платформенный) и
Kuper-импорт (`retailer` в `integration_entity_mappings`) — всегда Active.
Гейт по-прежнему за флагом `STOREFRONT_VERIFICATION_GATE`: выключен — всё
проходит (поведение не меняется).

**API-поверхность (core `83d54b5`).**
- `apply(query, alias, includeTeaser)`: списки точек (stores/catalog/list/
  popular/merchant-search) вызывают с дефолтом `true` — teaser-точки видны;
  поиск офферов — `false` (товары «Скоро»-точек нигде не всплывают).
- `allowsOrders()`: checkout (`CheckoutBuilder` → `merchant_unavailable`) и
  карточка товара (`GetOfferQuery` → 404) — только Active.
- `GetStorefrontCatalogQuery`: teaser — branch/info отдаются (шапка точки),
  офферы и категории пустые.
- `MerchantResource.is_teaser` + `is_teaser` в `/storefront/info`.
- Индексация: `CatalogProduct`/`MerchantOffer::shouldBeSearchable` — только
  Active-точки. NB ops: после смены состояния точки (апрув/верификация)
  нужен `search:sync` — Scout-индекс не пересчитывается сам.

**b2b (`1ab413b`).** Миграция `partners.representative_approved_at`
(timestampTz + partial index) — якорь состояния; модель
`isRepresentativeApproved()`; ops-команда
`b2b:partner:approve-representative {id} [--revoke]` с записью в
partner_audit_logs — инструмент приёмки до кабинета представителя
(SZ-034 фаза B), далее остаётся admin-инструментом.

**app (`40db7f5`).** `StoreModule`: `is_teaser` из `/storefront/info` →
плашка «Скоро» (AppBadge brand + текст) вместо `StoreProducts`; шапка точки
(SZ-024) остаётся. Отсутствие флага = полная витрина (обратная
совместимость со старым кэшем).

**Тесты.** core: `VerificationGateTest` +6 кейсов (маппинг трёх состояний;
teaser-страница 200 с `is_teaser=true` и пустая витрина; hidden 404 /
active полная; teaser в списке точек, hidden исключён; SQL apply с
includeTeaser=false; checkout teaser → `merchant_unavailable`); композер-тест
в docker — на стороне zcode. app: `StoreTeaser.test.ts` 3 кейса, прогон
322/322, vue-tsc/oxlint/eslint чисты.

## Приёмка zcode — core-коммит `83d54b5` РАЗВЕРНУТ на staging (2026-09-11, ночь)

Коммит не компилился: parse error в замыкании (`function (Builder $st): use
(…) {` — `use` после двоеточия, `MerchantVisibility.php:63`) + вызовы
несуществующего `MerchantVisibility::enabled()` (строки 53/113) + в
`MerchantResource::state()` передаётся `$this` вместо Merchant → CI staging
красный, деплой заблокирован, а под ним ждал фикс VAPID SZ-010. Сделан
`git revert 83d54b5` на staging (`ac1de4f`); app-часть (`40db7f5`, teaser
страница) задеплоена и не тронута. Перепушить core-часть после исправления
(док_COMPILE: php -l + pint/rector/phpstan/pest локально в docker перед
пушем); строка revert просто откатится следующим коммитом SZ-035.

## Приёмка zcode — 2026-09-11: «Достаточно» (после обязательного отката первой версии)

**Честная история**: первый core-коммит `83d54b5` не компилился (parse error
в замыкании, вызовы несуществующего enabled(), `$this` вместо Merchant) —
CI красный, деплой заблокирован; откачен zcode (`ac1de4f`), Super Z
перепустил исправленную версию — теперь tip зелёный.

Факт-чек по коду staging: `StorefrontState` (Hidden/Teaser/Active) с
правильной раскладкой: verified→Active; представительский апрув→Teaser;
иначе Hidden; исключения I-5 сохранены (без партнёра, retailer-маппинг).
`apply(..., includeTeaser)` — списки видят teaser, поиск офферов нет;
`allowsOrders` — только Active (checkout + карточка товара);
GetStorefrontCatalogQuery: teaser = шапка без витрины. b2b: миграция
`representative_approved_at` + ops-команда апрува с аудитом. app:
плашка «Скоро» по is_teaser, обратная совместимость. Тесты: Storefront
56 passed в docker (мои), +6 кейсов гейта; CI core/app/b2b 🟢.

**NB ops (принято в канон)**: смена состояния точки → нужен `search:sync`
(Scout сам не пересчитает чужую смену verified_at/approved_at).

**Вердикт: «Достаточно»**; живой teaser-сценарий (апрув представителем →
плашка «Скоро» → верификация → полная витрина) — приёмка владельца.

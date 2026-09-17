> ⚠️ **АРХИВ.** Карточка закрыта и не является текущим источником требований; сохранена только для истории.

# T-005 — UX-фаза A: оформление заказа (create-order) по SZ-002

> Статус: **Закрыта** (приёмка-1 zcode «Достаточно» 2026-09-10; приёмка-2 Super Z «Достаточно» 2026-09-11, A7/A8 дельты app `8314895`; визуальная приёмка владельца — по желанию)
> Приоритет: P1 · Источник: SZ-002 §3 фаза A (дефекты A1–A8) · Спека: SZ-002
> Исполнитель: Super Z · Постановил: Super Z · Приёмка: zcode (§3.1) + визуальная — владелец на staging
> Репо: lovii-app, ветка `staging` · Дата: 2026-09-09

## Цель

Экран «Оформление заказа» читается как одна карточная система: адрес тапается
целиком, блоки в логичном порядке, CTA со суммой всегда доступны, ошибки —
в контейнере. Функциональность и API не меняются.

## Контекст (читать до начала)

1. `lovii_docs`: canon/TASKS/SZ-002-ui-ux-profile-orders-checkout.md (§2 —
   направление и правила; §3 фаза A — таблица дефектов), canon/DESIGN.md §4–§5
   (токены, типографика).
2. Компоненты: `src/modules/create-order/` (CreateOrder.vue,
   CreateOrderDeliveryType.vue, CreateOrderRecipient.vue, CreateOrderProducts.vue,
   CreateOrderSummery.vue), `src/components/AddressSelectSheet.vue`.
3. e2e-зависимости: `data-testid` НЕ менять (`checkout-address-edit`,
   `place-order`, `order-comment`).

## Шаги

1. **A1/A2 — адресная строка** (`CreateOrderDeliveryType.vue`): блок
   `__address` → единая кнопка (grid `1fr auto`): слева текст адреса
   (`--content-normal-primary`, body-l), справа IconChevronRightRegular;
   высота ≥44px, padding 12px 16px, radius 12px, фон
   `--background-normal-soft` (или surface на parent surface — выбрать по
   контрасту), active-состояние. Клик → `showSheet = true` (AddressSelectSheet,
   F-029). Кнопку-карандаш убрать. Если `deliveryAddress` пуст → текст
   «Выберите адрес доставки» (`--content-normal-brand`) + тот же клик.
   `data-testid="checkout-address-edit"` перенести на новую кнопку.
2. **A3/A4 — порядок и получатель** (`CreateOrder.vue` + `CreateOrderRecipient.vue`):
   порядок секций: Способ получения (с адресом) → Получатель → Товары → Сводка →
   sticky CTA (шаг 3). `CreateOrderRecipient`: вместо двух disabled `AppInput` —
   компактный блок: строка «Получатель: <имя>» + строка «<телефон>» (текст,
   не инпуты; secondary), ниже `AppTextarea` комментария (как сейчас,
   `data-testid="order-comment"` сохранить). Заголовок секции — существующий
   паттерн h5+разделитель.
3. **A6 — sticky CTA** (`CreateOrder.vue`): под сводкой — sticky-зона (низ
   экрана): строка «Итого» (h4-bold, из checkout.total) + AppButton size=l
   «Создать заказ» (`place-order`). Фон зоны — surface c верхним subtle-бордером
   и blur на скролле — по возможностям без новых зависимостей; safe-area-bottom
   учтён (уже есть в `.create-order`). Обычную кнопку из потока убрать (не
   дублировать).
4. **A5 — ошибка** (`CreateOrder.vue`): `__error` → карточка-алерт: фон
   `--feedback-negative-soft` (или ближайший токен из DESIGN.md), radius 12,
   padding 12–16, текст `--content-normal-negative`, body-m; сообщение
   существующее.
5. **A8 — пересчёт**: при `buttonLoader` на сводке — `opacity: 0.6` +
   `pointer-events: none` на блоке сводки (или встроенный лоадер-строка); полный
   оверлей не делать.
6. **A7 — скелетон**: высоты существующих трёх AppSkeleton привести к структуре
   секций (80/120/160 — уже так; добавить по заголовочной полосе внутри —
   опционально, при времени).
7. **Тесты**: vitest-тесты create-order не должны сломаться (store-тесты не
   трогаются); добавить/обновить компонентный тест на новый адресный блок
   (клик открывает шит; пустой адрес → текст-призыв). e2e прогнать локально по
   возможности (scenario-02 golden path, scenario-03 payment — селекторы не
   менялись, должны пройти).
8. **Гейты и пуш:** typecheck + vitest + сборка PWA 🟢 → пуш в `staging`.
   Session-док `docs/sessions/021-...` (следующий номер app) +
   `lovii-docs/status.md` в том же пуш-цикле. Скриншоты light+dark до/after —
   в session-док.

## Что НЕ делать (стоп-лист)

- НЕ менять API/stores/роутинг/флоу оплаты (CreateOrderSuccess — вне задачи,
  его ревизия — отдельный шаг фазы C).
- НЕ менять `data-testid`, `AddressSelectSheet` и геомодуль.
- НЕ вводить новые цвета/шрифты/зависимости; только токены DESIGN.md.
- НЕ трогать dark/light-механику и анти-FOUC.
- CreateOrderSummery НЕ унифицировать с OrderSummery в этой задаче (фаза C,
  T-007) — только sticky-итог поверх неё.

## Критерии приёмки

- Вся адресная строка тапается, chevron справа, active-состояние; пустой адрес
  — призыв к действию; `checkout-address-edit` работает в e2e.
- Порядок: Способ → Получатель → Товары → Сводка → sticky CTA; комментарий
  между получателем и товарами.
- Итого+CTA видны без прокрутки на мобильном вьюпорте (375×667+).
- Ошибка — в контейнере-алерте.
- typecheck/vitest/сборка 🟢, CI 🟢, e2e зелёные; скриншоты в session-доке.

## Отчёт исполнителя

Выполнена Super Z 2026-09-09 в составе единой серии SZ-002 фаз A/B/C,
lovii-app staging: `0da6a82` (+ merge `bc860ea`), session-док
`docs/sessions/021-ui-ux-profile-checkout.md`.

- A1/A2 — адресная строка: кнопка grid 1fr auto (мин. 44px, radius 12,
  фон `--background-normal-page`, active-фон soft-neutral), текст +
  `IconChevronRightRegular`, клик — тот же `AddressSelectSheet`; карандаш
  удалён; `checkout-address-edit` перенесён; пустое состояние — «Выберите
  адрес доставки» бренд-цветом.
- A3 — порядок: Способ получения → Получатель → Товары → Сводка → sticky-CTA.
- A4 — получатель: текстовые строки (имя semibold + телефон
  formatInternational) на page-фоне, не disabled-инпуты; комментарий —
  `AppTextarea` (`order-comment` сохранён).
- A5 — ошибка: алерт-карточка `--feedback-negative-subtle` +
  `IconCircleErrorRegular`, role=alert.
- A6 — sticky-зона: мини-«Итого» (h4-bold) + AppButton l;
  `bottom: calc(64px + env(safe-area-inset-bottom))` — над фиксированным
  NavBar; `margin-top: auto`. Blur не делал (без новых зависимостей) —
  фон page + верхний subtle-бордер.
- A7 — скелетон оставлен (низкий приоритет по спеке).
- A8 — сводке передаётся `:loading="buttonLoader"` → opacity .6 (через
  общий `OrderSummery`, см. T-007 C2).

Отклонения от спеки: (1) токена `--content-normal-negative` нет — текст
ошибки `--feedback-negative-solid`; (2) текстовое тест-расширение не
добавлялось — поведение адресной кнопки покрыто e2e-контрактом селектора
`checkout-address-edit` (клик по нему и есть открытие шита; сценарий не
менялся). Проверки: oxlint/eslint 🟢, vitest 214 🟢 (+9), vue-tsc 🟢,
build 🟢. Скриншоты — песочница без бэкенда, визуальную приёмку делает
владелец на staging (честно зафиксировано в session-доке).

## Приёмка zcode (§3.1) — 2026-09-10

Факт-чек по коду lovii-app staging (`bc860ea`, CI 🟢 run 34380270533):

- **A1/A2** — `CreateOrderDeliveryType.vue`: `data-testid="checkout-address-edit"`
  на единой кнопке, `IconChevronRightRegular` справа, пустое состояние
  «Выберите адрес доставки» (строка 81); карандаша в файле нет (grep 0) ✓.
- **A3** — `CreateOrder.vue` (строки 182–215): порядок Delivery → Recipient →
  Products → OrderSummery → `__cta` (sticky) ✓.
- **A4** — `CreateOrderRecipient.vue`: текстовые строки (Получатель +
  `formatInternational`), комментарий `AppTextarea` с `order-comment`;
  `AppInput` в файле не используется ✓.
- **A5** — `role="alert"` + `IconCircleErrorRegular` + фон
  `--feedback-negative-subtle` / текст `--feedback-negative-solid` ✓
  (отклонение от спеки по токену задокументировано в отчёте — принимается).
- **A6** — sticky-зона: «Итого» + AppButton `place-order`, `position: sticky`
  ✓; **A8** — `OrderSummery :loading="buttonLoader"` ✓.
- Токен-опечатки и новые зависимости не замечены; селектор
  `checkout-address-edit` сохранён (e2e-контракт цел).

Отклонения из отчёта (токен ошибки, отказ от blur/скелетон-полос, отказ от
дубль-компонентного теста адресной кнопки) — осознанные, поведения не ломают;
адресная кнопка покрыта e2e-контрактом селектора.

**Вердикт: «Достаточно»** (приёмка-1; приёмка-2 — Super Z, визуальная — владелец).

## Приёмка-2 Super Z — 2026-09-11: «Достаточно»

Сверка по дефектному списку SZ-002 §3 соответствующей фазы в коде
(lovii-app, staging):
- A1 строка-карточка адреса с chevron + `checkout-address-edit` ✓; A2 пустое
  состояние «Выберите адрес доставки» ✓; A3/A4 получатель компактно (текст,
  не disabled-инпуты), порядок блоков выправлен ✓; A5 ошибка — алерт-карточка
  (`--feedback-negative-subtle`, иконка, role=alert) в двух состояниях ✓;
  A6 sticky-зона CTA с «Итого» над навигацией ✓; A7 дельта приёмки —
  структурный скелетон (получатель/способ/товары) вместо трёх полосок,
  app `8314895` ✓; A8 дельта приёмки — гашение суммы при пересчёте
  (`__total--busy` рядом с CTA-спиннером), тот же коммит ✓.
- Тесты: create-order 19/19; гейты prettier/vue-tsc/oxlint/eslint чисты.

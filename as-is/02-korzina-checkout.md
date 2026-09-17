# 02. Корзина и чекаут — как есть

> Срез: 2026-09-17. Рабочая заметка (класс W), не канон. Формат — [README](README.md).

## Что это

Корзина живёт **на сервере** (по одной корзине на точку), чекаут создаёт заказ
без оплаты — оплата отдельный шаг. Адреса хранятся в профиле, есть гостевая
корзина со слиянием при входе.

## Путь покупателя

1. В карточке товара «+» → `POST /cart/items` (гость — по токену `X-Guest-Token`).
2. `/cart` — корзина: товары сгруппированы табами по точкам (CartModule.vue:44–68);
   доставка «по тарифам заведения», итог = subtotal (CartInfo.vue:86–93).
3. «Оформить заказ» → вход обязателен (CartInfo.vue:40–47) → `/cart/:id`
   (CreateOrder.vue): способ получения (Доставка/Самовывоз, недоступные
   выключены), адрес (общий шит `AddressSelectSheet`), получатель (readonly
   из профиля), комментарий (≤500).
4. `POST /orders/preview` → пересчёт → `POST /orders/checkout` → экран успеха
   с кнопкой «Оплатить» (или «Оплатить позже»).

## Корзина — как работает

- Модели `Cart` (user_id, merchant_id, guest_token, city_id, expires_at) и
  `CartItem` (quantity, selected_options, **снапшоты цены**) —
  app/Models/Core/Cart.php:29, CartItem.php.
- Отдельная корзина на каждого мерчанта: `firstOrCreate` по `[user_id, merchant_id]`
  (SetCartItemAction.php:140–146). Все корзины: `GET /carts` (routes/api.php:177).
- Гостевая корзина: токен `gs_*`, `GuestSession` TTL 30 дней
  (SetCartItemAction.php:129–172). Вход → слияние гостевых корзин в персональные
  (`MergeGuestCartAction`, вызов при активации — ActivateUserAfterConfirmAction.php:53).
- `POST /cart/items`: `quantity` — **абсолютное** значение (set, не инкремент),
  `≤0` удаляет позицию/пустую корзину (SetCartItemAction.php:28–112); цена
  фиксируется снапшотом в момент добавления (:66–87).
- Гварды: `offer_restricted` — платформенный запрет позиции (SZ-016)
  (SetCartItemAction.php:52–57).
- В payload корзины приходят флаги точки `delivery_available/pickup_available`
  (CartResource.php:32–43, SZ-036).

## Чекаут — как работает

- Роуты (auth:sanctum): `POST /orders/preview`, `POST /orders/checkout`
  (routes/api.php:211–212).
- Валидация `CheckoutRequest.php:19–48`: `cart_id`, `delivery_type`
  (delivery|pickup), `address_id` — required при доставке + проверка владения,
  `comment` ≤500, `bonus_to_spend` nullable ≥0.
- Идемпотентность: заголовок `Idempotency-Key`, кэш 10 мин
  (PlaceOrderController.php:25–43). **Клиент заголовок не отправляет** (grep по app — пусто).
- Проверки `CheckoutBuilder`:
  - `cart_empty` (:36), `offer_restricted` (:42–51);
  - `merchant_unavailable` — витрина не Active (:70–75);
  - `merchant_closed` — нет активной точки (:77–79);
  - `delivery_not_supported` (422) — доставка при `!delivery_available` или
    самовывоз при `!pickup_available` (:81–87); клиент честно показывает ошибку
    и авто-переключает способ (CreateOrder.vue:141–143; тексты — order-errors.ts:31–64).
- Итог: `total = subtotal + delivery_fee`; fee = 0 при самовывозе или когда
  subtotal ≥ free_from зоны, иначе `delivery_fee` первой активной зоны точки
  (CheckoutBuilder.php:89–125).
- Создание заказа (`PlaceOrdersAction.php:31–177`): статус `created`,
  `submission_status=pending`, `source_type=customer_app`; позиции из снапшотов
  корзины; снапшоты адреса и цен в заказ; корзина очищается; событие `OrderPlaced`;
  фоновой `SubmitOrderJob` (created→submitted).

## Адреса

- Хранение: `UserAddress` (label, address_line, улица/дом/подъезд/этаж/квартира/
  домофон, комментарий, PostGIS location, is_default) — UserAddress.php:14–64.
- CRUD: `GET/POST /profile/addresses`, `PATCH/DELETE /profile/addresses/{id}`
  (routes/api.php:206–209).
- Выбор: общий шит `AddressSelectSheet` — авторизованным карточки сохранённых
  адресов + «Добавить», гостю — только карта (AddressSelectSheet.vue:97–148).
- Авто-определение при старте: геолокация → `POST /geo/reverse`; при отказе
  заглушка «Моё местоположение» (App.vue:77–105). Текущий адрес — в
  localStorage `deliveryInfo` (system.store.ts:20–28).
- Адрес без id при чекауте авто-сохраняется в профиль (`ensureSavedAddress`,
  CreateOrder.vue:77–121).
- Геокодер — Yandex, серверный прокси `POST /geo/{resolve,reverse,suggest}`
  (routes/api.php:157–159; YandexGeocoder.php:15–40). Локально ключ ограничен
  Referer — подсказки не работают (известное ограничение, e2e — staging-only).

## Оплата

- **При чекауте оплаты нет** — заказ создаётся сразу (`PlaceOrdersAction` платёжный
  объект не создаёт).
- Оплата — отдельный шаг: `POST /orders/{order}/payment` (routes/api.php:230) →
  T-Bank EACQ Init, двухстадийная схема; повторный тап возвращает живую сессию
  (CreateOrderPaymentAction.php:29–106).
- Разрешено в **любом нетерминальном** статусе; блокируют только
  `Completed/Cancelled/Failed` (`order_not_payable`) — CreateOrderPaymentAction.php:36–49
  (окно оплаты не должно зависеть от быстрого created→submitted).
- Флаг `payment_enabled` в ресурсе заказа управляет кнопкой (OrderDetailResource.php:42).
- Заглушка dev/staging: `PAYMENTS_FAKE` + страница фейкового терминала в app +
  `POST /payments/fake/notify` (404 на прод) — config/payments.php:37,57–58,
  FakePaymentNotifyController.php:29.
- Вебхук Т-Банка `POST /payments/tbank/webhook` (без auth): тело не доверяется —
  статус перепроверяется server-to-server (GetState); при `confirmed` заказ
  created→submitted, начисляется кэшбэк, распределяется пул (см. [03](03-zakazy.md)).

## Баллы и промокоды при чекауте

- **Баллы: бэкенд умеет, фронт не шлёт.** `bonus_to_spend` валидируется и
  списывается: лимит `%` от `LoyaltyRule.max_spend_percent`, ошибки
  `bonus_limit_exceeded`; `total = max(0, total − bonus)` (LoyaltyService.php:177–215,
  PlaceOrdersAction.php:48,90). UI списания в чекауте нет; клиент поле не передаёт
  (CreateOrder.vue:130–134). Отображение списанных баллов в квитанции есть (OrderReceipt.vue:32).
- **Промокоды на заказ: не существует** — в чекаут-слое полей нет,
  `discount_amount` жёстко 0 (PlaceOrdersAction.php:95,114). (Представительские
  промокоды PPXXXX/AA2222 — другой контур: привязка точки к репу, не скидка.)

## Чего нет / ограничения (факты)

- `min_order_amount` **не энфорсится сервером** нигде (корзина/чекаут/preview) —
  только показ на витрине (проверено rg по app/{Application,Domain,Http/Requests} — 0 совпадений).
- Адрес **не проверяется на попадание в зону доставки**: зоны
  (`MerchantDeliveryZone`: polygon/radius/fee/free_from) существуют, но берётся
  первая активная зона только для расчёта fee (CheckoutBuilder.php:111–125).
- Слоты/интервалы времени доставки — не найдено.
- Чаевые, трекинг курьера — не найдено.
- Пуш о заказе клиенту работает (см. [03](03-zakazy.md)); оплата опциональна —
  заказ можно не оплачивать и он всё равно пойдёт точке (нет гейта «не оплачен →
  точка не готовит»).

## Кандидаты в «не хватает» (решает владелец)

1. Энфорс min_order на чекауте (сейчас поле фактически декоративное; в БД точек
   встречается 0 — владельцу пересохранить суммы).
2. Гео-проверка зоны доставки (сейчас «точка не доставляет» ловит только глобальный
   тумблер, не географию).
3. Списание баллов в UI чекаута (бэкенд готов).
4. `Idempotency-Key` с клиента (защита от дублей заказа на плохой сети).
5. Гейт оплаты: должен ли незаказанный-неоплаченный заказ уходить точке (сейчас — да).
6. Слоты доставки/времени — вне MVP, но зафиксировать решение.

## Сверка владельцем

(пока пусто)

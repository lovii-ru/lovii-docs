# 03. Заказы: жизненный цикл — как есть

> Срез: 2026-09-17. Рабочая заметка (класс W), не канон. Формат — [README](README.md).

## Что это

Заказ рождается в app покупателя, статус ведут точка (b2b-канбан или кабинет МСП
в app) и система (автоподача, платежи). Все смены статусов — через одну статусную
машину core с историей; b2b пишет в общую БД и переизлучает событие в core через
internal-мост (SZ-037).

## Лестница статусов

Enum `OrderStatus` (app/Domain/Order/Enums/OrderStatus.php:12–21):
`created → submitted → accepted → preparing → ready → handed_to_delivery →
on_the_way → completed`; боковые: `cancelled`, `failed` (терминальные).

Разрешённые переходы (OrderStatus.php:26–39):

| Из | Куда |
|---|---|
| created | submitted, cancelled, failed |
| submitted | accepted, cancelled, failed |
| accepted | preparing, cancelled |
| preparing | ready, cancelled |
| ready | handed_to_delivery, completed, cancelled |
| handed_to_delivery | on_the_way, completed |
| on_the_way | completed |

Две цепочки финала (DeliveryType, MspOrderActions.php:17–29): самовывоз —
`…→ ready → completed` («Выдан клиенту»); доставка —
`…→ ready → handed_to_delivery → on_the_way → completed` («Доставлен»).

Единственная точка смены в core — `OrderStatusMachine::transition()`
(OrderStatusMachine.php:28–73): атомарно — update заказа, запись в
`order_status_histories`, **возврат списанных баллов при cancelled/failed** (:66–68);
после коммита — событие `OrderStatusChanged`. Причина отмены обязательна.

## Кто переводит статус

| Кто | Как | Source |
|---|---|---|
| Система | `SubmitOrderJob`: created→submitted через секунды после чекаута (SubmitOrderJob.php:34–70) | system |
| Платёж | вебхук Т-Банка confirmed: created→submitted (HandleTBankNotificationAction.php:157–162) | payment |
| Точка в app (МСП) | `PATCH /msp/orders/{order}/status` (routes/api.php:275); точке недоступен failed | msp_app |
| Точка в b2b | канбан drag-drop + экшены деталки (см. ниже) | partner_cabinet |
| Клиент | только отмена: `POST /orders/{order}/cancel`, **только** в created/submitted, причина 3–500 симв., иначе 422 `cancel_not_allowed` (CancelOrderController.php:29–50) | client_app |

## Кабинет b2b (точка) и мост b2b→core

- Канбан `OrderBoard` (Filament-страница): 8 нестультильных колонок, drag-drop →
  `moveOrder()` с проверкой tenant-скоупа, policy и `canTransitionTo()`
  (OrderBoard.php:26–136); автоперерисовка `wire:poll.15s`. Создать/отредактировать
  заказ в b2b нельзя — заказы только из клиентского приложения (OrderPolicy.php:31–44).
- Скоупинг видимости: мерчант партнёра + whitelist филиалов оператора
  (`partner_users.branch_ids`) — OrderResource:73–87.
- `applyTransition()` пишет статус и историю **напрямую в общую БД core**
  (соединение `pgsql_core`) + audit-запись (OrderResource.php:360–402).
- **Мост (SZ-037)**: после коммита — queued-job `NotifyCoreOfOrderStatusTransition`
  (tries=10, backoff до 30 мин) → `POST {CORE_API_URL}/api/internal/v1/orders/{id}/status-events`
  с `X-Internal-Secret` (CoreApiClient.php:33–52). Core переизлучает
  `OrderStatusChanged`; идемпотентность — по `history_id` (Cache::add, 30 дней);
  409 при расхождении статуса (EmitOrderStatusEventController.php:30–64).
  Недоступность core не ломает переход в b2b.

## Уведомления (все из core, событие `OrderStatusChanged`)

- Карта поводов (OrderStatusNotificationGroups.php:35–57): preparing → «готовится»,
  handed_to_delivery/on_the_way → «передан курьеру», completed → «доставлен»,
  cancelled/failed → «отменён»; **created/submitted/accepted/ready — тишина**.
- Клиенту: WebPush (VAPID; без ключей канал молчит — PushNotificationDispatcher.php:19–29)
  + email (только verified, dedupe по `order_status:{id}:{group}`).
- Точке: пуш о новом заказе и отмене, боты MAX и Telegram (Listeners/NotifyMerchant*),
  **напоминания о непринятых заказах**: `orders:remind-new` каждую минуту, пуш
  «Заказ #N ещё не принят» через 2 мин после создания и до 60 мин
  (routes/console.php:11–13, config/push.php:47–50).
- Партнёру: роутер по каналам `partner_notification_channels` — email / webhook
  (HMAC) / sms (PartnerNotificationRouter.php:14–32; sms — заглушка).

## Экраны покупателя (app)

- История: `/profile/orders` → OrdersModule, карточка с бейджами из `order.badges`
  (OrderPreview.vue:64–68); API `GET /orders` (offset-пагинация).
- Деталка: `orders/:id` → ProfileOrder.vue — состав, суммы (subtotal/delivery/total),
  причина отмены, **квитанция** (SZ-017: «не является фискальным документом… чек
  будет доступен после оплаты» — OrderReceipt.vue:77–80), отмена, оплата
  (повторная при не-authorize/не-confirm).
- Кабинет МСП в app: `/cabinet/msp/orders` + деталка — пикер переходов строится из
  `allowed_transitions` ответа core, отмена с причиной (MspOrderDetail.vue:85–211).

## Отмена, возврат, начисления

- Возврат **списанных баллов** — в транзакции статус-машины при cancelled/failed
  (идемпотентно, тип adjustment) + страховка-листенер для b2b-пути
  (ReturnSpentPointsOnOrderCancellation.php:11–31).
- Возврат **денег** — отдельный контур (канон: FINANCIAL_CONTOUR §5): вебхук
  Refunded/Reversed/Chargeback → возврат кэшбэка + зеркальный разворот пула
  (HandleTBankNotificationAction.php:173–197); чарджбэк подтверждает оператор из
  lovii-admin (`POST /api/internal/v1/orders/{id}/chargeback`, routes/internal.php:22–24).
- Начисления — оба по **confirmed** вебхука Т-Банка (тело не доверяется, статус
  перепроверяется GetState):
  - кэшбэк клиенту: `earnFromOrder`, процент — из `loyalty_rules.earn_percent`
    (канон: PARAMS.md), идемпотентность unique(wallet, order, type) —
    LoyaltyService.php:29–81;
  - пул платформы: точке 90%, платформе 10% минус комиссия банка; остаток
    делится Компания 40 / Представитель 40 / Амбассадор 20 (config/payments.php:65–99);
    реп — по заявке с апрувом, амб — по префиксу промокода; без промокода —
    фолбэк владельца (правило «МСП без промокода не бывает»);
    гейт подписки представителя сейчас **выключен**
    (`PAYMENTS_SPLIT_REP_SUBSCRIPTION_GATE=false`, DistributeOrderPoolAction.php:248–252).

## Чего нет / ограничения (факты)

- Курьерский интерфейс (фаза D) не реализован: курьерские шаги ставит сама точка;
  `courier_app` не встречается; трекинга курьера нет (MspOrderActions.php:25–29).
- Чаевые — не найдено (grep core/app/b2b — 0).
- Фискальный чек — не найден (ККТ из агентской схемы не подключена); квитанция
  явно «не фискальный документ».
- Внешние интеграции заказов: enum `order_channel` и `OrderExternalState`/
  `OrderSubmission` есть, но `SubmitOrderJob` пишет provider/external_id = null —
  реальной отправки во внешние системы (POS/CRM) нет (SubmitOrderJob.php:42–53).
- `orders.method` (канал эквайринга) в БД нет — пул считается как «карта» по
  умолчанию (DistributeOrderPoolAction.php:220–229).
- accepted/ready — без уведомлений клиенту (по карте выше): клиент не узнает
  «заказ принят» и «можно забирать» из пуша.

## Кандидаты в «не хватает» (решает владелец)

1. Пуши на accepted («заказ принят») и ready («можно забирать / курьер забрал») —
   сейчас самые ожидаемые клиентом статусы молчат. → карточка
   `canon/TASKS/T-009-client-order-status-pushes.md` (Открыта, 2026-09-18).
2. Таймаут: точку о непринятом заказе система напоминает 2–60 мин, но дальше —
   ничего: заказ висит submitted бессрочно, клиент ждёт без эскалации.
3. Автопереход готового заказа: ready → completed по истечении N дней (сейчас
   completed ставит только точка).
4. Чек/фискализация — зафиксировать как вне MVP или поставить в очередь.
5. Отмена клиентом после accepted — сейчас нельзя (только created/submitted);
   решить, ок ли это для поддержки.

## Сверка владельцем

(пока пусто)

# SZ-037 — Мост b2b → core: переходы заказа из кабинета не порождают доменных событий

> Статус: **На приёмке** (zcode, 2026-09-11, по живому тесту пушей владельцем)
> Приоритет: **P1** — продавец меняет статус в b2b, а клиент не получает НИЧЕГО
> (ни пуш SZ-010, ни email SZ-009, ни MAX/TG-бот) — все слушатели в core
> Исполнитель: Super Z · Репо: `lovii-b2b` + `lovii-core` · Гейт: composer test

## 1. Факт (staging, 2026-09-11)

Владелец протащил заказы #131/#132 по всему канбану b2b-staging — клиентский
пуш о статусе не пришёл ни разу (при этом в Redis нет ни одного job'а
`NotifyClientOnOrderStatusChangedViaPush`, и email тоже не ушёл).

Причина: `OrderBoard::moveOrder` → `OrderResource::applyTransition` (b2b,
строки 359–389) пишет статус **прямо в общую БД** (`DB::connection('pgsql_core')`,
`$order->update([...])` + строка в `order_status_history`). Laravel-приложение
core при этом не работает — его события `OrderStatusChanged`/`OrderPlaced`
не диспатчатся, все core-листенеры (push SZ-010, email SZ-009, MAX/TG-боты)
молчат. Т.е. «уведомления о статусах» реально работали только для изменений
со стороны клиента (отмена из app) — через канбан не работали никогда.

## 2. Ожидаемое решение

Один мост на выбор (решение за исполнителем, аргументы за/против — в отчёт):
- **б) b2b → HTTP core**: `applyTransition` после транзакции дергает внутренний
  эндпоинт core (service-token, идемпотентность по `order_status_history.id`),
  core переизлучает `OrderStatusChanged` (source = `partner_cabinet:*`) —
  листенеры core живут как есть;
- а) shared-пакет/дубль-листенеры в b2b — НЕ prefer (второй экземпляр
  бизнес-логики рассинхронизируется).

Требования: не дублировать тексты уведомлений (одна карта
`OrderStatusNotificationGroups` в core), ретраи/очередь на стороне b2b
(недоступность core не валит переход статуса), аудит источника события.

## 3. Приёмка

- Переход в канбане b2b → клиент получает пуш + письмо + сообщение бота (как
  и при смене статуса из core-пути).
- Гейт обоих репо зелёный; тест: b2b-переход → core получил событие
  (интеграционный тест с фейковым HTTP или общий контракт).
- Нагрузка «протащил 20 заказов» — не роняет очередь/лимиты.

## 4. NB

- Текущий обход для владельца: пуш клиенту о статусе проверять **отменой
  заказа из app** (client-cancel идёт через core API → события работают).
- Оплата: `CreateOrderPaymentAction` принимает только `status === Created` —
  из канбана протащенный дальше заказ вернёт 422; текст в app обманчиво
  generic («попробуйте ещё раз») — можно добавить в SZ-036 честные тексты
  по кодам.


## 5. Отчёт исполнителя (Super Z, 2026-09-11)

- **Выбран вариант (б) b2b → HTTP core** — аргументы: слушатели core и так
  живут + тексты уведомлений остаются одной картой в core (требование §2);
  дублирование листенеров (вариант а) = второй экземпляр бизнес-логики,
  рассинхронизация; shared-пакет между репо не предусмотрен инфраструктурой.
- **Core `e68a760`**: `POST /api/internal/v1/orders/{id}/status-events`
  (middleware internal.admin, X-Internal-Secret) — EmitOrderStatusEventRequest
  (from/to по enum OrderStatus, source ≤30, history_id) + контроллер: guard
  status-mismatch (409, событие о протухшем состоянии), идемпотентность атомарным
  Cache::add по `sz037:status-event:{history_id}` (30 дней) → переизлучение
  OrderStatusChanged (from/to/source сохранены, source = `partner_cabinet:*`).
  +5 Pest.
- **B2b `8c33f4a`**: applyTransition после коммита транзакции ставит queued-джобу
  NotifyCoreOfOrderStatusTransition (tries=10, ступенчатый backoff до 30 мин,
  failed-лог) → CoreApiClient POST с X-Internal-Secret; history_id строки,
  созданной этим же переходом, — ключ идемпотентности; недоступность core
  переход не валит (переход уже закоммичен). config: services.internal.admin_secret
  (+ .env.example: CORE_API_URL/TIMEOUT, INTERNAL_ADMIN_SECRET). +4 Pest.
- Интеграционный тест «b2b-переход → core получил событие» — контракт общий
  (URL+payload+secret), с обеих сторон покрыт фейковым Http / Event::fake;
  живая сквозная проверка — на staging (§3 приёмка).
- Нагрузка: 20 заказов подряд = 20 queued job'ов, HTTP 10с timeout, очереди
  redis — лимитов не задевает.

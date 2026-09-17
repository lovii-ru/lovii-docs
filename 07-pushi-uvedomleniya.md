# 07. Пуши и уведомления — как есть

> Срез: 2026-09-17. Рабочая заметка (класс W), не канон. Формат — [README](README.md).

## Что это

Все уведомления исходят из **core** (события `OrderPlaced` / `OrderStatusChanged`).
Каналы: WebPush клиенту и точке, email клиенту, боты MAX/Telegram точке,
партнёрские каналы (email/webhook/sms). Из b2b-канбана пуши напрямую не ходят —
только через мост в core.

## WebPush клиенту и точке

- Ключи: `PUSH_VAPID_*` в core (config/push.php:28–34); клиент берёт публичный
  ключ из `GET /v1/push/public-key` (routes/api.php:310) — `VITE_VAPID_*` не используется.
- Подписка в app — только вручную: «Настройки → Уведомления» (тумблер —
  ProfileModule.vue:266–287) → permission → `pushManager.subscribe` →
  `POST /v1/push/subscriptions` (use-push-notifications.ts:54–122). Матрица
  состояний вкл. iOS-ограничение «добавить на экран Домой» (push-helpers.ts:6–18).
- Отправка: `PushNotificationDispatcher` (без VAPID — честно молчит + warning,
  :94–108) → job на каждый endpoint (`SendWebPushJob`, tries=3, backoff 30/120);
  410/404 → подписка удаляется. Мёртвые подписки: error_count ≥ 5 или expires_at
  (PushSubscription.php:73–80).
- Тексты (PushPayload.php): клиенту «Заказ #N — {статус}» → `/profile/orders/{id}`;
  точке «Новый заказ #N» → `/cabinet/msp/orders/{id}` (requireInteraction,
  вибрация); «Заказ #N ещё не принят» — напоминание; отмена — точке.
- Клик по пушу: push-sw.js фокусит/открывает клиент и шлёт `push-navigate`
  (мост в роутер — main.ts:39).
- Напоминания о непринятых заказах: `orders:remind-new` **каждую минуту**
  (routes/console.php:11–13), окна `PUSH_REMINDER_DELAY_MINUTES=2` …
  `PUSH_REMINDER_MAX_MINUTES=60` (RemindNewOrdersCommand.php:42–47).
- Чистка мёртвых подписок: команда `push:prune-dead` есть, **в планировщик не
  добавлена** (routes/console.php:5–15).

## Email клиенту

- Письма: OrderCreatedMail («Заказ №N принят»), OrderStatusChangedMail,
  NewDeviceLoginMail, EmailVerificationMail, PartnerOrderNotificationMail —
  все ShouldQueue, кроме партнёрского.
- Диспетчер с дедупликацией: `insertOrIgnore` по dedupe_key → 0 строк = не шлём
  (EmailNotificationDispatcher.php:36–55); клиенту — только verified email.
- Лог: таблица `email_notification_logs` (plural); в миграциях есть дубль
  `email_notification_log` (singular) — **не используется** (модель без `#[Table]`
  идёт по конвенции — EmailNotificationLog.php:26–34).
- Дайджестов нет.

## Боты (уведомления точке)

- MAX: 3 бота — otp «Лови», orders «Новый заказ», support «axiiom»
  (config/maxbots.php:29–59). Вебхук `POST /bots/max/{bot}/webhook/{secret}`
  (секрет hash_equals, иначе 403); long-poll воркера для MAX в docker НЕТ.
  Входящие команды: «статус 123 готов» (:69–75).
- Telegram: 3 бота — otp @loviiru_bot, orders @lovii_pay_bot, support @axiiomru_bot
  (config/telegrambots.php:30–66). Вход — **long-poll воркеры** (вебхук недоступен
  хостингу): docker-сервисы telegram-poller-otp/-support/-orders; исход через
  прокси (`TELEGRAM_HTTP_PROXY`, staging squid 172.17.0.1:3128 —
  TelegramBotApiClient.php:211–227).
- Точке шлются: новый заказ (MAX+TG), каждая смена статуса (MAX+TG), отмена
  (пуш + боты). Всё best-effort (ошибка не валит переход).

## Партнёрские каналы (email / webhook / sms)

- Таблица `partner_notification_channels` (secret зашифрован AES-256-CBC общим
  ключом core/b2b — PartnerNotificationChannel.php:44); управляются в b2b
  (PartnerNotificationChannelResource: форма channel/target/events/is_active).
- Роутер core: активные каналы → job на канал (PartnerNotificationRouter.php:14–31);
  webhook — HMAC-SHA256 `timestamp.body`, заголовки `X-Lovii-*`, timeout 5с
  (Deliverer :42–59); **sms — заглушка** (warning, шлюз не подключён, :63–70).

## Поводы (карта OrderStatusNotificationGroups.php:33–58)

| Событие | Пуш/письмо клиенту | Точке |
|---|---|---|
| created (заказ размещён) | email «принят», пуша нет | пуш «Новый заказ» + боты |
| submitted / accepted / ready | **тишина** | напоминание «не принят» (2–60 мин); ready — ничего |
| preparing | «готовится» | смена статуса (боты) |
| handed_to_delivery / on_the_way | «передан курьеру» | боты |
| completed | «доставлен» | боты |
| cancelled / failed | «отменён» | пуш отмены + боты + партнёрские каналы |

## Service worker (PWA)

- vite-plugin-pwa, autoUpdate, precache ≤3 МБ, navigateFallback c denylist `/api/`,
  importScripts push-sw.js; runtime: api — NetworkFirst, kuper-CDN — CacheFirst
  (vite.config.ts:41–105).
- Известная проблема: серия пересборок dist → старый SW отдавал старый index.html,
  SPA тянул новые чанки → 404 → навигация молча отменялась («ссылки кабинетов не
  работают»). Лечение: chunk-recovery (перезагрузка при 404 чанка, guard от циклов —
  router/chunk-recovery.ts), «Очистить кэш и обновить» в настройках (SZ-027),
  тест-режим `VITE_DISABLE_SW=true` (unregister + чистка кэшей — ReloadPrompt.vue:20–29).
  На прод: плашка «Доступна новая версия» + update каждый час.

## Кандидаты в «не хватает» (решает владелец)

1. Пуши клиенту на accepted («принят») и ready («можно забирать») — самые
   ожидаемые статусы молчат (см. [03](03-zakazy.md)).
2. `push:prune-dead` не в планировщике — мёртвые подписки копятся только при
   отправке; добавить в routes/console.php.
3. Клиентский пуш «заказ создан» — есть только email; решить, нужен ли пуш.
4. SMS-шлюз (заказные уведомления + партнёрский канал) — заглушки.
5. MAX long-poll воркер отсутствует (только вебхук) — убедиться, что вебхук
   стабилен на проде.
6. Клиентские боты о статусах заказа — в конфиге заявлены, в коде нет.

## Сверка владельцем

(пока пусто)

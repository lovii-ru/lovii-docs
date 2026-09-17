# SZ-010 — Сервис push-уведомлений для PWA (общий, без внешних сервисов)

> Статус: **На приёмке** (отчёт §6, Super Z 2026-09-11; приёмка —
> zcode `composer test` + владелец после VAPID-ключей). **Спека-этап SZ-033
> влит** — канон-док `canon/PUSH_NOTIFICATIONS_SPEC.md` v1.0.0 (среды РФ с
> цитатами, UX soft-ask, канальная матрица, MVP + 🔶 ×6 — владельцу).
> Выдана: 2026-09-09, владелец: «пуши о заказах и статусах — общий
> функционал для клиента, продавца и представителя; сделать как сервис; без
> внешних сервисов»)
> Приоритет: **P1** — продавец должен узнавать о заказе мгновенно (сейчас —
> только Telegram-бот)
> Исполнитель: Super Z · Репо: `lovii-core` (сервис/API) + `lovii-app` (SW/подписка)
> Гейт: composer test + yarn test

## 1. Как это работает без внешних сервисов (архитектура)

Открытый стандарт **Web Push (VAPID)** — аккаунтов и сторонних SaaS не нужно:

1. **Ключи VAPID** (один раз): пара ключей ES256, генерируется у нас
   (`openssl ecparam`/библиотека), приватный — в `.env` сервера, публичный —
   в конфиге app.
2. **Подписка**: PWA (Service Worker уже есть — vite-pwa) запрашивает
   разрешение → `pushManager.subscribe({ userVisibleOnly: true,
   applicationServerKey: VAPID_PUBLIC })` → получает `endpoint` (URL браузерного
   push-сервиса) + ключи шифрования → app отправляет это в core.
3. **Отправка**: core POST-ит зашифрованное сообщение на `endpoint`, подписав
   JWT с приватным VAPID-ключом. PHP-библиотека: `minishlink/web-push`
   (или laravel-notification-channels/webpush).
4. **Service Worker**: обработчики `push` (показать уведомление) и
   `notificationclick` (открыть app на нужном экране — заказ/точка).

⚠️ Честный нюанс (для владельца): «бесплатно без сервисов» означает без наших
аккаунтов и SDK — сами доставку физически выполняют push-сервисы браузеров
(Google/Mozilla/Apple), это часть веб-платформы, безлимитно и анонимно, ключи —
наши. Полностью «свой» push-канал в вебе стандартом не предусмотрен.

**iOS-нюанс:** Safari разрешает web-push только для PWA, установленной на
домашний экран (iOS ≥ 16.4). Обязателен экран-подсказка «Установите приложение
на главный экран, чтобы получать уведомления» + graceful fallback.

## 2. Сервис как общий домен (не «фича заказа»)

- Таблица `push_subscriptions`: user (любой роли), endpoint (unique),
  p256dh/auth-ключи, user_agent, created_at, last_error_at, expires_at.
- Доменный **NotificationService** (диспетчер): событие домена → аудит получателей
  по ролям → каналы. Каналы: `push` (эта задача), `telegram` (боты уже есть),
  `email` (SZ-009), позже `max`. У каждого пользователя — предпочтения/подписки.
- Первые события-потребители:
  - продавцу (владельцу точки): `order.created` (новый заказ!), `order.cancelled`;
  - клиенту: `order.status_changed` (готовится / передан курьеру / доставлен / отменён);
  - представителю: зарезервировать аудит (события появятся позже);
  - верификация партнёра завершена (FINANCIAL_CONTOUR §3 шаг 7) — идеальный
    первый push.
- Источники событий — существующие доменные события переходов
  `OrderStatusMachine` (listener → диспетчер), не прямые вызовы из контроллеров.
- Payload уведомления: `{title, body, url}` — клик ведёт на соответствующий
  экран (заказ в «Моей точке» / заказ клиента).

## 3. Гигиена и краевые случаи

- `410 Gone` / `404` от push-сервиса → пометить подписку мёртвой, чистить
  (ретраи не бесконечные);
- дубли подписок одного устройства (перелогин) — upsert по endpoint;
- permission denied → тихий fallback, UI-подсказка «включите уведомления в
  настройках», не спрашивать чаще разумного;
- payload ≤ 4 КБ (лимит протокола), без чувствительных данных (сумма/адрес —
  только в открытый текст уведомления осознанно);
- тесты: lifecycle подписки, отправка по событию, шифрование (интеграционный
  тест с фиктивным push-сервисом), очистка мёртвых, права (чужую подписку не
  читать).

## 4. Приёмка

- Владелец: ставит PWA на домашний экран (iPhone и/или Android), оформляет
  заказ клиентом с другого устройства → **пуш продавцу** о новом заказе; меняет
  статус в «Моей точке» → **пуш клиенту**. Клик по пушу открывает заказ.
- zcode: приёмка кода; сценарии без разрешений/с оффлайн-устройством.

## 5. NB

- Существующий Telegram-канал заказов НЕ отключать — push дополняет.
- Не отправлять пуши через внешние очереди/облака; отправка — из core (Horizon).

## 6. Отчёт исполнителя (Super Z, 2026-09-11): реализовано, приёмка zcode/владельца

Коммиты: core `9b261ff` (staging), app `62a5009` (staging, rebase на d12173a
zcode). Гейты app: vitest **306/306** (58 файлов), vue-tsc, oxlint+eslint,
vite build — чисто (importScripts пушей подтверждён в dist/sw.js). Гейт core:
в песочнице нет PHP/composer — **composer test/phpstan на стороне zcode**
(весь код прогнан `php -l` статическим PHP 8.5.5, синтаксис чист).

**Core (домен-сервис):**
- миграция `push_subscriptions`: endpoint UNIQUE (upsert по нему — перелогин
  переезжает строку на нового владельца, error_count сбрасывается), p256dh/auth,
  user_agent, last_error(_at), error_count, expires_at; модель `PushSubscription`
  (`isAlive()`: error_count < push.max_consecutive_errors И не истёк).
- `config/push.php` + `.env.example`: `PUSH_ENABLED`, VAPID subject/public/private,
  TTL 86400/urgency normal. **Гард: без ключей диспетчер молчит** (warning в лог,
  public-key endpoint отдаёт null — app честно показывает «недоступно»).
- `PushPayload` {title, body, url, tag}: открытый текст ≤3072 байт (тело режется
  по словам, лимит протокола 4 КБ с запасом на шифрат); суммы — `Money` (₽,
  зеркало formatPrice/писем SZ-009).
- `WebPushSender` — адаптер **minishlink/web-push ^9** (добавлен в composer.json,
  нужен `composer install`); 404 → NotFound, 410 → Gone, успех → Sent, прочее →
  Failed. Контракт `WebPushSenderContract` — в тестах фейк.
- `SendWebPushJob` (Horizon-очередь, tries=3, backoff 30/120с): Gone/NotFound →
  строка удаляется навсегда; Failed → error_count++ и ретрай, после исчерпания
  попыток строка остаётся до порога; `push:prune-dead` чистит
  (error_count ≥ 5 / истёк expires_at) — ретраи не бесконечные (§3).
- `PushNotificationDispatcher::pushToUserIds()`: аудитория (user id) → живые
  подписки → job на endpoint.
- Листенеры (Event::listen, рядом с существующими — §5 соблюдён, ничего не
  отключено): клиенту `order.status_changed` — 4 повода через **общую карту
  `OrderStatusNotificationGroups`** (вынесена из email-листенера, тексты писем
  не изменились — push и email говорят одни слова); продавцу `order.created`
  («Новый заказ #N, точка — сумма ₽») и `order.cancelled` (Failed продавцу не
  шумит). Аудитория `MerchantOrderAudience`: merchant → partner → активные
  PartnerUsers с core_user_id, роли Owner/Manager/Operator (CatalogEditor —
  редактор витрины, без заказных пушей), скоуп по membership.branch_ids
  (null = все точки).
- API: `GET /v1/push/public-key` (публичный, ключ не секрет), `POST
  /v1/push/subscriptions` (auth:sanctum, throttle:push-subscribe 10/мин,
  валидация endpoint/keys, upsert → 201/200), `DELETE /v1/push/subscriptions`
  (auth, удаляет ТОЛЬКО свою строку — чужая не читается даже угадыванием
  endpoint, покрыто тестом).
- `artisan push:generate-vapid` — печатает блок .env (ключи нигде не
  сохраняются командой); смена ключей = мёртвые подписки всех устройств (§1).

**NB — фикс задела SZ-009 (найден php -l):** PHP 8.5 запрещает readonly-свойства
с дефолтами — убран `readonly` у листенеров с `tries/backoff`
(NotifyClientOnOrderStatusChangedByEmail, NotifyClientOnOrderPlacedByEmail,
NotifyClientOnNewDeviceLogin + новые push-листенеры). Без этого **composer test
SZ-009 упал бы fatal** — zcode, учесть при приёмке обоих задач.

**App (PWA):**
- `public/push-sw.js`, подключён через `workbox.importScripts` (обычный скрипт
  внутри сгенерированного SW, проверено в dist): `push` → showNotification
  (payload core-контракта, tag+renotify — новый пуш по заказу заменяет старый,
  icon/badge); `notificationclick` → фокус открытого клиента + postMessage
  {type:'push-navigate', url} → `router.push` (мост `registerPushNavigate` в
  main.ts, только внутренние пути), фолбэк `openWindow`.
- `SettingsSheet` — секция «Уведомления»: тумблер Включить/Выключить;
  iOS-подсказка «Установите ЛОВИ на главный экран…» (iOS ≥ 16.4, вне
  standalone web-push недоступен); denied → подсказка про настройки браузера
  (не переспрашиваем, §3); ошибка — честной строкой; без поддержки push секция
  скрыта целиком.
- `usePushNotifications` (композабл): requestPermission → GET public-key →
  pushManager.subscribe({userVisibleOnly, applicationServerKey}) → POST в core;
  отписка — DELETE + unsubscribe(). Матрица состояний — чистые
  `push-helpers` (юнит-покрытие): unsupported / ios-standalone-required /
  denied / prompt / unsubscribed / subscribed.
- `api/push-api.ts` — зеркала эндпоинтов core.

**Тесты:** core — Pest, 4 файла: API-lifecycle (создание/upsert при перелогине/
валидация/авторизация/своё-чужое удаление/public-key), флоу с Queue::fake (6
поводов клиента + тишина на промежуточных, мёртвая подписка не доставляется,
продавцу created/cancelled, не-cancelled продавцу тишина, чужая ветка тишина,
гард без VAPID-ключей, 2 живых подписки = 2 job'а), payload 4KB + карта
групп (unit), job с fake-сендером (sent/gone/404/failed-ретрай/исчерпание/
удалена между делом). app — 34 новых теста (матрица, base64url, мост
пуш→роутер, композабл, секция настроек).

**Что не сделано (честно):**
- `composer test`/phpstan — на стороне zcode (в песочнице нет PHP/composer);
- интеграция с реальной push-службой (VAPID-подпись + aes128gcm) — проверка на
  staging после ключей: `php artisan push:generate-vapid` → .env → приёмка
  владельца (§4); в тестах — фиктивный сендер по контракту;
- пуш «верификация партнёра завершена» (FINANCIAL_CONTOUR §3 шаг 7) — в core
  нет события-источника (верификация завершается на стороне b2b); нужен мост
  b2b→core, отложено;
- `NotificationService` как единый мультиканальный диспетчер — push-канал
  реализован как диспетчер; перевод email/Telegram-листенеров под него —
  отдельный рефактор (риск работающих каналов перед запуском каталога);
- предпочтения пользователя (§2 «у каждого — предпочтения/подписки») —
  отложено как кросс-канальная механика; сейчас: push = есть живая подписка;
- веб-превью пушей не строилось; dev-режим: dev-SW модульный — importScripts
  не работает, пуши проверять на сборке/staging.

**Приёмка:** zcode — `composer install && composer test`, phpstan/pint, ревизия
readonly-фикса. Владелец — после ключей: PWA на главный экран (iPhone и/или
Android), тестовый заказ клиентом → пуш продавцу, смена статуса в «Моей точке»
→ пуш клиенту, клик по пушу открывает заказ; затем PARAMS/инструкция.

## Приёмка zcode (§3.1) — 2026-09-11: «Достаточно» (после ремонтов zcode)

- CI core был красный: `minishlink/web-push` добавлен в composer.json БЕЗ
  обновления lock (Install dependencies падал) — lock закоммичен zcode
  (`f925e6d`); web-push v9 API: `VAPID::createVapidKeys()` вместо удалённого
  `WebPush::generateVAPIDKeys()`, Subscription(endpoint, publicKey, authToken),
  JSON_THROW_ON_ERROR; импорт `DTO\PushPayload` в диспетчере — всё zcode.
- Тесты PushNotificationFlowTest: добавлены `usesB2bSchema()` и
  `subscriptionFor()` (создавалась аудитория без подписок); FK-валидный
  «чужой филиал» вместо 424242. Pest 935 passed, CI 🟢 (`c1199ba`/`15eaa96`).
- NB к деплою: для реальной отправки на staging нужны `push.vapid.*` ключи
  ( artisan `push:generate-vapid` → env). Без ключей сервис молчит (гард
  проверен тестом).

**Вердикт: «Достаточно»** (приёмка-1 zcode; приёмка-2 — Super Z).

## Ops zcode — 2026-09-11: VAPID-ключи на staging установлены, канал активен

- До этого `GET /api/v1/push/public-key` на staging отдавал `null` (ключей в
  env не было) — сервис молчал по гарду. zcode: `artisan push:generate-vapid`
  в контейнере → `PUSH_VAPID_{PUBLIC_KEY,PRIVATE_KEY,SUBJECT}` дописаны в
  `/opt/lovii-core-staging/.env` (бэкап `.env.bak-push-20260911`), затем
  `up -d --force-recreate app horizon scheduler` + `config:cache`. Проверено:
  public-key отдаётся, таблица `push_subscriptions` есть, warning
  «Push channel not configured» в логе не появляется.
- ⚠️ Прод: ключи генерировать **отдельно** и класть в `/opt/lovii-core/.env`
  перед прод-деплоем (без них канал молчит). Ключи — секрет, в git/доки не
  класть; смена ключей = мёртвые подписки всех устройств (§1).
- Как проверить владельцу (§4): установить PWA app-staging на главный экран
  (iOS обязателен standalone) → Профиль → Настройки → «Уведомления» →
  включить → «Разрешить». Дальше: заказ в «Пышки & Пончики» (точка 1024,
  партнёр 263 АТМОСФЕРА, owner = core user 51 владельца, `branch_ids=null`)
  → пуш продавцу «Новый заказ #N»; смена статуса в b2b-staging на
  «Готовится» / «Передан курьеру» / «Выполнен» / «Отменён» → пуш клиенту
  (промежуточные Accepted/Ready — тишина по карте групп).
- Прямая тест-отправка без заказа (tinker в прод-образе нет — `php -r` с
  бутстрапом): см. `LOVII/lovii-docs/status.md` за 2026-09-11; возвращает число
  job'ов в очереди = живых подписок пользователя (0 = устройство не подписано).

# 06. Вход и OTP — как есть

> Срез: 2026-09-17, **обновлено 2026-09-19** (T-010: привязка промокода при
> подтверждении номера), **2026-10-04** (дельта 03–04.10: прод-OTP восстановлен,
> боты развязаны, RES-014 §6-A — раздел ниже) и **2026-10-07** (дельта 05–07.10:
> F-082 закрыт корнево, TG без SOCKS5 — раздел ниже). Рабочая заметка (класс W),
> не канон. Формат — [README](README.md).

## Что это

Вход только по телефону + код (4 цифры) через мессенджеры (MAX, Telegram, VK).
Паролей, 2FA и соцлогинов нет. Токен — Sanctum, бессрочный.

## Флоу входа

- Роуты (routes/api.php:101–136): `POST /auth/request-code` (список каналов),
  `POST /auth/send-code` (отправка), `POST /auth/confirm` (код → токен),
  `POST /auth/logout`; поллинг привязки бота `GET /auth/max/status` и
  `GET /auth/telegram/status` (один контроллер — MaxLinkStatusController.php:28–33);
  безкодовый вход `POST /auth/confirm-by-binding`.
- Пользователь создаётся при первом запросе кода (`firstOrCreate` по телефону,
  статус active) + выпуск внутренней карты новичку (SendOtpAction.php:45–55).
- Подтверждение (ConfirmOtpAction.php:23–35) → `ActivateUserAfterConfirmAction`
  (:26–57): phone_verified_at, реактивация, регистрация устройства + письмо
  «Вход с нового устройства», **слияние гостевой корзины**, Sanctum-токен
  `createToken('auth_token')` без abilities (дефолт `['*']`), TTL null —
  **бессрочный** (config/sanctum.php:55).
- **Привязка промокода при подтверждении (T-010, 18.09)**: confirm принимает
  `referral_code` (в app — любой суффикс `?ключ=значение` в ссылке, кроме
  резервных token/cart_id/utm_*); ядро валидирует по
  `representative_promo_codes` и пишет в `users.promo_code` (только на пустое —
  идемпотентно; не-код/неизвестный — тихий игнор).

## OTP

- Код 4 цифры (config/otp.php:84), TTL 10 минут, максимум 5 попыток,
  повторная отправка не чаще раза в 30 сек (серверный cooldown —
  SendOtpAction.php:38–43). Код хранится хэшем (OtpService.php:40); старые
  неподтверждённые сессии гасятся при новой отправке.
- Текст одинаков на всех каналах (финал SZ-012): «Код: {код} — вход в LOVII.
  Никому не сообщайте его — даже сотрудникам. / Хорошего настроения и приятных
  покупок!» — MaxSender.php:29, TelegramSender.php:26, VKontakteSender.php:25.
  «Код: » перед цифрами — триггер авто-подстановки ОС.

## Каналы доставки

| Канал | Состояние | Детали |
|---|---|---|
| MAX | рабочий | транспорт `OTP_MAX_TRANSPORT` (bot_api на staging); отправка **user_id в query** `POST /messages?user_id=…` (MaxBotApiClient.php:17–20,56–69); бот «otp»; без привязки — сессия «паркуется» с binding_token + deeplink `max.ru/{username}?start=…` (SendOtpAction.php:128–148) |
| Telegram | рабочий | бот @loviiru_bot; сообщение + кнопка «копировать код» + URL-кнопка binding-ссылки (TelegramSender.php:59–79); long-poll воркер `telegram:poll-updates`; в compose — только poller-otp, orders/support за профилем `telegram-extra` (F-082-фикс, core `c7a635ff`, обновлено 07.10) |
| VK | рабочий (при токене) | канал включается только при `VK_COMMUNITY_TOKEN` (AllChannelsStrategy.php:36–38); deeplink `vk.me/{screen_name}?ref=…` (не ?start=); callback `POST /vk/callback`, confirmation-строка из env (VKCallbackHandler.php:72–81) — **авто-ротации нет, смена = ручная правка env** |
| SMS | заглушка | LEGACY-логгер, «SMS не планируется» (SmsSender.php:13–27), в UI скрыт |
| WhatsApp/call | заглушки | `coming_soon` в конфиге (otp.php:63–69) |

Каналы отдаёт стратегия AllChannelsStrategy: базово `[MAX, Telegram]`, VK — при
настроенном токене (:31–41). Выбор канала — экран AuthCallCoders (кэш списка
5 мин — AuthCallCoders.vue:161–175).

## Дельта 05–07.10 (F-082 корнево, TG без прокси)

- **F-082 закрыт КОРНЕВО (07.10, Фаза 0 плана чеков):** TG 409 «terminated by
  other getUpdates» — причина: три compose-поллера (otp/orders/support) на
  ОДНОМ токене в .env обоих стендов. Фикс: core `c7a635ff` — единственный
  long-poller это otp; poller-orders/support убраны из деплоя за профилем
  `telegram-extra`; lovii-security `623369c` (SVC-таблица lovii-deploy, зеркала
  compose, тест). Staging задеплоен; **на проде лишние поллеры остановлены
  `docker stop` — ВРЕМЕННО, закрепить промоушеном staging→master вместе с
  `e7eda3b6`.** После 10:45 UTC 07.10 — 0 ошибок 409.
- **Telegram — напрямую по IPv4 без SOCKS5 (06.10):** провайдер прокси
  83.171.233.222 мёртв; DNS отдаёт только AAAA → пин extra_hosts + NO_PROXY в
  compose, фолбэк http_proxy убран из telegrambots.php. MAX-OTP жив
  (NO_PROXY=…platform-api2.max.ru), тест delivery OK.
- **OTP-боты по стендам (факт 07.10):** прод TG = `loviiru_bot`, staging =
  `axiiomru_bot` (после F-082-фикса один poller otp на токен); MAX прод =
  `_bot`, стейдж = `_2_bot`; VK прод — через релей vk-relay.

## Дельта 03–04.10 (прод-OTP и развязка ботов)

- **Вход на проде работает (03.10, ночь):** в прод-.env перенесён OTP-блок из
  staging (MAX/Telegram/VK, вебхуки на api.lovii.ru, `OTP_DEV_BYPASS=false`,
  HTTPS_PROXY, YANDEX_GEOCODER_*) — «кандидат 1» из списка ниже закрыт;
  request-code отдаёт 3 канала, смок пройден. 🔴 Хвост безопасности: webhook-
  секреты MAX/VK переиспользованы со staging — ротировать (ТД-12).
- **MAX-боты развязаны по стендам (04.10, решение владельца):** прод =
  `@id7842223709_bot` на ВСЕ цели, стейджинг = `@id7842223709_2_bot` на ВСЕ
  цели, `_1_bot` выведен (у MAX-бота одна подписка — общие боты «дерутся» за
  колбэки). Хвост: TG-вебхуки всех ботов ПУСТЫЕ (нужен `telegram:setup-webhook`
  на обоих стендах); VK-группа пока общая; входящие MAX-команды статусов
  заказов при схеме «один бот на всё» не приходят.
- **RES-014 §6-A «первый старт» — в staging, ждёт приёмки:** delivered-статус
  скоупится по каналу (`channel=telegram` → `telegram:otp`, MAX → `otp`) —
  связь из одного мессенджера больше не отдаёт delivered на чужом экране
  (корень «TG-статус не работает»); TG-экран — авто-раскрытие формы по
  delivered (паритет MAX); на MAX-экране контакт-шеринг — главный шаг.
  Хвост релиза после приёмки: VK-callback на api.lovii.ru (руками владельца
  в настройках сообщества), LOG_LEVEL прода error→info, прогон всех 3
  каналов на проде.

## Dev-bypass и rate limits

- `OTP_DEV_BYPASS` — **в config по умолчанию true** (otp.php:17): код `1234`
  принимается всегда, когда флаг включён (OtpService.php:113–118); роут
  `GET /dev/otp/last-code` регистрируется только при включённом флаге
  (routes/api.php:149–152). ⚠️ На прод обязателен `OTP_DEV_BYPASS=false`.
- Лимиты (AppServiceProvider.php:100–120): отправка — 6/мин на IP + 2/мин на
  телефон; подтверждение — 20/мин IP + 5/мин телефон (ключи в конфиге отсутствуют —
  всегда эти дефолты). 429 → в app «Слишком много попыток…» + «Повторить»
  (AuthCallCoders.vue:206–215).

## Сессии и токены в app

- Токен: `localStorage.loviAccessToken` (ставится при confirm — auth.store.ts:32–46).
- 401-интерсептор: стирает токен и перезагружает страницу, только если упавший
  Bearer совпадает с текущим, раз за цикл (axios.ts:40–77).
- Гостевой токен: `POST /guest/session` (TTL 30 дней) → заголовок `X-Guest-Token`
  (корзина); при входе передаётся для слияния корзины и удаляется.
- Выход: `POST /auth/logout` + удаление токена + reload (profile.store.ts:121–130).

## Гард роутера (T-021, 2026-09-26)

- Глобальный auth-гард в `router.beforeEach` (router/index.ts): маршрут без
  `meta.public` требует `localStorage.loviAccessToken`; без токена — редирект
  в `ProfileView` (гостевой экран профиля и есть экран входа; отдельного `/auth`
  в приложении нет). Раньше гард делал только `perfMark`.
- Публичные маршруты перечислены явно (`meta.public: true`): главная, popular,
  каталог/точка/товар, корзина и чекаут до действия, профиль, `/auth/by-binding`
  (magic link), 404. Default-deny: новый маршрут защищён по умолчанию.
- Валидность токена гарда не интересует (проверяет 401-интерсептор axios:
  сброс + reload, дальше гарда ведёт на вход). Guest-токен сессией не является.
- До T-021: гард был только у кабинетов (rolesGuard/teamGuard) и точечно у
  sub-роутов профиля; `/settings` был открыт гостю — после «Выйти» пользователь
  оставался на настройках (баг владельца 25.09, F-065).

## Magic link — что это на самом деле

Email-логина **нет**. «Magic link» в системе = binding-ссылка в мессенджере:
одноразовый `binding_token` → `{frontend_url}/auth/by-binding?token=…` →
`POST /auth/confirm-by-binding` (MagicLoginLink.php:20–30, ConfirmByBindingAction.php:35–49).
Email используется только для подтверждения адреса и письма о новом устройстве.

## Чего нет (факты)

- Пароли, 2FA, соцлогины — отсутствуют полностью.
- Реальный SMS-шлюз — отсутствует намеренно.
- TTL/ротация Sanctum-токена — нет (бессрочный, без abilities).
- Клиентские боты-уведомления о статусах заказа — заявлены в комментарии
  конфига, в коде отсутствуют (config/telegrambots.php:36–38).

## Кандидаты в «не хватает» (решает владельцем)

1. ~~Прод-чеклист OTP: `OTP_DEV_BYPASS=false` + боевые токены ботов + вебхук MAX —
   без этого вход на проде не заработает.~~ ✅ **закрыто 03.10**: OTP-блок перенесён
   в прод-.env, вход владельца работает; остаток — хвосты релиза из дельты выше.
2. Ротация VK confirmation-строки — ручная env-операция; документировать или
   автоматизировать.
3. Бессрочный Sanctum-токен без abilities — решить, ок ли для релиза
   (отзыв только через logout устройства).
4. E-mail как запасной канал входа — вне MVP, зафиксировать решение.

## Сверка владельцем

(пока пусто)

# 06. Вход и OTP — как есть

> Срез: 2026-09-17. Рабочая заметка (класс W), не канон. Формат — [README](README.md).

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
| Telegram | рабочий | бот @loviiru_bot; сообщение + кнопка «копировать код» + URL-кнопка binding-ссылки (TelegramSender.php:59–79); long-poll воркер `telegram:poll-updates` (docker-сервисы telegram-poller-otp/-support/-orders — docker-compose.prod.yml:141–209) |
| VK | рабочий (при токене) | канал включается только при `VK_COMMUNITY_TOKEN` (AllChannelsStrategy.php:36–38); deeplink `vk.me/{screen_name}?ref=…` (не ?start=); callback `POST /vk/callback`, confirmation-строка из env (VKCallbackHandler.php:72–81) — **авто-ротации нет, смена = ручная правка env** |
| SMS | заглушка | LEGACY-логгер, «SMS не планируется» (SmsSender.php:13–27), в UI скрыт |
| WhatsApp/call | заглушки | `coming_soon` в конфиге (otp.php:63–69) |

Каналы отдаёт стратегия AllChannelsStrategy: базово `[MAX, Telegram]`, VK — при
настроенном токене (:31–41). Выбор канала — экран AuthCallCoders (кэш списка
5 мин — AuthCallCoders.vue:161–175).

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

1. Прод-чеклист OTP: `OTP_DEV_BYPASS=false` + боевые токены ботов + вебхук MAX —
   без этого вход на проде не заработает.
2. Ротация VK confirmation-строки — ручная env-операция; документировать или
   автоматизировать.
3. Бессрочный Sanctum-токен без abilities — решить, ок ли для релиза
   (отзыв только через logout устройства).
4. E-mail как запасной канал входа — вне MVP, зафиксировать решение.

## Сверка владельцем

(пока пусто)

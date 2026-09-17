> ⚠️ **АРХИВ.** Карточка закрыта и не является текущим источником требований; сохранена только для истории.

# T-002 — Реализация OTP-канала VK (сообщения сообщества) в lovii-core

> Статус: Закрыта — принята Super Z (факт-чек) 2026-09-09 · Исполнена zcode 2026-09-09 (все шаги, кроме отменённого шага 2)
> Приоритет: P1 · Источник: SZ-001 (исследование Super Z) → спека `lovii-core/docs/specs/otp-delivery-channels.md` §7 (v1.1)
> Исполнитель: zcode · Постановил: Super Z · Приёмка: Super Z (факт-чек отчёта zcode) — §3.1
> Репо: lovii-core, ветка `staging` · Дата постановки: 2026-09-09

## Цель

Третий работающий OTP-канал: код входа доставляется сообщением сообщества
`vk.ru/loviiru`. Канал включается в список клиента только при заданном токене.

## Контекст (читать до начала)

1. `lovii_docs`: STATUS (последний срез) → FINDINGS F-030, F-031, F-037, F-038 → BACKLOG §6 трек V → спека §7.
2. Спека-фаза: **`docs/specs/otp-delivery-channels.md` §7 (v1.1, коммит `465a2e3`)** — верифицированная механика VK API, флоу, компоненты, риски. Спека — источник истины; этот файл — порядок работ.
3. Прецедент-реализация: Telegram (scope `telegram:otp`): `TelegramOtpBotHandler` (bind по `binding_token`), `TelegramSender` (guard + доставка), `SendOtpAction` (строки 65–76), `SendOtpController` (`telegram_link_required`), `TelegramOtpAuthTest`.

## Шаги

1. **`config/vk.php`** (новый, по образцу `telegrambots.php`): `community_token` (`VK_COMMUNITY_TOKEN`), `group_id` (`VK_GROUP_ID`), `callback_confirmation` (`VK_CALLBACK_CONFIRMATION`), `callback_secret` (`VK_CALLBACK_SECRET`), `api_version` (`VK_API_VERSION`, default `5.199`), `screen_name` (`VK_SCREEN_NAME`, default `loviiru`), `api_url` (`VK_API_URL`, default `https://api.vk.com/method`). Секретов в репо нет — только env-имена.
2. **Миграция:** `max_bot_links` — `dropUnique(['phone'])` → `unique(['bot','phone'])` (ловушка F-038: сейчас один телефон физически не может держать привязки двух ботов). Дата-миграция без потери данных (сегодня по строке на телефон — конфликтов нет).
3. **`App\Infrastructure\VK\VKApiClient`**: Guzzle, таймауты connect 5 c / total 10 c, `sendMessage(int $peerId, string $text): void` → POST `{api_url}/messages.send` с `access_token`, `v`, `peer_id`, `message`, `random_id` (генерировать каждый вызов), `group_id`, `dont_parse_links=1`, `disable_mentions=1`. HTTP-код ≠ 200 или `error` в ответе → исключение домена. Ответ VK `{"error":{"code":901,...}}` — код ошибки пробрасывать в исключении. Прокси НЕ добавлять (F-030 — Telegram-специфика; недоступность api.vk.com = стоп, см. Т-004).
4. **`App\Application\VK\Handlers\VKCallbackHandler`** (логика без HTTP, по образцу `TelegramOtpBotHandler`; scope — константа `BOT_SCOPE = 'vk:otp'`):
   - `type=confirmation` → вернуть сырую строку `config('vk.callback_confirmation')` (НЕ JSON);
   - `secret` в теле не совпал с `config('vk.callback_secret')` (если секрет задан) → 403, лог, без обработки;
   - `group_id` ≠ конфиг → игнор (ответ "ok");
   - `event_id`-дедуп: `Cache::add('vk:cb:event:'.$event_id, 1, TTL 24h)` — повтор → сразу "ok";
   - `message_new`: `ref` из `object.message.ref` (fallback `object.ref` — старый формат) → поиск pending-сессии по `binding_token` (как в `TelegramOtpBotHandler::bindAndDeliverCode`) → `MaxBotLink::upsertForBot('vk:otp', session->phone, vk_user_id, vk_user_id)` → `reissueCode` → `VKApiClient::sendMessage` (код первой строкой, далее канонический текст «Код для входа в приложение ЛОВИ. Никому его не сообщайте.») → "ok"; ref пуст/не найден → `messages.send` пользователю инструкцию «вернитесь в приложение ЛОВИ и запросите код заново…» (не молчать) → "ok";
   - `message_deny` → удалить `MaxBotLink` scope `vk:otp` по `chat_id = user_id` → лог → "ok";
   - `message_allow` → только лог (телефона в событии нет);
   - прочие типы → "ok".
5. **`VKCallbackController`** (`app/Http/Controllers/Api/V1/VK/`): тонкий контроллер — валидация JSON-тела, вызов хендлера, ответ строкой (confirmation → строка подтверждения; иначе `"ok"`, content-type `text/plain`).
6. **Роут** (`routes/api.php`, рядом с вебхуками MAX/Telegram, вне auth-группы): `Route::post('/vk/callback', VKCallbackController::class)` (итоговый путь `POST /api/v1/vk/callback`).
7. **`VKontakteSender`** (переписать заглушку): guard `MaxBotLink::forBot(VKCallbackHandler::BOT_SCOPE, $phone)` — нет ссылки → RuntimeException (defensive guard, образец `TelegramSender`); есть → `VKApiClient::sendMessage($link->chat_id, …)`.
8. **`SendOtpAction`** — ветка VK по образцу Telegram (строки 65–76): токен не задан → `BusinessException('otp_channel_unavailable')`; `MaxBotLink::forBot('vk:otp')` отсутствует → `linkRequired(...)`.
9. **`SendOtpAction::linkRequired`** — третья ветка deeplink: `https://vk.me/<screen_name>?ref=<binding_token>`, `messenger='vk'` (VK-ссылки не поддерживают `?start=`, только `?ref=` — не перепутать).
10. **`SendOtpController`**: для VK — `vk_link_required: true` + `vk_deeplink` (по образцу `telegram_link_required`).
11. **`AllChannelsStrategy`**: `VKontakte` добавлять в массив только если `(string) config('vk.community_token','') !== ''` (порядок max, telegram, vkontakte); комментарий в докблоке — со ссылкой на F-037/4d544ed (канал показываем только с реальной доставкой).
12. **`config/otp.php`**: `coming_soon.vkontakte` default `env('OTP_VKONTAKTE_COMING_SOON', true)` → `false` (флаг dormant; в секции-комментарии Coming Soon дополнить: vkontakte переведён в работающий канал — спека §7).
13. **Тесты** (Pest, образцы — `TelegramOtpAuthTest`, вебхук-тесты MAX):
    - unit `VKApiClient`: успешный send, HTTP 500, `error.code=901/902/6` (Http::fake — помни F-031: повторный `Http::fake()` НЕ переопределяет ранний wildcard — структурируй фейк один раз на тест);
    - feature callback: confirmation отдаёт строку; неверный secret → 403; дедуп event_id; message_new с валидным ref → привязка + код доставлен (fake VK API) + "ok"; message_new без ref → инструкция; message_deny → ссылка удалена; чужой group_id → игнор;
    - feature send-code VK: нет токена → `otp_channel_unavailable`; нет ссылки → `vk_link_required` + `vk_deeplink` (vk.me?ref=); ссылка есть → доставка; после message_deny → снова `vk_link_required`;
    - `AllChannelsStrategy`: без токена VK в списке нет, с токеном (config-mock) — есть;
    - миграция: телефон с двумя scope (telegram:otp + vk:otp) не конфликтует.
14. **Гейты и пуш:** `vendor/bin/pint --test` 🟢, `composer test` 🟢 → пуш в `staging` (НЕ master). CI/деплой: если deploy упадёт на composer 504 — rerun failed jobs (известная особенность). Session-док `docs/sessions/020-vk-otp-channel.md` + запись в `lovii-docs/status.md` (воркспейс) в том же пуш-цикле. В отчёт исполнителя — sha коммитов.

## Что НЕ делать (стоп-лист)

- НЕ трогать `TelegramSender`, `MaxSender`, telegram/max поллеры, `MaxWebhookController`, lovii-app (это T-003), e2e-тесты.
- НЕ реализовывать Bots Long Poll / `vk-poller` (задокументированный fallback, не пишем без решения владельца).
- НЕ реализовывать fallback «короткий код привязки» (§7.3 — зарезервирован).
- НЕ коммитить токен/секреты/строку подтверждения — только env-имена в config.
- НЕ выдавать VK-канал в списке без токена (шаг 11 обязателен).
- НЕ менять `dev_bypass`, log-транспорты, e2e-инфраструктуру (`GET /dev/otp/last-code` остаётся).

## Критерии приёмки

- `composer test` 🟢 локально и в CI; `pint` 🟢; e2e не изменены.
- `POST /api/v1/vk/callback`: confirmation → сырая строка; события → "ok"; секрет/дедуп/group_id работают.
- Сценарий send-code → `vk_link_required` → привязка по ref → код доставлен → `/auth/confirm` проходит (в тестах).
- Канал появляется в `request-code` только при заданном токене.
- Session-док 020 + запись в lovii-docs/status.md; коммиты в `staging`, CI 🟢.

## Отчёт исполнителя

**zcode, 2026-09-09 — выполнено.** Коммиты: `ff544d0` (шаги 1, 3–6), `5fdaf30` (шаги 7–12) → staging, оба CI 🟢.

- **Шаг 1** config/vk.php — env-имена, секретов нет. **Шаг 3** VKApiClient (timeouts 5/10, random_id, коды 901/902/6). **Шаг 4** VKCallbackHandler (confirmation/secret 403/group_id/дедуп event_id/message_new bind-by-ref/инструкции без молчания/message_deny unlink/message_allow лог). **Шаги 5–6** VKCallbackController + роут `POST /api/v1/vk/callback`. **Шаг 7** VKontakteSender — реальная доставка, guard на ссылку. **Шаги 8–10** SendOtpAction (otp_channel_unavailable без токена; vk_link_required), linkRequired → `https://vk.me/loviiru?ref=` (`messenger='vk'`), SendOtpController `vk_link_required`+`vk_deeplink`. **Шаги 11–12** стратегия: VK в списке только при токене (порядок max, telegram, vkontakte); coming_soon.vkontakte default false.
- **Шаг 2 (миграция F-038) — НЕ требуется:** `unique(bot, phone)` + dropUnique(phone) уже существует с 2026-09-08 (`2026_09_08_000001`), в БД staging `max_bot_links_phone_unique` отсутствует (проверено pg_indexes). F-038 скорректирован в FINDINGS (zcode).
- **Шаг 13 — тесты (17 новых, обновлено 2 legacy):** VKApiClientTest (3), VKCallbackTest (8), VKOtpAuthTest (6: скрытие/появление по токену/otp_channel_unavailable/vk.me?ref-пarking/доставка/фолбэк после deny), SendersTest + OtpAuthTest обновлены под реальный канал. Итог: **778 passed**, pint/rector/phpstan 🟢.
- **Живьём:** handshake подтверждён (строка уходит в VK), список каналов без токена — max+telegram. Владелец подтверждает URL в VK (кнопка «Подтвердить»). Отклонение от плана одно: шаг 2 не потребовался (см. выше).

(zcode: sha коммитов, покрытие тестами, отклонения от спеки — если были, ссылки на CI-прогоны)

## Приёмка Super Z (§3.1, 2026-09-09)

Вердикт: **Достаточно** → закрыта.

Факт-чек отчёта по спеке `otp-delivery-channels.md` §7 и коду staging (все
компоненты прочитаны из ветки, не из отчёта):

1. **Шаг 1** — `config/vk.php`: все env-имена по спеке, дефолты v=5.199/
   `loviiru`/api.vk.com; секретов в файле нет; докблок фиксирует выбор Callback
   API vs Long Poll со ссылкой на F-030 и запрет Long Poll без решения владельца.
2. **Шаг 3** — `VKApiClient`: connect 5s/total 10s; `random_id` генерируется на
   каждый вызов (`random_int(1, PHP_INT_MAX)`); `group_id`, `dont_parse_links=1`,
   `disable_mentions=1`; HTTP≠200 → `VKDeliveryException::transport`,
   `error` в 200-ответе → `fromVKError` (коды 901/902/6 — по тестам);
   прокси отсутствует — корректно (F-030 Telegram-специфичен).
3. **Шаг 4** — `VKCallbackHandler`: confirmation → сырая строка (проверяется ДО
   secret-гейта — верно: handshake VK несёт секрет не всегда); secret-mismatch
   только на событиях → 403; group_id с числовым fallback (`"123"` vs `123`);
   event_id-дедуп `Cache::add` + guard на пустой event_id; message_new —
   `object.message.ref` с fallback `object.ref`; пустой ref → инструкция
   пользователю (не молчание); message_deny → unlink по scope; message_allow →
   только лог. Все ветки возвращают "ok" (VK ретраит не-2xx — докблок это знает).
4. **Шаги 5–6** — `VKCallbackController` тонкий, `text/plain`, 400 на пустое
   тело, 403 на secret; роут `POST /api/v1/vk/callback` рядом с вебхуками
   MAX/Telegram, вне auth-группы.
5. **Шаг 7** — `VKontakteSender`: defensive guard `MaxBotLink::forBot('vk:otp')`
   с RuntimeException; код первой строкой + канонический текст — образец
   TelegramSender соблюдён (детект one-time-code в пушах сохранён).
6. **Шаги 8–10** — `SendOtpAction`: без токена → `otp_channel_unavailable`; без
   ссылки → `linkRequired`; `vk.me/<screen_name>?ref=<binding_token>` +
   `messenger='vk'` — `?start=` для VK не использован (ловушка §7 спеки
   обработана, комментарий в коде на месте).
7. **Шаги 11–12** — `AllChannelsStrategy`: VK добавляется только при непустом
   `config('vk.community_token')`, порядок Max → Telegram → VKontakte; докблок
   со ссылкой на F-037/4d544ed; `config/otp.php` — `coming_soon.vkontakte`
   default `false`, комментарий отражает переход канала в работающие.
8. **Шаг 13** — тесты в репо: VKApiClientTest (3 it), VKCallbackTest (10 it),
   VKOtpAuthTest (6 it) — 19 в сумме (в отчёте 17; расхождение в большую
   сторону, не блокер). CI staging на `17e0a5f` — success (последующие
   payment-коммиты зелёные поверх VK-базы).
9. **Шаг 2** — подтверждено: миграция `unique(bot, phone)` существует с
   `2026_09_08_000001`, шаг честно отменён в отчёте; F-038 скорректирован.

Возражений нет. Живой путь (привязка по ref → доставка кода → вход) подтверждён
закрытием T-004 живым тестом владельца (`53c5d01`).

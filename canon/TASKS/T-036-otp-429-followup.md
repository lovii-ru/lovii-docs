# T-036 — OTP-429 (O-2): остаток работ после P0-волны — передача агентам

> Статус: **Открыта**
> Приоритет: **P0** (пункт 1 — прод-промоушен фикса), далее P1/P2
> Источник: ресёрч O-2 — `artifacts/RES-016-otp-o2-429-research.md` (§6–§8, §10.3)
> + отчёт P0-волны — `artifacts/2026-10-06-arena-prioritization/EXECUTION-P0-2026-10-06.md`
> Репо: `lovii-core` (лимитеры/trust-прокси), `lovii-app` (экран каналов)
> Дата постановки: 2026-10-06 (автор — auto-coder, по запросу владельца)

## Сделано (не переделывать)

1. Диагноз и фазировка O-2 — в RES-016 (независимая сверка: 47 спот-чеков, 0 опровергнутых).
2. **Глобальные IP-бакеты исправлены на staging:** `bootstrap/app.php` — `trustProxies` (env `TRUSTED_PROXIES`), 429 отдаёт `Retry-After`/`X-RateLimit-*`; тест `tests/Feature/Auth/OtpTrustedProxiesTest.php`; core `01d66a65`/`243ba081` в `origin/staging`; живое репро 30×200→429 устранено; гейт 1697/1697.
3. SZ-086 (нормализация телефона) — core `514318c4` + app `6c818153`, в staging.

## Остаток: где копать → что сделать → критерий

### 1. Промоушен O-2-фикса на прод [P0 — блокирует исходную жалобу]
- **Где:** `lovii-core`/`lovii-app`: фикс только в `origin/staging`; `origin/master` его не содержит. Прод-деплой — вручную (`gh workflow run ci.yml --ref master`).
- **Что:** merge staging→master + выкатка; в `/opt/lovii-core/.env` задать `TRUSTED_PROXIES` (подсеть Caddy); прод-прогон H1/H5 из RES-016 §8.2.
- **Критерий:** 31-я `request-code` с одного клиента не блокирует других; 429 несёт `Retry-After`.

### 2. Trust-контур: сузить и закрыть от спуфинга [P1, дешёво]
- **Где:** `lovii-core/bootstrap/app.php` (env-дефолт — весь RFC1918), `tests/Feature/Auth/OtpTrustedProxiesTest.php`, `.env.example`.
- **Что:** точная подсеть Caddy в проде; регресс-тест «XFF от недоверенного источника игнорируется» (H7); строка `TRUSTED_PROXIES=` в `.env.example`; убедиться, что app недоступен снаружи напрямую.
- **Критерий:** XFF-спуф с недоверенного адреса не влияет на ключи лимитеров.

### 3. Фазы 2–4 (RES-016 §7–§8) [P1/P2]
- **1b** кулдаун «по факту доставки» (parked MAX/TG/VK): `app/Application/Auth/Actions/SendOtpAction.php:38-45,59-61,131`; `app/Models/Core/AuthOtpSession.php:40-57`; тест `OtpThrottleTest.php:124-125` фиксирует ОБРАТНОЕ — обновить вместе с фиксом.
- **1c** клиент: список каналов не исчезает при 429, дедуп request-code, backoff — `lovii-app/src/modules/auth-module/components/AuthCallCoders.vue:82-86,179-193,247-256`; обновить load-error тесты.
- **1e** стендовые ручки `otp.rate_limit.*` + kill switch: `lovii-core/config/otp.php` (ключей сейчас нет).
- **Фаза 3:** verify — инвалидация кода + накопительный пер-телефонный счётчик фейлов (`app/Domain/Auth/Services/OtpService.php:15,26-48,66-78,107-125`); пер-канальные состояния доставки + fallback UI; проверка маски до side-effects (`OtpDeliveryTargetResolver.php:50-77` vs `SendOtpAction.php:47-61`); явный `delivery_failed` для TG (сейчас 500 — `app/Infrastructure/Auth/Senders/TelegramSender.php:62-67`).
- **Фаза 2:** наблюдаемость/dark launch (attempts/sends/blocks) — ДО ужесточения порогов.

### 4. Стенд-чеки H2–H4, H6 [гейт перед фазой 3]
- Чек-лист: RES-016 §8.2. Особо: **H4** (сброс бюджета попыток при resend/reissue) и **H6** (пустой phone → общий ключ `'phone:'`).

### 5. P0-гейт: `binding_token` без владения телефоном/чатом [СТОП до решения владельца]
- Материалы: RES-016 §6; исходники — `.openclaw-autoclaw/agents/auto-coder/workspace/.cluster/lovii-otp-429-20261006/subagent_06.md` §B.5 (варианты а/б/в, дизайн для VK).
- Порядок: H8 на staging (согласованные тестовые номера, часы с командой) → решение владельца → только затем фазы 3–4. **Не публиковать вне команды.**

## Ссылки
- Полный отчёт: `artifacts/RES-016-otp-o2-429-research.md` (вёрстка — `.html`; §6 — критическая находка, §8 — чек-лист).
- Отчёт исполнения: `artifacts/2026-10-06-arena-prioritization/EXECUTION-P0-2026-10-06.md`.
- Исходники расследования: `.openclaw-autoclaw/agents/auto-coder/workspace/.cluster/lovii-otp-429-20261006/` (plan.md, code_report.md, subagent_01–11.md, review_R1/R2.md).

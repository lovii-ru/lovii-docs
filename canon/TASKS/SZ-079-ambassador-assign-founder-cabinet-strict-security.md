# SZ-079 — UI кабинета Основателя: назначение амбассадора (строго ручное, 4+1 проверок, красивый код)

> Статус: **Открыта** (после T-018/T-019/T-020/T-022/SZ-078 — токен-экономно, не давит; факт-чек постановки Super Z 27.09 — «Достаточно», якоря и 3 уточнения для zcode в §«Факт-чек постановки»)
> Приоритет: **P2** (продуктовая + безопасность) · Источник: решение владельца 2026-09-26 «только я лично в кабинете Основателя присваиваю роль амбассадора; prefix+автоген ИЛИ красивый промокод (EGRPAT); 3+ разноплановых проверки перед записью, люди будут пытаться обойти»
> Исполнитель: **zcode** · Репо: `lovii-core` (backend: command + API + policy + audit) + `lovii-admin` или `lovii-app` (founder cabinet UI — определяет zcode) + `lovii_docs` (BRD/PARAMS, session-док) · Дата постановки: 2026-09-26

## Контекст

Сейчас назначение амбассадора — artisan-only (`roles:assign-ambassador {phone} {prefix}`, `AssignAmbassadorCommand.php`). Команда:
- берёт **префикс** (ровно 2 буквы A-Z);
- **сама генерирует 6-символьный код** (prefix + 4-char случайный суффикс, алфавит `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` без 0/1/I/O, коллизии проверяются);
- **НЕ даёт выбрать полный код** (напр. `AAAAAA`, `EGRPAT`) — суффикс авто;
- проверяет только уникальность префикса, НЕ проверяет «кто назначает» (artisan = серверный запуск, ACL не на уровне приложения).

Владелец требует:
1. **UI в кабинете Основателя** — назначение амбассадора по телефону.
2. **Два режима**: (а) prefix + автогенерация суффикса (как сейчас), ИЛИ (б) **«красивый» промокод** — владелец прописывает полный 6-символьный код (напр. `EGRPAT`, `AAAAAA`).
3. **Строго только Основатель** — никто другой не может создать ветку амбассадора. Никаких автоматических bootstrap/self-claim.
4. **Минимум 3 разноплановых проверки перед записью в БД** — люди будут пытаться обойти, не давать.

### Канон (зафиксировать)

- **Амбассадор** = роль + префикс (2 буквы A-Z) + код (6 символов: prefix + 4 суффикса). Хранится в `ambassadors` (user_id, prefix, is_active, code).
- **Код амбассадора** = рекрутинговый (даёт скидку 199₽ при подписке по нему, `SubscriptionBillingService::resolvePrice()`).
- **При подписке** амбассадор получает **отдельный** представительский код (в `representative_promo_codes`, тот же префикс) — для МСП. Две роли, два кода.
- **`AAAAAA`** = код Основателя (присваивает себе сам через этот же UI → `users.promo_code = AAAAAA` → может подписаться → 199₽ → rep-код AAxxxx). Префикс `AA`.
- **Новые амбассадоры** (`EGRPAT` и т.п.) = только Основатель, вручную, из кабинета. Префикс `EG`, код `EGRPAT`.
- **Никаких auto-bootstrap / first-claim** — даже AAAAAA не «забирается первым регистрантом», а присваивается Основателем себе лично.

## Модель безопасности — 4 разноплановых проверки + 1 data validation

Все проверки — **server-side** (client-side проверок НЕ считать; UI только для удобства). Перед `Ambassador::updateOrCreate(...)`:

**Проверка 1 — Identity (кто создаёт):**
`Auth::id() === (int) config('platform.founder_user_id')` (env `PLATFORM_FOUNDER_USER_ID=51`, дефолт — user_id 51, профиль `+79119287478`). Requester должен быть Основатель. Server-side, из authenticated session (Sanctum token). Не путать с «у user есть ambassador-флаг» — это про ТОЖДЕСТВО, не про роль.

**Проверка 2 — Authorization/Permission (авторизация, отдельная от identity):**
Laravel Policy `AmbassadorPolicy::assign()` — проверяет `Auth::user()->can('ambassador.assign')`. Permission выдаётся ТОЛЬКО founder-роли (платформенный кабинет, `roles-module`). Даже если у угонщика валидный токен user-сессии — без founder-permission откажет. Defense in depth: identity + permission — две независимые проверки.

**Проверка 3 — 2FA/OTP confirmation (подтверждение действия):**
Действие назначения — **чувствительное** (создаёт ветку рефералки). Требовать **свежий OTP** (код из Telegram/MAX-канала, как в существующих OTP-каналах `OtpChannel::codeLength`). Флоу: founder в UI жмёт «Назначить» → сервер шлёт OTP в Telegram/MAX founder-у → founder вводит код → сервер верифицирует (с коротким TTL, напр. 5 мин) → только тогда `Ambassador::updateOrCreate`. Предотвращает session-hijack (украденный токен без OTP не сработает) и CSRF.

**Проверка 4 — Audit + alert (след, часть гейта):**
Каждая попытка (success ИЛИ denied) логируется в `ambassador_assignments_audit` (append-only: `assigner_user_id`, `target_user_id`, `prefix`, `code`, `result`, `reason`, `ip`, `user_agent`, `created_at`) + alert в Telegram/MAX-бот Основателю (на ЛЮБУЮ попытку, включая denied). Лог пишется ВНУТРИ той же транзакции, что и `Ambassador::updateOrCreate` (атомарность: нет записи без лога). Alert — через существующий Notification/Push-домен.

**Проверка 5 (data validation, не security, но обязательная):**
- prefix: ровно 2 буквы `[A-Z]`, не занят другим амбассадором;
- code (если owner-chosen «красивый»): 6 символов, **начинается с prefix**, алфавит `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (без 0/1/I/O), не занят среди `ambassadors.code` + active `representative_promo_codes`;
- target user: существует, телефон валиден, не амбассадор уже (или updateOrCreate по user_id — смена prefix разрешена только founder-ом).

Итого: **4 security + 1 data = 5 проверок**, из них 4 — разноплановые (identity, permission, 2FA, audit). Минимум 3 — выполнен с запасом.

### Векторы атаки (что закрывают проверки)

| Вектор | Закрывает |
|---|---|
| API-craft: кто-то шлёт POST /ambassador/assign напрямую | Проверка 1 (identity) + 2 (permission) — server-side откажет |
| Session hijack: украли founder-токен | Проверка 3 (2FA/OTP) — без свежего OTP не сработает |
| Insider с БД-доступом: INSERT в ambassadors напрямую | Проверка 4 (audit) — запись без лога = аномалия → alert; плюс БД-доступ отдельный канал (не app-слой) |
| Client-side spoof: модифицированный UI | Все проверки server-side — UI не авторитет |
| Коллизия кода: подобрать занятый | Проверка 5 (uniqueness) — reject + audit |

## Факт-чек постановки (Super Z, 2026-09-27) — вердикт: «Достаточно»

Состязательная сверка постановки с реальным кодом `lovii-core` staging (`164a90c`). Все
технические утверждения подтверждены; три уточнения для исполнителя — ниже.

**Подтверждённые якоря:**

| Утверждение карточки | Якорь в коде |
|---|---|
| Сигнатура `roles:assign-ambassador {phone} {prefix}`, суффикс только автоген | `app/Console/Commands/AssignAmbassadorCommand.php:18` (опции `--code` нет) |
| Префикс — ровно 2 буквы A-Z | там же, `:27` (`preg_match('/^[A-Z]{2}$/')`) |
| Алфавит `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` без 0/1/I/O, суффикс 4 символа | там же, `:72-80` |
| Коллизии: `ambassadors.code` + активные `representative_promo_codes` | там же, `:82-83` |
| Только prefix-уникальность, ACL нет, `updateOrCreate` по user_id | там же, `:41-52` (повторное назначение тому же user = апдейт; занятый другим — отказ) |
| `ambassadors`: user_id, prefix, is_active, code | модель `app/Models/Core/Ambassador.php` + миграция `2026_09_19_160000` (code string(6) nullable unique) |
| 199₽ по амбассадорскому коду | `SubscriptionBillingService::resolvePrice()` `:492-505` (BRD §A2) |
| Реп-код при подписке, тот же префикс | `RepresentativePromoService::issue()` `app/Domain/Roles/Services/RepresentativePromoService.php:32`, `FOUNDER_PREFIX='AA'` `:23` |
| `users.promo_code` | миграция `2026_09_14_120001` (string(6) nullable) |
| OTP-каналы живы (Проверка 3 осуществима штатно) | `OtpChannel::codeLength()` (`SendOtpAction:59`, `TelegramOtpBotHandler:144`) |
| Rate limit паттерн есть (Г.1 ложится 1:1) | `AppServiceProvider::configureRateLimiters()` `:173+` (пример `otp-send`) |
| Запретные зоны §1.2 названы верно | `canon/WORK_PROTOCOL.md:54-55` (`config/payments.php`, `tbank-mock`, `ProfileWallet`/`PayCard`) |

**Уточнения для zcode (не меняют вердикт):**

1. **Код Основателя сейчас `AA2222`, не `AAAAAA` — и это не конфликт, а первый кейс Фазы В.**
   `AAAAAA` — прод-канон (BRD v1.0:189 «неизменяем, зарезервирован навсегда»;
   `PROD_STARTER.md:19-20,36`: «AA2222/AA2BTK — артефакты тестового стенда; канону
   Основателя отвечает AAAAAA»). Но в staging-коде и стенде живёт `AA2222`:
   дефолт `config/payments.php:107` (`FOUNDER_REP_PROMO_CODE`, `'AA2222'`) и миграция
   `2026_09_19_160000` перенесла его в `ambassadors.code` Основателя. Значит Фаза В
   (self-assign `AAAAAA`) встретит существующую запись амбассадора Основателя с
   `code=AA2222`: `updateOrCreate` по user_id (prefix `AA` тот же юзер — апдейт) +
   смена кода через owner-chosen путь. Тесты Д.2 (self-assign) обязаны покрывать
   сцену «у Основателя уже есть AA2222» — иначе в тест-среде кейс не воспроизведётся.
   Попутно (вне SZ-079, но связано): PROD_STARTER `:41-42` требует перекрыть
   `FOUNDER_REP_PROMO_CODE=AAAAAA` на проде — дефолт конфига стенда остаётся AA2222.
2. **`config/platform.php` не существует** — создаётся задачей
   (`config('platform.founder_user_id')` + env `PLATFORM_FOUNDER_USER_ID`; Г.3: на
   staging = 51; на прод-стартере Основатель = `users.id=1` — env обязателен, дефолт 51
   справедлив только для staging-стенда).
3. **Minor:** модель `Ambassador` использует `$guarded = ['id']` (не `$fillable`) —
   для А.4 (audit-модель) это не помеха, но mass-assignment-политику аудит-записи
   держать явной (`$fillable` = все поля, append-only без update/delete).

## Что сделать

### Фаза А — Backend: extend command + API + policy + checks + audit

А.1. **Extend `roles:assign-ambassador`** (или новый `AssignAmbassadorAction`):
- сигнатура: `roles:assign-ambassador {phone} {prefix} {--code= : 6-символьный красивый код (опционально; пусто → автогенерация)}`;
- если `--code=` задан — валидация (Проверка 5): 6 символов, начинается с prefix, алфавит, не занят → использовать его; иначе — автогенерация (как сейчас `generateCode()`).
- artisan остаётся для ops/zcode (staging), но **server-side checks** (Проверки 1–4) ВНУТРИ action — artisan-вызов тоже проходит гейты (identity = тот, кто запускает на сервере = founder/zcode с разрешением; permission = founder; 2FA для artisan — опционально, т.к. artisan = серверный доступ уже).

А.2. **API endpoint** `POST /api/v1/platform/ambassadors` (founder cabinet):
- body: `{ phone, prefix, code? }` (code опционально);
- **Проверки 1–5** все server-side;
- Response: 201 + `{ ambassador_id, user_id, prefix, code }` или 403/422 с причиной.

А.3. **Policy `AmbassadorPolicy`** (Laravel): методы `assign()` (основное), `bypass()` (deny для всех не-founder). Permission `ambassador.assign` — только founder-роль.

А.4. **Audit table + model**: миграция `create_ambassador_assignments_audit_table` (append-only, no update/delete — только insert). Model `AmbassadorAssignmentAudit` с `$fillable` = все поля.

А.5. **Alert**: Notification-канал (Telegram/MAX) — `AmbassadorAssignmentNotification` на founder-profile при любой попытке (success/denied). Через существующий Notification/Push-домен.

### Фаза Б — Founder cabinet UI

Б.1. **Где**: `lovii-app` platform-module (`/cabinet/platform` или `/cabinet/founder`) — страница «Амбассадоры» (или раздел в существующем cabinet founder).

Б.2. **Форма**: поле `телефон` (+ маска/валидация), поле `префикс` (2 буквы, uppercase, с подсказкой «уникален»), поле `код` (опционально, 6 символов, с подсказкой «если пусто — автогенерация»; валидация: начинается с prefix, алфавит).

Б.3. **2FA-флоу**: submit → сервер шлёт OTP в Telegram/MAX founder-у → модал «введите код» → верификация → success/denied toast.

Б.4. **Список амбассадоров**: таблица (user, prefix, code, is_active, назначил/дата) — read-only из `ambassadors` + `ambassador_assignments_audit`.

### Фаза В — AAAAAA founder self-assignment (особый случай)

В.1. **Founder присваивает себе AAAAAA** через тот же UI: `phone = +79119287478`, `prefix = AA`, `code = AAAAAA`. Проходит те же Проверки 1–5 (identity = founder ✓, permission = founder ✓, 2FA ✓, audit ✓, data ✓). Создаётся `Ambassador(user_id=51, prefix=AA, code=AAAAAA)`.

В.2. **Auto-set `users.promo_code = AAAAAA`** для founder-профиля при self-assignment (если ещё не установлен). Чтобы founder мог подписаться (гейт SZ-057 требует promo_code). Если уже установлен другой код — не перезаписывать без подтверждения.

В.3. **Founder подписывается** (PASS) → AAAAAA активный амбассадорский → 199₽ → `RepresentativePromoService::issue()` генерит rep-код AAxxxx → founder имеет 2 кода (AAAAAA + AAxxxx), 2 роли.

### Фаза Г — Security hardening

Г.1. **Rate limit** на endpoint: max 5 попыток назначения в час (защита от брутфорса кодов).

Г.2. **Anomaly detection**: если в `ambassadors` появилась запись БЕЗ соответствующей записи в `ambassador_assignments_audit` → alert (кто-то INSERT напрямую). Cron-проверка раз в час.

Г.3. **Secrets**: `PLATFORM_FOUNDER_USER_ID` в env (не в коде). На staging = 51.

### Фаза Д — Тесты

Д.1. **Unit**: `AmbassadorPolicy` — founder pass, не-founder deny; валидация prefix/code; коллизии.

Д.2. **Feature**:
- founder назначает с beautiful code (`EGRPAT`) → 201 + audit + alert;
- founder назначает с автогенерацией (только prefix `BB`) → 201 + code `BBxxxx`;
- не-founder (authenticated, но не founder) → 403 + audit-denied + alert;
- без 2FA-OTP → 403 + audit-denied;
- коллизия кода (`EGRPAT` занят) → 422 + audit-denied;
- founder self-assign AAAAAA → 201 + users.promo_code=AAAAAA + может подписаться.

Д.3. **E2E**: founder UI flow — телефон + prefix + code → 2FA модал → success toast + запись в списке.

### Фаза Е — Документация

Е.1. **BRD.md** §2.4 (роли) — дополнить: «назначение амбассадора — только Основатель, вручную, из кабинета; 4+1 проверок (identity, permission, 2FA, audit, data validation)».

Е.2. **PARAMS.md** — `PLATFORM_FOUNDER_USER_ID=51`, `ambassador.assign` permission scope.

Е.3. **Session-док** `lovii-core/docs/sessions/NNN-sz079-ambassador-assign.md` — таблица проверок, flow, SHA, тесты.

Е.4. **as-is/05** (роли/кабинеты) — обновить §«Амбасадорские коды»: «назначение = founder cabinet UI, 4+1 проверок; artisan остаётся для ops».

## Что не делать

- **Не делать auto-bootstrap / first-claim AAAAAA** — строго ручное назначение founder-ом.
- **Не доверять client-side проверкам** — все 4 security check-а server-side.
- **Не давать `--code=` без валидации** (коллизии, алфавит, prefix-match) — иначе можно перетереть чужой код.
- **Не трогать запретные зоны** (WORK_PROTOCOL §1.2): `config/payments.php`, `tbank-mock`, `ProfileWallet`/`PayCard`, чарджбэк SZ-045/F-050. SZ-079 — про ambassador assignment + security, не про платежи.
- **Не пушить в master напрямую** — PR + зелёный CI.
- **Регламент T-017 Фаза Г**: локально (`pint --test && rector --dry-run && phpstan && pest`), CI зелёный с первого раза, коммит на шаг, session-док на шаг.

## Приёмка

1. Founder назначает амбассадора из кабинета (UI): телефон + prefix + (опц.) красивый code → 2FA модал → success → запись в `ambassadors` + `ambassador_assignments_audit` + alert в Telegram/MAX.
2. Не-founder (authenticated, не founder) → 403 + audit-denied + alert. Без 2FA-OTP → 403 + audit-denied.
3. Beautiful code (`EGRPAT`) — создаётся, валидируется (prefix-match, алфавит, коллизии). Автогенерация (только prefix `BB`) — `BBxxxx`.
4. Founder self-assign `AAAAAA` (prefix `AA`) → `ambassadors.code = AAAAAA` + `users.promo_code = AAAAAA` → founder может подписаться → 199₽ → rep-код AAxxxx.
5. Аудит: каждая попытка (success/denied) в `ambassador_assignments_audit` + alert founder. Anomaly cron: запись без audit → alert.
6. Тесты: unit + feature + e2e — зелёные. `pint/rector/phpstan/pest` зелёный, CI зелёный с первого раза.
7. BRD/PARAMS + session-док + as-is/05 обновлены.

## Отчёт исполнителя

_(заполняет zcode: таблица проверок (1–5) с реализацией, SHA-коммиты, тесты (вкл. bypass-попытки), flow 2FA, alert-пример, скрины UI.)_

## Приёмка-1

_(независимый факт-чек Super Z — дата, вердикт `Достаточно` / `Доработка: …`. Особо: попытка bypass от не-founder-профиля → 403 + audit + alert.)_

## Приёмка-2

_(владелец — визуальная приёмка: founder UI flow, 2FA, красивый код EGRPAT, self-assign AAAAAA, alert в Telegram/MAX; вердикт.)_

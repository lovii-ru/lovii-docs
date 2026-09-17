> ⚠️ **АРХИВ.** Карточка закрыта и не является текущим источником требований; сохранена только для истории.

# T-001 — Синхронизировать coming_soon-флаги OTP-каналов с реальностью

> Статус: Закрыта решением владельца 2026-09-09 — из списка каналов скрыты все заглушки (`4d544ed`), мёртвый whatsapp-ключ удалён (Super Z `fdd1867`); линия VK выделена в трек V (SZ-001). История: Открыта → Возвращена владельцу (§2.4, F-037) → Закрыта. Перенесена в archive/tasks/ (WORK_PROTOCOL §3.5, коммит Super Z)
> Приоритет: P2 · Источник: `BACKLOG.md` §6 трек O, задача O-1; `FINDINGS.md` F-035
> Исполнитель: zcode · Спека: Super Z · Выдал: владелец
> Репо/ветка: `lovii-tech/lovii-core`, ветка `staging` · Дата постановки: 2026-09-09

## Контекст

Зачем: клиентский экран входа показывает каналы OTP по флагу `coming_soon` из
`GET /auth/otp/request`. WhatsApp помечен как доступный (`coming_soon=false`),
хотя `WhatsAppSender` — заглушка: реальной интеграции нет, доставка уходит в лог.
Пользователь, выбрав WhatsApp, не получит код. Это та же категория ошибки, что
инцидент F-035 (zcode «чинил» несуществующие SMS/обратные звонки).

Текущее состояние кода (сверено 2026-09-09, origin/staging):

- `config/otp.php` §coming_soon (строки ~37–43): дефолты `max=false`,
  `sms=true`, `whatsapp=false`, `telegram=false`, `vkontakte=true`, `call=true`.
  Аномалия — **whatsapp**: дефолт `false` при заглушечном сендере.
- `app/Infrastructure/Auth/Senders/`: реальную доставку выполняют только
  `TelegramSender` (@loviiru_bot) и `MaxSender` (legacy). `SmsSender`,
  `WhatsAppSender`, `VKontakteSender`, `CallSender` — заглушки `logger()` с TODO.
- Читающие тесты: `tests/Feature/Auth/TelegramOtpAuthTest.php` (строки 274–285,
  проверяет telegram/max), `tests/Feature/Auth/OtpAuthTest.php` (тест
  `returns available channels for a phone number`, строки 16–27 — структуру
  списка каналов, но не флаги coming_soon).

Перед началом обязательно прочитать: `canon/STATUS.md` (свежий срез),
`canon/FINDINGS.md` (F-030, F-035), `canon/BACKLOG.md` §6 трек O,
`canon/WORK_PROTOCOL.md` §2.

## Что сделать

1. `config/otp.php`: в массиве `coming_soon` сменить дефолт whatsapp
   `'whatsapp' => env('OTP_WHATSAPP_COMING_SOON', false)` →
   `'whatsapp' => env('OTP_WHATSAPP_COMING_SOON', true)`.
   Меняется ТОЛЬКО дефолт (второй аргумент env()); имена переменных окружения
   не трогать.
2. `tests/Feature/Auth/OtpAuthTest.php`, тест
   `returns available channels for a phone number`: добавить проверку флагов
   по типам каналов в ответе `GET /auth/otp/request` (без env-переопределений):
   `sms`, `whatsapp`, `vkontakte`, `call` → `coming_soon === true`;
   `max`, `telegram` → `coming_soon === false`.
   Стиль — как в `TelegramOtpAuthTest.php:274-285` (`expect(...)->toBeTrue()`).
3. Прогнать локально: `composer test:unit` (Pest, suites Unit+Feature) и
   `composer test:lint` (pint, rector, phpstan). Всё зелёное.
4. Закоммитить (конвенции репо: `fix(auth): ...`), запушить в `staging`
   (пуш = автодеплой стейджинга — это ожидаемо).
5. Заполнить «Отчёт исполнителя» ниже, в этом же файле lovii_docs сделать пуш
   со статусом задачи «На приёмке» и срезом `canon/STATUS.md` (устав §9).

## Что НЕ делать (стоп-лист)

- НЕ трогать `SmsSender`, `WhatsAppSender`, `VKontakteSender`, `CallSender` —
  это заглушки вне очереди (трек O: «не чинить без решения владельца»).
- НЕ интегрировать SMS/flash-call/WhatsApp/VK провайдеров и НЕ добавлять
  новых каналов в `OtpChannel`.
- НЕ менять логику `TelegramSender` / `MaxSender` и Telegram-ботов.
- НЕ менять env на сервере и сами env()-ключи; задача не требует доступа
  к серверу. Если окажется, что требует — остановиться и вернуть задачу.
- НЕ пушить в `master`, НЕ трогать lovii-app, b2b, admin, lovii_docs/canon
  (кроме статуса этой задачи и среза STATUS.md).
- Проверка env стейджинга на `OTP_WHATSAPP_COMING_SOON` НЕ входит в задачу:
  это инфраструктура владельца — сообщить в отчёте, если тесты на CI/стейджинге
  поведут себя иначе из-за env.

## Критерий приёмки

- На чистом окружении (без `OTP_*` env) `GET /auth/otp/request` возвращает
  `whatsapp` с `coming_soon=true`; `sms`, `vkontakte`, `call` — `true`;
  `max`, `telegram` — `false`.
- Pest Unit+Feature зелёные; pint/rector/phpstan без замечаний; CI репо зелёный.
- В `staging` улетел ровно один коммит с этим изменением (+тест), история
  не перемотана.
- В lovii_docs: задача в статусе «На приёмке», срез STATUS.md в той же серии.

## Отчёт исполнителя

**Итог (zcode, 2026-09-09): задача возвращена владельцу по WORK_PROTOCOL §2.4 —
расхождение реальности со спекой. Код `lovii-core` не менялся, пушей в lovii-tech нет.**

Расхождения (каждое по отдельности блокирует критерий приёмки):

1. **Эндпоинт.** В задаче и O-1 назван `GET /auth/otp/request` — такого роута в
   lovii-core нет. Реальный источник списка каналов — `POST /api/v1/auth/request-code`
   (`RequestOtpController`); его же читает lovii-app (`auth-api.ts`).
2. **WhatsApp в ответе отсутствует.** Каналы отдаёт `AllChannelsStrategy` — жёсткий
   список (max, sms, telegram, vkontakte, call); WhatsApp исключён намеренно коммитом
   `f9b1955` («…hide WhatsApp channel»). Существующий тест это уже фиксирует:
   `->not->toContain('whatsapp')` (OtpAuthTest:26) — вопреки описанию спеки
   («структуру списка, но не флаги»), тест знает о WhatsApp.
3. **Дефолт `coming_soon.whatsapp` — мёртвый код.** Контроллер читает конфиг только
   для каналов из списка; WhatsApp вне списка, поэтому шаг 1 спеки (правка
   `false → true`) не имеет наблюдаемого эффекта, а шаг 2 (проверка
   «whatsapp → coming_soon === true» в ответе) невыполним в принципе.

Сценарий из «Контекста» («клиент показывает WhatsApp доступным, пользователь
выбирает — и не получает код») недостижим: канал не показывается и не выбирается.
Варианты решения — `canon/FINDINGS.md` F-037: оставить как есть / вернуть канал
в списке с «Скоро» (переоткрыть T-001 в новой редакции) / зачистить мёртвый ключ.

- **Коммиты:** lovii-core — нет (остановка §2.4 до правок); lovii_docs — один коммит
  этой серии: FINDINGS F-037, статус T-001, пометка у O-1 в BACKLOG, срез STATUS.md.
- **Прогоны:** не выполнялись — правок кода не создавалось, гейт не применим.
- **Отклонения от стоп-листа:** тронуты `canon/FINDINGS.md` (предписан §2.4 напрямую)
  и одна строка-предупреждение у O-1 в `canon/BACKLOG.md` (сверх разрешённого «статус
  задачи + STATUS.md» — чтобы следующий исполнитель не взял O-1 с ложной премисой;
  обоснование: §2.4 старше стоп-листа задачи). Остальное — в границах стоп-листа.

---

## Закрытие (zcode, 2026-09-09, решение владельца)

Вместо трёх вариантов из F-037 владелец выбрал расширенное решение: **скрыть из
списка каналов все заглушки** (sms, whatsapp, vkontakte, call) — на экране входа
остаются только каналы с реальной доставкой (max, telegram), — а в коде оставить
комментарии «реализация по приоритизации бэклога» (`AllChannelsStrategy`,
`config/otp.php`). Реализовано `4d544ed` (feat/hide-stub-otp-channels → staging;
локально: pest 761 passed, pint/rector/phpstan чисто; staging CI 🟢; live-ответ
request-code — только max+telegram). Тест состава списка переписан под новую
реальность. VK — не «вернуть в список», а полноценный канал: BACKLOG трек V,
изыскание `SZ-001` (исполнитель Super Z). Задача готова к переносу в `archive/tasks/`.

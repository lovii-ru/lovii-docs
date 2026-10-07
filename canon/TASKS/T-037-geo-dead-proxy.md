# T-037 — Геокодер за мёртвым прокси: адрес не подставляется автоматически

> Статус: **ЗАКРЫТА 07.10** — фикс (стейдж+прод), §1 логирование (`e7eda3b6`),
> §2 аудит + вариант А (рантайм-прокси удалён, смок зелёный).
> Остаток — только промоушен `e7eda3b6` в прод при следующем релизе.
> Приоритет: **P1** (UX-баг «не проставляется адрес» закрыт фиксом; остаток — устойчивость)
> Источник: жалоба владельца 07.10 («после переезда на новые рельсы не проставляется
> адрес автоматом, у всех») → диагноз и фикс — `lovii-core/docs/sessions/098-geo-noproxy-yandex.md`
> Репо: `lovii-core` (docker-compose.prod.yml)
> Дата постановки: 2026-10-07

## Что случилось (симптом и диагноз — не переделывать)

1. **Симптом:** `POST /api/v1/geo/{suggest,resolve,reverse}` на staging **и** проде
   отвечали `{"results":[]}` — автоподстановка адреса не работала ни у авторизованных,
   ни у гостей. Миграция на «новые рельсы» тут ни при чём — прокси умер независимо.
2. **Диагноз:** запросы из контейнеров шли через `HTTPS_PROXY=http://172.17.0.1:3128`
   (мост к внешнему SOCKS5, апстрим мёртв — та же история, что с Telegram, сессия 096).
   Живьём: `cURL error 7: CONNECT tunnel failed, response 503` для
   `suggest-maps.yandex.ru`. Напрямую из контейнера (`--noproxy`) Яндекс доступен.
3. **Отвлекающий фактор:** ключи и Referer-ограничение Яндекса (`lovii.ru` в кабинете)
   в порядке — `config:show geo.yandex` в контейнерах корректен, запрос до Яндекса
   просто не доходил.
4. **Усугубляющий фактор:** `YandexGeocoder::get()` молча глотает ошибки
   (`app/Infrastructure/Geo/YandexGeocoder.php:179-197` — `ConnectionException`/
   `failed()` → `[]`), поэтому деградация выглядела как «просто нет подсказок», 200 OK.

## Сделано (фикс)

- **`lovii-core` commit `840aa17d`** (ветка `staging`, CI run `37546350270`):
  во всех 7 сервисах `docker-compose.prod.yml` в `NO_PROXY`/`no_proxy` добавлены
  `suggest-maps.yandex.ru,geocode-maps.yandex.ru` — по образцу фикс-а Telegram
  (сессия 096: DNS-пин IPv4 + NO_PROXY).
- Session-док: `lovii-core/docs/sessions/098-geo-noproxy-yandex.md`.

## Остаток: где копать → что сделать → критерий

### 1. Не молчать при отказе внешнего геокодера — ✅ ВЫПОЛНЕНО 07.10
- **Где:** `lovii-core/app/Infrastructure/Geo/YandexGeocoder.php` (`get()`).
- **Сделано:** core `e7eda3b6` (в staging) — `ConnectionException` уходит через
  `report()` (стектрейс в laravel.log), HTTP-ошибки — через `Log::warning` с
  `host`+`status`; поведение ответа не менялось (200 + пустой results = режим
  деградации). Тесты: 2 новых в `GeoControllerTest.php` (403 → warning с
  контекстом; ConnectionException → деградация), гейт GATE=full зелёный.
- **Критерий:** ✅ отказ Яндекса виден в laravel.log, `/geo/*` отвечает 200.

### 2. Аудит внешних HTTP-зависимостей на прокси-транзит [P1] — ✅ АУДИТ ВЫПОЛНЕН 07.10
- **Кто транзитит прокси:** 13 контейнеров — все app/scheduler/horizon/poller'ы
  core (прод+staging) и tbank-mock. b2b/admin/app-контейнеры прокси НЕ имеют
  (прокси задаётся только в `/opt/lovii-core{,-staging}/.env` → `env_file`).
- **Мёртвость тотальна:** через `172.17.0.1:3128` НЕ проходит ни один внешний
  хост (CONNECT 000/503): tinkoff, business.tbank.ru, vk, dadata — все обрыв.
- **Напрямую доступно всё** (замер из контейнера `--noproxy`): Yandex ✅ (уже в
  NO_PROXY), `securepay.tinkoff.ru` ✅, `business.tbank.ru` ✅ (301),
  `rest-api-test.tinkoff.ru` ✅, `api.vk.com` ✅, `suggestions.dadata.ru` ✅
  (301), MAX (`platform-api2.max.ru`) ✅, Telegram ✅ (IPv4-пин extra_hosts).
- **Где живёт рантайм-прокси:** `.env` обоих стендов: `HTTPS_PROXY` (прод :107,
  staging :80) + `NO_PROXY` (прод :122, staging :135 — без яндекс-хостов,
  актуальный NO_PROXY приходит из compose `environment`, он перекрывает .env).
  `BUILD_HTTP_PROXY` (прод :62, staging :66) — трогать НЕЛЬЗЯ: он нужен на
  этапе сборки образа (pecl-зеркала) и в контейнеры не попадает.
- **Развилка владельца — рантайм `HTTPS_PROXY`:** ✅ РЕШЕНА 07.10 вечер —
  вариант **А** («да» владельца): рантайм `HTTPS_PROXY` удалён из `.env` обоих
  стендов (бэкапы `.env.bak-20261007-proxy`), контейнеры пересозданы, мост
  172.17.0.1:3128 остался только для build-time (pecl). Смок обоих стендов
  зелёный (geo/healthz/pollers/b2b/admin/app). 🔴 Попутная находка: голый
  `docker compose` в /opt подхватывает дев-файл — только
  `-f docker-compose.prod.yml [-f staging-extras]` (детали и порядок
  пересоздания сети — session-док 098, «Дополнение 2»).
  SMTP-почта через HTTP-прокси не ходит (MAIL_MAILER=smtp, отдельный транспорт).

### 3. Промоушен фикса на прод — ✅ ВЫПОЛНЕНО 07.10
- staging→master: core `8ed64459`, app `187bbfa`; workflow_dispatch:
  CI core `37588230938` ✅, CI app `37588235041` ✅ (прод-деплой оба).
- Пост-деплой на проде: `POST /api.lovii.ru/api/v1/geo/suggest` → непустой
  results («Тверская улица, 7»), `/geo/reverse` → «Театральная площадь, 1»,
  `healthz` 200; NO_PROXY прод-контейнера содержит Yandex-хосты; pollers/
  horizon/scheduler пересозданы и healthy, OTP-poller long-polling жив.
- Заодно в этом же релизе выкачен SZ-090 (app: прод-версия `187bbfa`,
  `version.json` no-store подтверждён).

# RELEASE GATE F-6 — волна 06.10 (P0/P1) — чек-лист и результат

> Вердикт арены: SZ-089 ПРИНЯТО, F-5 ЗАКРЫТ (см.
> `audit-bundle/ZCODE-REQUEST-TO-ARENA-ACCEPT-P0-2026-10-06.md`, финальный раздел).
> Ручное «го» владельца на прохождение плана арены (включая staging→master):
> 06.10 вечер. Gate исполнен zcode, результаты ниже.

| # | Пункт гейта | Результат |
|---|---|---|
| 1 | TRUSTED_PROXIES в production env | ✅ Добавлен явно в `/opt/lovii-core/.env` (дефолт приватных диапазонов; бэкап `.env.bak-sz089-release-*`); прод-app пересоздан, переменная в контейнере подтверждена |
| 2 | Фактический env всех prod-контейнеров, включая workers | ✅ `env-diff post` (SZ-089 guard) на всех 5 стеках: prod core/app/b2b/admin + staging core — **все OK**. Первый прогон поймал MISSING TRUSTED_PROXIES в workers (recreate только app) — исправлено полным `up -d` |
| 3 | Нет staging/mock-конфигурации в проде | ✅ С тремя находками: (а) `payment_settings.tbank_channel='staging-mock'` в прод-БД — строка удалена (канал неактивен по построению, `environments:['staging']`, но гейт требует чистоты); (б) `PAYMENTS_FAKE_PAYMENT_URL` дефолт в config указывал на app-staging — **исправлено в коде** (core `3ee84779`, CI ✅, staging деплой ✅); (в) на проде проверено: `PAYMENTS_FAKE` отсутствует (config default false), `OTP_DEV_BYPASS=false`, `APP_ENV=production`, mock-контейнеров в прод-стеке нет |
| 4 | OTP/rate-limit smoke | ✅ `request-code` 200 (список каналов MAX/TG/VK); IP-бакет: 30×200 → 429 на проде — лимитер работает по реальному IP; `dev/otp/last-code` → 404 (закрыт); OTP_DEV_BYPASS=false |
| 5 | Payment smoke без реального списания | ✅ read-only: `payments.fake=false`; канал bank-prod → `securepay.tinkoff.ru`; `payment_settings` пуст (канон env/дефолтов); номинал `platform_nominal` balance=0; реальных заказов/платежей на проде не создавалось (правило волны) |
| 6 | Backup и rollback | ✅ прод-бэкапы по крону (`backup-prod-db.sh` 03:47, staging 04:17, env-parity 05:07); pre-migrate dumps на месте; env-бэкапы свежие (`.env.bak-sz089-release-*`); rollback деплоя: `lovii-deploy.bak-sz089` + откаты образов по SHA (R-3.2) |
| 7 | Release-документ | ✅ этот файл |
| 8 | Ручное «го» владельца | ✅ 06.10 вечер («го … следуем по плану арены») |
| 9 | staging → master | ✅ исполнено после пунктов 1–8: core PR staging→master + `workflow_dispatch` (deploy-production), app — аналогично; post-deploy верификация — в конце этого документа |

## Состав релиза (что уходит в прод)

- **lovii-core** (staging→master): O-2 TrustProxies + Retry-After; SZ-086
  нормализация телефона; SZ-089 маркер; F-6.3 дефолт fake_payment_url.
- **lovii-app** (staging→master): SZ-086 маска телефона (без потери цифры);
  SZ-088 merge-фикс корзины.
- b2b/admin: изменений волны нет — релиз не требуется.

## Post-deploy верификация (06.10 ночь — ГОТОВО)

- **Прод-деплой**: core run `37531226884` ✅ (checks+deploy-production), app run
  `37531231187` ✅ (первый прогон — флейк unhandled rejection в
  AuthByBinding.test после teardown, 1050/1050 зелёные; rerun failed-джобы —
  чисто). SHA прода: core `17413095`, app `081496e2`.
- **env-diff post** на прод-стеках после деплоя (guard отработал в джобе +
  ручная сверка): core OK, app OK.
- **TRUSTED_PROXIES** в прод-контейнере: подтверждена.
- **OTP** `request-code` прод = 200; SZ-086 нормализация живьём на проде:
  `79009990123`/`89009990123`/`9009990123` → все 200 (канон один).
- **app.lovii.ru** = 200.
- **deploy-staging skipped** в master-прогонах — штатно (deploy-staging
  привязан к ветке staging).

## Статус: RELEASE COMPLETE — P0/P1-волна 06.10 в проде.

## Остаточные риски / follow-up (вне гейта)

1. Живой rollback drill — не исполнялся (документирован) — production-readiness follow-up.
2. UX-toast unavailable_reason (F-3) — UX-пачка.
3. T-036: per-channel fallback, bruteforce budget, H8 binding token.
4. F-5-хвост: найти операцию, стёршую env 05.10 (механизм защиты уже действует).

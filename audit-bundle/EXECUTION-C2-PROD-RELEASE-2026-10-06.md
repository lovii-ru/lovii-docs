# EXECUTION-C2 — первый прод-релиз по новому контуру (2026-10-05/06, «го» владельца)

**Закрывает:** C2 (первый прод-релиз), прод-части R-2.1 (forced-command
production), R-2.4 (pre-migrate dump), R-3.2 (pull по SHA) — live-доказательства
вместо attestation.

## Что выложено

| Стек | Прод SHA | Что вошло |
|---|---|---|
| lovii-core | a0eb9a4c | Волны 1–3 аудита CI + rector timeout 600s + VK-фикс + BankStatement/T-API + дефолтный тариф доставки точки |
| lovii-app | 8da52fd | Волны 1–3 + CI-стабилизация тестов (fetch-мок, testTimeout 15s) + --target prod |
| lovii-b2b | cf50deb | Волны 1–3 (9 коммитов, все ci/docs/test) |
| lovii-admin | da24ece | R-3.3 полный (continue-on-error снят, baseline, schema-init, env) + rector timeout + pint |

## Чек-лист C2 — выполнен полностью

1. ✅ Merge staging→master ×4 (no-ff merge-коммиты, без конфликтов)
2. ✅ deploy-production ×4 вручную (workflow_dispatch на master)
3. ✅ **Первый live forced-command на проде**: lovii-deploy log
   `[production] OK stack=… sha=…` ×4; прод SHA = master SHA ×4
4. ✅ **Pre-migrate dumps ×3 созданы** на проде до миграций
   (`~/backups/pre-migrate/pre-migrate-lovii-{core,b2b,admin}-…dump`)
5. ✅ `deploy_key` не осел на SRV после деплоев (проверено)
6. ✅ Health: api 200, lovii.ru 200, b2b 302 (login-редирект), admin 200
7. ✅ БД: users=2, orders=3 (данные целы), кошельки Σ 9801₽ (без изменений)
8. ✅ CI ×4 на контейнерных раннерах `-c`

## Инцидент по ходу (admin, вылечен)

- rector timeout 120s (тот же класс, что core 05.10) → fix SimpleParameterProvider
  `PARALLEL_JOB_TIMEOUT_IN_SECONDS = 600` (namespace
  `Rector\Configuration\Parameter\SimpleParameterProvider`)
- pint style на сам rector.php → pint-фикс
- разъезд master/локаль при пушах → rebase (грабляKnown)

## Для арены

Прод-части R-2.1/R-2.4/R-3.2 теперь имеют **live-доказательства** (лог
`~/lovii-deploy.log` `[production] OK` ×4, dumps, health) — просьба учесть
при финальном вердикте R4: «production-путь не проверен» больше не актуально.
Полные логи: `~/lovii-deploy.log` на SRV (deploy-доступ).

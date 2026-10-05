# ARENA-INBOX — всё для контрольного аудита в одном месте (05.10, ночь)

Аудитор: здесь весь след исполнения. Читайте по порядку. Протокол: находки —
в этот же каталог (`AUDIT-CONTROL-R3-*.md`), вердикты сверяем коммитами.

## 1. Документы диалога (хронология)

| Файл | Что | Автор |
|---|---|---|
| `AUDIT-FINDINGS-2026-10-05.md` | 18 находок (3×P0) | arena |
| `AUDIT-CONTROL-2026-10-05.md` | верификация, errata, R-* с done-критериями | arena |
| `AUDIT-VERDICT-ZCODE-2026-10-05.md` | вердикт 17/18 + живая проверка §4 (Z-1/Z-2) | zcode |
| `AUDIT-RECONCILIATION-2026-10-05.md` | сверка 18/18, R-1.7b, R-2.5 | arena |
| `AUDIT-RESPONSE-ZCODE-R2-2026-10-05.md` | решение по R-1.7b (422), принятие R-2.5 | zcode |
| `EXECUTION-WAVE2-2026-10-05.md` | отчёт об исполнении Волны 2 | zcode |
| `ARENA-FOLLOWUP-ZCODE-WAVE2-2026-10-05.md` | вопросы и критерии контрольной приёмки Волны 2 | arena |

## 2. Статус исполнения (вечер 05.10)

| Блок | Статус |
|---|---|
| Волна 1 (R-1.1…1.9) | ✅ исполнена ×4, живые деплои проверены (R-1.8 ⏳ root) |
| R-1.7b | ❌ неисполнима: required reviewers = платная защита, HTTP 422 (доказательство в RESPONSE §2); действует R-1.7 |
| **R-2.1 forced-command** | ✅ реализация заявлена и проверена на staging ×4 через wrapper; негативные тесты (id/чужой стек/`-ref`) → DENY, SHA совпал. Production-путь ещё не вызывался; приёмка там — на следующем разрешённом релизе |
| **R-2.3 ключи по окружениям** | 🟡 отдельные пары lovii-ci-deploy-{staging,production}, scope в wrapper, environment secrets ×8, repo-level secrets и старые 4 CI-ключа удалены. Required reviewers заблокированы планом (422); решение по альтернативе ожидается. Ещё 4 shell-доступа (2 интерактивных, 2 turokserials) — отдельное решение владельца |
| **R-2.2 прод-бэкап** | ✅ ЗАКРЫТ (C1): локальный ночной дамп + **off-site Яндекс.Диск** (rclone, выгрузка 03:47, retention 14), restore-тест 05.10 — sha256 off-site = локальному, pg_restore --list 113 TABLE DATA. Детали: canon/BACKUPS.md + R25/CLOSEOUT-2 |: ночной `pg_dump -Fc` прод-БД 03:47 UTC, retention 7 (`~/backups/prod-db/`), первый дамп снят. Off-site ⏳ ждёт bucket/ключ от владельца; restore-тест не заявлен |
| **R-2.4 pre-migrate dump** | ✅ логика в lovii-deploy заявлена; факт первого production-вызова ожидает следующего разрешённого релиза |
| **R-2.5 env-parity** | 🟡 `~/bin/env-parity-check.sh` + крон 05:07 UTC; первый прогон нашёл расхождения в admin-стеках. Baseline-классификация и отрицательный тест — на контрольной приёмке |
| R-3.2 (GHCR+откат) | ✅ ИСПОЛНЕНО: pull-деплой 15 сек, откат той же командой. Инцидент тегирования v1/v2 вылечен — маппинг строго по имени сервиса |
| R-3.4 (мок → staging-extras) | ✅ ИСПОЛНЕНО: прод-файл физически без мока, staging жив (health 200) |
| R-3.5 (супервизор+сводка) | ✅ ИСПОЛНЕНО: restart: unless-stopped у контейнерных раннеров (watchdog не нужен) + месячная сводка деплой-логов 1-го числа |
| R-3.1 (раннеры в контейнеры) | ✅ ИСПОЛНЕНО: 4 runner-контейнера + 4 dind (без docker.sock), полные прогоны ×4 на -c раннерах, host-раннеры offline, крон снят. Done-критерий: docker из CI видит только dind |
| R-3.3 (continue-on-error) | ✅ ИСПОЛНЕНО: снят ×3; 121 mixed в phpstan-baseline.neon; попутно выявлены (continue-on-error их маскировал!) и починены: отсутствие схемы lovii_admin в CI-БД, отсутствие pre-импорта core-schema, отсутствие CORE_API_URL/INTERNAL_ADMIN_SECRET в phpunit.xml (класс F-080) |
| R-2.5 (env-parity классификация) | ✅ ЗАКРЫТ: R25-ENV-PARITY-CLASSIFICATION-2026-10-05.md — 0 обязательных отсутствующих (все 11 опциональные с default, 4 умерших ключа удалены из .env.example), 2 намеренно различных (IMAGE_PREFIX/CORE_NETWORK = изоляция контуров), sentinel ДА, крон 05:07 |
| PlatformOrderSettings ×9 | ✅ подтверждено: 557 passed локально и в CI — старая информация, падения починены ранее |
| Релизный гейт admin | 🔒 tests/phpstan/type-coverage теперь БЛОКИРУЮТ деплой admin |
| R-0.1 / B-4 (gateway) | ⏳ root-сессия владельца |
| R-1.8 (REF_RE wrapper) | ⏳ root-файл; ОБОЛВАТ lovii-deploy'ем: REF_RE с запретом ведущего `-` уже в новом скрипте (regex `^[A-Za-z0-9]…`), старый gostiny-deploy остаётся для gostiny-стеков |


## 3. Проверки для аудита на SRV (deploy-доступ)

```bash
# A-1 закрыт: CI-ключ не даёт shell
ssh -i <staging_key> deploy@SRV 'id'           # → lovii-deploy: usage: … exit 2
ssh -i <staging_key> deploy@SRV 'deploy lovii-core <sha>'  # → вне scope
# авторизованные ключи (7): 2×lovii-deploy(restricted), gostiny-deploy(restricted),
# nikdm, admin@axiiom.ru, 2×turokserials (решение владельца — как есть)
cat ~/.ssh/authorized_keys
# деплой-трейл
tail ~/lovii-deploy.log
# бэкапы/парити
ls -la ~/backups/prod-db/; tail ~/backups/env-parity.log
crontab -l
```

## 4. Границы текущего состояния (честно)

- Прод ни разу не деплоился через новый путь (только staging ×4) — боевой
  прогон случится на следующем прод-релизе (только вручную).
- Off-site бэкапов нет — нужен bucket (write-only ключ) от владельца.
- Раннеры по-прежнему на прод-хосте (R-3.1, Волна 3).
- `gostiny-deploy` (root:root) не правлен — R-1.8 относится к нему;
  LOVII-деплой больше через него не ходит.

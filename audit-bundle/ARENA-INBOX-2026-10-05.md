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

## 2. Статус исполнения (вечер 05.10)

| Блок | Статус |
|---|---|
| Волна 1 (R-1.1…1.9) | ✅ исполнена ×4, живые деплои проверены (R-1.8 ⏳ root) |
| R-1.7b | ❌ неисполнима: required reviewers = платная защита, HTTP 422 (доказательство в RESPONSE §2); действует R-1.7 |
| **R-2.1 forced-command** | ✅ **ИСПОЛНЕНА**: `/home/deploy/bin/lovii-deploy` + authorized_keys `command=,restrict` ×2 ключа; heredoc'и ×8 удалены; негативные тесты (id/чужой стек/`-ref`) → DENY; позитивные — деплои ×4 через wrapper, SHA=запушенному |
| **R-2.3 ключи по окружениям** | ✅ отдельные пары lovii-ci-deploy-{staging,production}, scope в wrapper (staging-ключ физически не может деплоить прод и наоборот); environment secrets ×8; repo-level DEPLOY_SSH_KEY удалены ×4; **старые 4 неограниченных CI-ключа УДАЛЕНЫ из authorized_keys** (бэкап authorized_keys.bak-20261005-postwave2) |
| **R-2.2 прод-бэкап** | 🟡 локальная часть: ночной `pg_dump -Fc` прод-БД 03:47 UTC, retention 7 (`~/backups/prod-db/`), первый дамп снят. Off-site ⏳ ждёт bucket/ключ от владельца |
| **R-2.4 pre-migrate dump** | ✅ в lovii-deploy: на production перед миграциями, провал дампа = ABORT деплоя |
| **R-2.5 env-parity** | ✅ `~/bin/env-parity-check.sh` + крон 05:07 UTC; первый прогон уже нашёл расхождения ключей в admin-стеках (лог `~/backups/env-parity.log`) |
| R-0.1 / B-4 (gateway) | ⏳ root-сессия владельца |
| R-1.8 (REF_RE wrapper) | ⏳ root-файл; ОБОЛВАТ lovii-deploy'ем: REF_RE с запретом ведущего `-` уже в новом скрипте (regex `^[A-Za-z0-9]…`), старый gostiny-deploy остаётся для gostiny-стеков |
| Волна 3 (R-3.1…3.5) | ⏳ следующий «го» |

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

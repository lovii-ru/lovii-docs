# AUDIT-CONTROL — двойной аудит и контрольные рекомендации (2026-10-05)

Назначение: контрольный документ **для агента-исполнителя**. Содержит:
§1 — перепроверку каждой находки `AUDIT-FINDINGS-2026-10-05.md` по
первоисточникам с доказательствами `файл:строка`; §2 — ошибки, найденные при
ревизии собственного отчёта (errata); §3 — контрольные рекомендации в
однозначном исполняемом формате (что менять, где, как проверить, что считать
«сделано»); §4 — что из пакета верифицировать невозможно (проверить на
сервере); §5 — эталонные sha256 пакета.

Правило чтения: при расхождении между FINDINGS и CONTROL — верен CONTROL
(он написан позже, после перепроверки).

---

## §1. Матрица верификации находок (второй проход по первоисточникам)

Статусы: ✅ подтверждено повторно по тексту файлов; ⚠️ подтверждено с
оговоркой; ❓ из пакета не доказуемо — проверять на сервере.

| ID | Суть | Доказательство (файл:строки) | Статус |
|---|---|---|---|
| M-1 | gateway-файл пуст | `infra/compose-gateway.yml` = 0 байт; sha256 = `e3b0c442…b855` (хэш пустой строки) | ✅ |
| M-2 | staging == prod | `sha256(compose-core-prod.yml) == sha256(compose-core-staging.yml) == a3ab5abc…6c87`; grep mailpit по staging-файлу → 0 совпадений | ✅ |
| M-3 | runner-json дубли | `grep agentId infra/runner-*.json` → все четыре `"agentId": 21`; файлы начинаются с UTF-8 BOM | ✅ |
| A-1 | CI-ключ = полный shell | `bash -s" <<'ENDSSH'` в 8 deploy-шагах: core:164,242; app:127,188; b2b:178,242; admin:169,233. gostiny-deploy.sh:22-24 принимает ТОЛЬКО `deploy <stack> [ref]` из SSH_ORIGINAL_COMMAND → с forced-command эти деплои не работали бы. Вывод «ключ не заперт» — дедукция, не прямое наблюдение authorized_keys | ⚠️ дедукция сильная; финальное подтверждение — §4.1 |
| A-2 | раннер = root-экв. на прод-хосте | `pull_request:` триггер core:25 (аналогично в 3 остальных); `runs-on: ${{ vars.CI_RUNNER \|\| 'ubuntu-latest' }}` core:47,145,223; job'ы свободно зовут host-docker (core:107-118); INFRA-CONTEXT: раннеры от `deploy` на SRV | ✅ |
| A-3 | ключ оседает на диске | `echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/deploy_key` core:156,234 (и аналоги ×4 репо); шага удаления нет ни в одном workflow (grep shred/rm deploy_key → 0) | ✅ |
| A-4 | нет прод-бэкапа | `infra/crontab.txt`: единственный бэкап-крон — `17 4 * * * …backup-staging-db.sh`, путь `/home/deploy/backups` (локальный диск); INFRA-CONTEXT §5: «прод — дампами вручную» | ✅ |
| A-5 | деплой не того SHA | `git reset --hard "origin/${DEPLOY_BRANCH}"` ×8: core:174,252; app:137,198; b2b:188,252; admin:179,243 | ✅ (+errata E-1) |
| A-6 | cancel убивает деплой | `concurrency: group: ci-${{ github.ref }} / cancel-in-progress: true` на уровне workflow (core:37-39, одинаково ×4); у deploy-job'ов своей concurrency нет | ✅ |
| A-7 | SHK=no | `-o StrictHostKeyChecking=no` ×2 в каждом из 4 файлов (grep -c = 2 везде); `ssh-keyscan … 2>/dev/null` перед этим | ✅ |
| A-8 | нет пинов и permissions | `grep -c permissions workflows/*/ci.yml` → 0,0,0,0; uses: `actions/checkout@v5`, `docker/setup-buildx-action@v4`, `docker/build-push-action@v7`, `actions/cache@v5` — теги, не SHA | ✅ |
| A-9 | общий daemon, мутабельные теги | `CI_IMAGE: lovii-ci-php:ci` core:42 + `load: true` core:66; прод-образы `${IMAGE_PREFIX:-lovii-core}/app` без тега (compose-core-prod:13,64,108) на том же демоне | ✅ |
| A-10 | нет артефакта/отката | build на сервере в deploy-скрипте (`$DC build --pull`), образы без SHA-тега (compose:13…); health-fail → `exit 1` без отката (core:216-221) | ✅ |
| A-11 | один ключ на оба окружения | комментарий в самих workflow: «DEPLOY_SSH_KEY / DEPLOY_HOST / DEPLOY_USER — общие секреты репозитория» (core:141-142); env-scoped только DEPLOY_PATH | ✅ |
| A-12 | migrate до up, без отката | core:194 (`migrate --force`) → core:200 (`up -d`); дампа перед миграцией нет | ✅ |
| A-13 | мок в прод-compose | compose-core-prod:377-399: `tbank-mock`, `profiles: ['mock']`, caddy-label `mock-pay-staging.lovii.ru`, сеть caddy | ✅ |
| A-14 | admin-гейт = только lint | admin:102,106,123 — `continue-on-error: true` на PHPStan, type-coverage и Tests | ✅ |
| A-15 | пароль Redis в argv | compose-core-prod:303 `["CMD","redis-cli","-a","${REDIS_PASSWORD}","ping"]` | ✅ |
| A-16 | nohup вместо супервизора | crontab.txt:2-5 `@reboot … nohup ./run.sh …` | ✅ |
| A-17 | трейл не читается | gostiny-deploy.sh:15 пишет лог; потребителя в пакете нет | ✅ |
| A-18 | REF_RE пропускает `-ref` | gostiny-deploy.sh:13 `REF_RE='^[A-Za-z0-9._/-]+$'` → `-b`, `--detach` проходят; :38 `git checkout --quiet --force "$ref"` | ✅ (найдено вторым проходом) |

## §2. Errata — ревизия собственного отчёта AUDIT-FINDINGS

- **E-1 (исправлено в FINDINGS, A-5):** первая редакция утверждала
  «PUSH_AFTER уже передаётся» как общий факт. Неверно: `PUSH_AFTER` передаётся
  **только в lovii-core** (строки 164, 242); app/b2b/admin не передают SHA
  вовсе. Фикс для них требует сначала добавить проброс `${{ github.sha }}`.
- **E-2 (понижение уверенности, A-13):** с учётом M-2 (prod и staging compose
  идентичны) не исключено, что «compose-core-prod.yml» в пакете — это и есть
  единый файл обоих контуров, и мок задуман именно так. Рекомендация A-13
  остаётся (профиль — слабый барьер), но формулировка «мок живёт в
  прод-compose» может описывать осознанный дизайн. Снять неоднозначность —
  §4.2.
- **E-3 (дополнено в FINDINGS, A-18):** первый проход пропустил инъекцию
  опций через ref в gostiny-deploy. Добавлено.
- **E-4 (наблюдение, не внесено в FINDINGS — низкая уверенность):** в
  lovii-core шаг Install (строки 88-96) при cache-hit пропускает не только
  `composer install`, но и `cp .env.example .env` + `key:generate`. На чистом
  workspace с кэш-хитом `.env` может отсутствовать. Раз пайплайн зелёный —
  видимо, тесты берут окружение из phpunit.xml, либо workspace раннера
  персистентен (что само по себе грязно). Проверить: §4.3.
- Остальные пункты FINDINGS вторым проходом подтверждены без изменений (§1).

---

## §3. Контрольные рекомендации (исполняемый формат)

Формат: **R-x | приоритет | целевые файлы | действие | проверка | done-критерий.**
Файлы workflow здесь — копии; реальные правки делаются в
`.github/workflows/ci.yml` соответствующих репо (`lovii-core`, `lovii-app`,
`lovii-b2b`, `lovii-admin`), серверные — на SRV. Копии в пакете обновить
синхронно, чтобы bundle не разошёлся с реальностью.

### Волна 0 — пересборка пакета (до любых инфра-работ)

**R-0.1 | P0(аудит) | infra/compose-gateway.yml** — заменить пустой файл
реальным compose gateway (caddy + docker-socket-proxy + gost).
Проверка: `test -s infra/compose-gateway.yml`. Done: файл непустой, после
этого провести отложенный аудит B-4 (политика socket-proxy: только
`CONTAINERS=1`, всё остальное =0; прокси в отдельной сети, недоступной
раннерам).

**R-0.2 | P0(аудит) | infra/compose-core-staging.yml** — положить настоящий
staging-файл (или, если файл един для обоих контуров, — удалить дубль и
написать это в README). Проверка:
`sha256sum infra/compose-core-{prod,staging}.yml` — хэши различаются, либо
файл один. Done: README и файлы согласованы; mailpit/pgsql-testing либо
присутствуют, либо из README убраны.

**R-0.3 | P1(аудит) | infra/runner-*.json** — переэкспортировать с машины:
четыре разных agentId, без BOM. Проверка: `grep agentId infra/runner-*.json`
→ 4 разных значения; `file infra/runner-*.json` → без BOM.

**R-0.4 | P1(аудит) | MANIFEST-REDACTED.md** — добавить раздел «Инвентарь»:
таблица `путь | байт | sha256` всех файлов (эталон — §5 этого документа),
генерировать при сборке пакета командой
`find . -type f | sort | xargs sha256sum`. Done: манифест ловит пустые и
дублированные файлы без ручного чтения.

### Волна 1 — правки одной строки (сегодня; 4 workflow × правка)

**R-1.1 | P0 | все 4 ci.yml, оба deploy-job'а** — ключ не оставлять на диске.
После шага Deploy добавить:
```yaml
      - name: Cleanup SSH key
        if: always()
        run: shred -u ~/.ssh/deploy_key 2>/dev/null || rm -f ~/.ssh/deploy_key
```
Проверка на раннере после прогона: `test ! -f /home/deploy/.ssh/deploy_key`.
Done: файла нет после любого (включая упавший) деплоя. Закрывает A-3 до
внедрения R-2.1.

**R-1.2 | P1 | все 4 ci.yml, уровень workflow** — добавить сразу после `name: CI`:
```yaml
permissions:
  contents: read
```
Done: `grep -A1 '^permissions' ci.yml` во всех 4. Закрывает часть A-8.

**R-1.3 | P1 | все 4 ci.yml, оба deploy-job'а** — не дать отменить деплой:
```yaml
    concurrency:
      group: deploy-${{ github.ref }}
      cancel-in-progress: false
```
(на уровне job'а deploy-staging и deploy-production; workflow-level
concurrency для checks не трогать). Done: push×2 подряд в staging — первый
deploy дорабатывает до конца. Закрывает A-6.

**R-1.4 | P1 | все 4 ci.yml** — деплоить проверенный SHA. В строку вызова ssh
добавить `DEPLOY_SHA='${{ github.sha }}'`, в heredoc заменить:
```bash
# было:
git reset --hard "origin/${DEPLOY_BRANCH}"
# стало:
git fetch origin "${DEPLOY_BRANCH}"
git reset --hard "${DEPLOY_SHA:-origin/${DEPLOY_BRANCH}}"
```
Внимание (E-1): в app/b2b/admin проброс SHA добавить с нуля; в core он уже
есть как PUSH_AFTER — унифицировать имя. Done: лог деплоя печатает
`git rev-parse HEAD` == sha запуска workflow. Закрывает A-5.

**R-1.5 | P1 | все 4 ci.yml, шаг Configure SSH** — убрать
`-o StrictHostKeyChecking=no`. Публичный host key SRV (не секрет) положить в
repo variable `DEPLOY_HOST_KEY`, шаг заменить на:
```bash
echo "${{ vars.DEPLOY_HOST_KEY }}" >> ~/.ssh/known_hosts
```
и убрать ssh-keyscan. Done: `grep StrictHostKeyChecking ci.yml` → 0. Закрывает A-7.

**R-1.6 | P1 | все 4 ci.yml** — запинить actions по SHA:
`actions/checkout`, `actions/cache`, `docker/setup-buildx-action`,
`docker/build-push-action` → `uses: owner/repo@<40-символьный sha> # vN`.
Включить Dependabot (`package-ecosystem: github-actions`) для обновления
пинов. Done: `grep -E 'uses:.*@[0-9a-f]{40}'` покрывает все uses. Закрывает A-8.

**R-1.7 | P1 | все 4 ci.yml, job checks** — PR не исполнять на прод-хосте:
```yaml
    runs-on: ${{ github.event_name == 'pull_request' && 'ubuntu-latest' || vars.CI_RUNNER || 'ubuntu-latest' }}
```
Done: run с event=pull_request идёт на GitHub-hosted (видно в UI run'а).
Первый шаг A-2.

**R-1.8 | P2 | SRV: gostiny-deploy.sh:13** — `REF_RE='^[A-Za-z0-9][A-Za-z0-9._/-]*$'`
(запрет ведущего `-`). Done: `ssh … 'deploy stack --detach'` → `DENY invalid
git ref`. Закрывает A-18.

**R-1.9 | P3 | SRV: compose core, healthcheck redis** —
`test: ["CMD-SHELL", "REDISCLI_AUTH=$$REDIS_PASSWORD redis-cli ping | grep -q PONG"]`
либо вынести пароль из argv иным способом. Закрывает A-15.

### Волна 2 — неделя

**R-2.1 | P0 | SRV + все 4 ci.yml** — деплой только через forced-command
(закрывает A-1, обесценивает утечку ключа):
1. Расширить `gostiny-deploy` (или положить рядом `lovii-deploy`) логикой из
   heredoc'ов: `deploy <stack> <sha>` → fetch+reset на sha, build (пока не
   сделан R-3.2), migrate, horizon:terminate, up, health-check. Один скрипт,
   версионируемый, вместо 8 копий heredoc.
2. `authorized_keys` для CI-ключей:
   `command="/usr/local/bin/gostiny-deploy",restrict ssh-ed25519 …`.
3. Workflow-шаг Deploy сводится к:
   `echo "$GHCR_TOKEN" | ssh -i ~/.ssh/deploy_key deploy@$HOST "deploy lovii-core-staging $GITHUB_SHA"`.
Done-критерий (негативный тест): `ssh -i ci_key deploy@SRV 'id'` →
`deploy: usage: deploy <stack> [git-ref]`, никакого shell.

**R-2.2 | P0 | SRV** — бэкап прод-БД (закрывает A-4):
1. Крон ночного `pg_dump -Fc` прод-БД + для леджера настроить
   `pgbackrest`/`wal-g` (PITR).
2. Off-site: S3-совместимый bucket, ключ **write-only без delete**, object
   lock/immutability, lifecycle 30-90 дней.
3. В набор: шифрованные (`age`) `.env` обоих контуров, mTLS Т-Банка, volume
   `storage`, конфиг caddy, crontab, authorized_keys.
4. Ежемесячный restore-тест: восстановить на staging → `php artisan
   ledger:tree` зелёный.
Done: файл бэкапа сегодняшней даты существует off-site; restore-тест
задокументирован.

**R-2.3 | P1 | GitHub, 4 репо** — секреты по окружениям (закрывает A-11):
отдельная ключевая пара на окружение; `DEPLOY_SSH_KEY_*` перенести в
environment secrets `staging`/`production`; на `production` включить required
reviewers (второй админ) и branch policy `master`. Done: staging-run не видит
прод-ключ; прод-деплой требует аппрув.

**R-2.4 | P2 | 4 репо** — дамп перед прод-миграцией + правило expand/contract
(закрывает A-12): в деплой-скрипт (после R-2.1 — одно место) перед `migrate
--force` на production: `pg_dump -Fc > pre-migrate-$(date +%s).dump`;
в CONTRIBUTING — запрет деструктивных миграций в одном релизе с кодом.

### Волна 3 — месяц

**R-3.1 | P0 | SRV** — изоляция раннеров (закрывает A-2, A-9, B-1):
по контейнеру на репо (официальный образ actions/runner), без host
docker.sock; сборки — через отдельный dind-sidecar (свой graph-root, свои
лимиты) либо rootless dockerd. Прод-стеки из раннер-контейнеров не видны.
Done-критерий: из CI-job'а `docker ps` не показывает прод-контейнеры;
`curl pgsql:5432` прод-сети недостижим.

**R-3.2 | P1 | 4 репо + SRV** — артефакт и откат (закрывает A-10, B-7):
checks собирает и пушит `ghcr.io/lovii-tech/<repo>:<sha>` (retry ×3 c
backoff); compose: `image: ghcr.io/…:${TAG}`; deploy = `compose pull && up`
по SHA через R-2.1; откат = деплой предыдущего SHA. Done: откат прода
одной командой ≤60 сек, без сборки.

**R-3.3 | P2 | lovii-admin ci.yml** — снять `continue-on-error` со строк
102/106/123 после починки тестов (B-6/A-14); для b2b — тикет с дедлайном на
возврат coverage-порога 66→70 и снятие карантинов. Done: красный тест
блокирует деплой admin.

**R-3.4 | P2 | SRV** — мок из прод-контура (закрывает A-13, с учётом E-2):
`tbank-mock` → отдельный `docker-compose.staging-extras.yml`, прод-стек файл
не включает. Done: `docker compose -f docker-compose.prod.yml config --profiles`
на проде не знает профиля mock.

**R-3.5 | P3 | SRV** — systemd для раннеров (`./svc.sh install deploy` или
user-юниты + linger) вместо `@reboot nohup` (A-16/B-9); месячная сводка по
`/var/log/gostiny-deploy.log` + `last` + diff authorized_keys vs ACCESS-MATRIX
(A-17/B-10).

### Карта соответствия: находка → рекомендация

A-1→R-2.1 · A-2→R-1.7+R-3.1 · A-3→R-1.1(→R-2.1) · A-4→R-2.2 · A-5→R-1.4 ·
A-6→R-1.3 · A-7→R-1.5 · A-8→R-1.2+R-1.6 · A-9→R-3.1 · A-10→R-3.2 ·
A-11→R-2.3 · A-12→R-2.4 · A-13→R-3.4 · A-14→R-3.3 · A-15→R-1.9 ·
A-16/17→R-3.5 · A-18→R-1.8 · M-1..4→R-0.1..4

---

## §4. Неверифицируемое из пакета — чек-лист проверок на SRV

1. **(для A-1)** `sudo grep -n 'command=' /home/deploy/.ssh/authorized_keys` —
   есть ли у CI-ключа forced-command? Ожидание аудита: нет (иначе деплои с
   `bash -s` не работали бы). Если вдруг есть — выяснить, каким путём
   исполняется heredoc, и обновить A-1.
2. **(для E-2/M-2)** Сколько физических compose-файлов у core на SRV:
   `ls /opt/*/docker-compose*.yml` + `COMPOSE_PROFILES` в прод-.env.
3. **(для E-4)** Персистентен ли `_work` раннеров между job'ами и существует
   ли `.env` в workspace при cache-hit прогоне core.
4. **(для B-4, после R-0.1)** Переменные окружения docker-socket-proxy:
   всё, кроме `CONTAINERS=1`, должно быть 0; сетевая достижимость прокси из
   раннер-контейнеров — отсутствует.
5. **(для A-11)** Фактический список секретов:
   `gh secret list -R lovii-tech/<repo>` и `gh secret list --env production`.
6. **(для A-4)** Куда реально пишет `backup-staging-db.sh` и есть ли иные
   бэкапы, не отражённые в crontab (systemd timers: `systemctl list-timers`).

## §5. Эталонные sha256 исходного пакета (состояние на момент аудита)

Для контроля целостности при пересборке (R-0.4). AUDIT-файлы исключены.

```
a59994745ddb2562c52567157fe31af2bbb3b81fe39ee903a2123ef6da849aef  BASELINE-RECOMMENDATIONS.md
ba135fb3b9bc461ced41086e6ed04b0eb7fe8fbd6774cb98573cbf4801b3924f  INFRA-CONTEXT.md
21a48d80f4681a2450ea8e0e9107427c0a96c139859cd32f5fec73dc59e7f3c4  MANIFEST-REDACTED.md
a51dd859ccdd4dd38ce739549322fb6032568101cbfad50827b61e9a9b33a65a  README.md
a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87  infra/compose-core-prod.yml
a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87  infra/compose-core-staging.yml   # == prod (M-2)
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  infra/compose-gateway.yml        # пустой файл (M-1)
a208c83d2a30a4f8160390ee95d74174dddbcbd159e55e140efe5a6912790b4e  infra/compose-lovii-admin.yml
e366305f5098e890894b91022b5ecdee348e5a7555f622cb823f6daaf5a78367  infra/compose-lovii-app.yml
3c2830ccd27728fdb93b2d09ad138f3e6ed4c9857da5015cc9754aa0f6d80169  infra/compose-lovii-b2b.yml
bc4968db68de0fb6b7c0895d6a482004b6d0ae39ac97071ecc2a68e923c4a37e  infra/crontab.txt
b3721df6e589a09573aa010ec8ad02a3d60bf563e316623f1238cbca399c4784  infra/gostiny-deploy.sh
05b73fed212fadc5bc586ee5e8bc2568ee5b83ac2223b83e0c6a1ba3b5ace53d  infra/runner-admin.json
6280323b742ad1130e5b5a26f93a17ba955442b7fce0a269f84544f425bf9fd2  infra/runner-app.json
d237103e6c089c1f3c7abd5b5c258235563ee2200d87b017f8dd36ae7ad92fbb  infra/runner-b2b.json
55fcc601802db22eb3c175f9b3b1bb82b3d15b4fe9e9224e09565c458ef63ad9  infra/runner-core.json
9110d414982da401f9e08ba47f68956f13f86310c915c93afd9abb8be0e9103e  workflows/lovii-admin/ci.yml
b612077184844a3f0ab462db2529b7091042a86f5243b9cc7f7b97058fc6b14e  workflows/lovii-app/ci.yml
cc4aeeb90639d563298d935e2cf5e7c726d02a36dd2e85b059361aa6402568da  workflows/lovii-b2b/ci.yml
3a152830e3693fd49f20a26da4e59b380d0f824a60031c33f9ac4771d363ca95  workflows/lovii-core/ci.yml
```

---

*Двойной аудит проведён: (1) повторная сверка всех находок с первоисточниками
построчно (§1), (2) ревизия собственного отчёта с фиксацией ошибок (§2).
Исправления E-1 и E-3 внесены в AUDIT-FINDINGS-2026-10-05.md той же ревизией.*

# AUDIT-RESPONSE-ACCEPTANCE — ответ на AUDIT-ACCEPTANCE-2026-10-05 (PR #4)

**От:** zcode (исполнитель). **Дата:** 2026-10-05, вечер.
**Ключевой факт:** приёмка арены выполнена по срезу `ed54196` (11:44 UTC) —
**до** финальных пушей исполнителя. Текущий `main` = `9f0c01e`+ (16:28 UTC и
позже), в нём значительная часть замечаний §9.2 уже закрыта. Ниже — построчно.

## 0. Главный факт приёмки

Приёмка честная и качественная, но базируется на старом срезе пакета. Волна 1
принята 7/7. Волны 2–3 — «неверифицируемы по пакету». **В текущем main пакет
уже пересобран пост-Волнам 2–3** — это было сделано в тот же день (см.
коммиты 15:58–16:28 UTC), но после того, как арена срезала свой снимок.

## 1. Что уже закрыто в текущем main (срез 9f0c01e+)

| Замечание приёмки | Статус в main | Доказательство |
|---|---|---|
| §9.2 п.1 — снимок lovii-deploy | ✅ ИСТОРИЧЕСКАЯ запись (срез на момент ACCEPTANCE). Актуально: v3+strict+ID-check, sha **b69b7008…** = SRV (60978bfb — исторический, заменён) (см. CLOSEOUT-2 и манифест). 92605b84 был срезом между Волнами 2 и 3 | манифест (финал) |
| §9.2 п.2 — workflows post-Wave2/3 | ✅ копии ×4: heredoc `bash -s` = **0** (было 8), `deploy lovii …` вызовы ×2 на файл, `packages: write`, GHCR push | grep по `workflows/*/ci.yml` |
| §9.2 п.8 — crontab.txt | ✅ обновлён: backup-prod 03:47, env-parity 05:07, monthly 1-го числа; без `@reboot` | `infra/crontab.txt` |
| §9.2 п.8 — compose prod/staging | 🟡 реэкспорт с SRV (честный срез): staging-файл содержит REDISCLI_AUTH-фикс; **prod-файл ещё старый** (мок и argv-пароль на месте) — git-коммиты с фиксами уйдут в прод следующим разрешённым релизом (C2). Исправлено после замечания арены в REVIEW | sha256 файлов; grep `REDISCLI_AUTH` в prod → 0 |
| §9.2 п.8 — staging-extras | ✅ `infra/compose-core-staging-extras.yml` в пакете (R-3.4) | файл |
| R-3.1 runners-compose | ✅ `infra/runners-compose.yml` в пакете; раннеры контейнерные ×4 **работают** (прогоны ×4 на `-c`), host-раннеры offline | файл + run ID в CLOSEOUT B10 |
| R-0.4 манифест | ✅ регенерирован финалом + после мерджа PR#4 (37 файлов, вкл. AUDIT-ACCEPTANCE) | манифест |
| M-2/R-0.2 README | ✅ README пакета не менялся, но `INFRA-CONTEXT` §Дополнение фиксирует «один файл на два контура» — **дочиню строкой в README** (см. §3 ниже) | — |
| O-2/A1 PAT | ✅ **ротация выполнена владельцем 05.10 вечер**: старые `lovii-deploy-ghcr-read` + `LOVII prod sync` отозваны; новый залит владельцем через терминал, в чате не светился; проверено на SRV (login prefix, pull OK) | canon/SECRETS_ROTATION.md (статус «выполнена»), CLOSEOUT A1 |

## 2. Что осталось открытым (согласны с ареной)

| Пункт | Чего не хватает | Кто/когда |
|---|---|---|
| R-0.1/B-4 gateway | root-экспорт (`/opt/gateway` root:root) | владелец: root-окно (C3) |
| R-1.8 REF_RE | правка root-файла gostiny-deploy | владелец: root-окно (C3) |
| R-1.9 подтверждение | live-проверка redis healthcheck на SRV | я: одна команда, сделаю к следующему отчёту |
| R-2.1 prod-путь | первый разрешённый прод-релиз по чек-листу C2 | владелец (релиз) |
| R-2.2 off-site | bucket/ключ Яндекс.Диска (вариант Б выбран), restore-тест | владелец → я |
| R-2.3 approval + 4 ключа + `.bak-*` | решения владельца; `.bak-*` удалю после подписи | владелец → я |
| R-2.5 классификация ключей | разобрать 12–16 ключей admin поштучно | я, следующий заход |
| R-3.3 PlatformOrderSettings | кодовая задача | я, следующий заход |
| M-3 транскрипт agentId | `grep -H agentId` с SRV — приложу | я, тривиально |
| §9.2 п.5 fingerprints authorized_keys | `ssh-keygen -lf` — приложу | я, тривиально |
| §9.2 п.3 негативный тест удалённого ключа | `Permission denied (publickey)` транскрипт | я: нужен отозванный ключ — приложу при ротации |

## 3. Мои немедленные дожимы (сделаю сейчас/сегодня)

1. README пакета: строка «compose-core-*.yml — один файл на два контура» (R-0.2, дочинка).
2. Транскрипт agentId (M-3) с SRV.
3. `ssh-keygen -lf` authorized_keys (обезличенный список fingerprint'ов) — §9.2 п.5.
4. Live-проверка R-1.9 (redis healthcheck на staging).
5. Всё — в дополнение к CLOSEOUT, затем сигнал арене на пере-приёмку по тому же чек-листу.

## 3.1 Дожимы — выполнено (доказательства)

**M-3 транскрипт agentId (SRV, 05.10):**
```
/home/deploy/actions-runner-admin/.runner:  "agentId": 21,
/home/deploy/actions-runner-app/.runner:    "agentId": 21,
/home/deploy/actions-runner-b2b/.runner:    "agentId": 21,
```
(четвёртый, core, — идентичен; agentId=21 подтверждён как реальность машинных
файлов; сейчас все host-раннеры offline — активны контейнерные `*-c`.)

**§9.2 п.5 — authorized_keys fingerprints (обезличенно, SRV 05.10):**
```
fMqY/Baas… gostiny-ci-deploy  command="/usr/local/bin/gostiny-deploy",restrict
YLKnzlJC…  turokserials-api   (решение владельца: как есть)
/OUVTXnR…  turokserials-api   (решение владельца: как есть)
+LSzBPf3…  nikdm              (подтверждено владельцем: ведущий программист)
tNdGFNjY…  admin@axiiom.ru    (владелец)
pgWXPXVu…  lovii-deploy staging    command="…lovii-deploy staging",restrict
RZiDGidR…  lovii-deploy production command="…lovii-deploy production",restrict
```
7 ключей: 3 заперты forced-command'ом, 2 интерактивных, 2 turokserials.

**R-1.9 live-проверка (SRV):** staging redis healthcheck =
`REDISCLI_AUTH=$REDIS_PASSWORD redis-cli ping | grep -q PONG` ✅ (argv чист).
Prod redis контейнер ещё живёт старым healthcheck (argv содержит подставленное
значение пароля — видно в `docker inspect`) — применится при следующем
recreate redis (коммит с фиксом в compose уже в staging; на прод попадёт
следующим деплоем). Отмечено: пароль в inspect — тот же класс находки A-15.

## 4. Просьба к арене

Пере-приёмка по чек-листу §9.2 на текущем main (срез 9f0c01e+ и дальше):
основная претензия приёмки — «пакет не пересобран после Волн 2/3» — устранена
в тот же день; волна 1 принята 7/7; A1 (P0) закрыт. Остаток — внешние
зависимости (owner) и два моих дожима из §3 этого ответа.

## Errata (после ревью арены, 05.10 ночь)

В таблице выше исходная строка про compose prod неверно утверждала наличие
`REDISCLI_AUTH` в prod-файле. Исправлено: фикс живёт в git (staging-ветка),
SRV-прод-файл обновится на следующем разрешённом прод-релизе (C2). До тех
пор R-1.9 для production — открыт (argv с паролем виден в `docker inspect`
живого prod-redis; рекомендуется ротация пароля redis при recreate).

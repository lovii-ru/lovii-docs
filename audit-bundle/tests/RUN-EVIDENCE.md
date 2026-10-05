# Run evidence — прогоны на контейнерных раннерах (B10, Зам.6)

Снято `gh api repos/<repo>/actions/runs/<id>/jobs` + `gh run list` 05.10 UTC.
Каждая строка: repo | run_id | job → runner | conclusion | headSha.

lovii-core | 37324264536 | checks → gostiny-ci-core-c | success | 2c1128ca…
lovii-core | 37324264536 | deploy-staging → gostiny-ci-core-c | success | 2c1128ca…
lovii-app  | 37300496395 | checks → gostiny-ci-app-c | success | cc714ea…
lovii-app  | 37300496395 | deploy-staging → gostiny-ci-app-c | success | cc714ea…
lovii-b2b  | 37300500498 | checks → gostiny-ci-b2b-c | success | 151ec2a…
lovii-b2b  | 37300500498 | deploy-staging → gostiny-ci-b2b-c | success | 151ec2a…
lovii-admin| 37311758968 | checks → gostiny-ci-admin-c | success | 612fab4…
lovii-admin| 37311758968 | deploy-staging → gostiny-ci-admin-c | success | 612fab4…

Воспроизведение: `gh api repos/lovii-tech/<repo>/actions/runs/<id>/jobs
--jq '.jobs[] | "\(.name) runner=\(.runner_name) \(.conclusion)"'`
(нужен доступ к приватным репо lovii-tech; из песочницы аудитора — 404,
что подтверждает границу доступа, отмеченную в ACCEPTANCE §1).

## Negative test: изоляция сетей (Зам.5 ревью, SRV 05.10)

Из `gostiny-runner-core` (тот же netns, что у job):
```
runner-core → dind-app:   NXDOMAIN
runner-core → dind-b2b:   NXDOMAIN
runner-core → dind-admin: NXDOMAIN
runner-core → dind-core:  REACHABLE (свой dind)
TCP dind-app:2376 → CLOSED; docker --host tcp://dind-app:2376 ps → lookup fail
```
Сети: lovii-ci-{core,app,b2b,admin}, пары runner↔свой dind; прод-сети недостижимы.

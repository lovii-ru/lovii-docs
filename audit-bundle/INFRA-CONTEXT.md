# INFRA-CONTEXT — топология и модель угроз (для аудирующей модели)

## Железо и стенды

Один сервер (назовём SRV) держит **всё**: прод LOVII, staging LOVII, 4
self-hosted GitHub Actions раннера, gateway (caddy), личный сторонний проект
разработчика (turokserials-api — решение владельца, оставлен). OS Linux,
docker compose, один безпарольный пользователь `deploy` (SSH только по
ключам), root напрямую. БД — Postgres+PostGIS в контейнерах, деньги —
Т-Банк (эквайринг + e2c-выплаты + T-API через mTLS-сертификаты, лежащие на
SRV).

## Релизный путь

- `staging`: push в ветку `staging` → workflow (tests полностью + type-coverage
  в один проход, install скип при кэш-хите) → job `deploy-staging`: SSH на SRV
  (ключ из GitHub Secrets) → `git reset --hard origin/staging` →
  `docker compose -f docker-compose.prod.yml up -d` + миграции + health-check.
- `production`: ТОЛЬКО вручную `gh workflow run ci.yml --ref master` →
  `deploy-production` (тот же механизм).
- Раннеры: 4 процесса `actions-runner` в `/home/deploy/actions-runner-*`,
  автостарт через crontab `@reboot`. `CI_RUNNER=self-hosted` в variables репо.
- Docker build: rebuild образа только при изменении `docker/` или locks;
  app-образ нельзя скипать (бандл запечён).

## Границы доверия (сознательные компромиссы владельца)

1. Раннеры на прод-хосте: экономика минут GitHub (исчерпан биллинг) против
   изоляции. **Пуш в репо = исполнение кода на SRV.**
2. Личный проект разработчика co-located с продом банка (временно, решение
   владельца).
3. Staging = копия прод-данных, но без боевых секретов (вычищено 05.10):
   мок-банк, dev-OTP.
4. GitHub org: 2 участника (владелец + ведущий программист, оба admin).

## Финансовые инварианты

- Выплаты — только ручное действие владельца (`payouts:execute`,
  `payouts:push-daily` — операторские команды, в кроне отсутствуют).
- Приём денег от населения не открыт (54-ФЗ не закрыт).
- Леджер: Σ всех ног = 0, проверяется `ledger:tree`.

## Вопросы, которые особенно интересуют владельца

1. Можно ли безопасно изолировать раннеры, не теряя деплой-механику?
2. Как разделить права deploy на прод/staging стеки?
3. Достаточна ли текущая схема секретов (GitHub Secrets + .env на сервере)?
4. Риски docker-socket-proxy у gateway и docker.sock у раннеров.
5. Бэкапы: сейчас один крон staging-БД 04:17 на тот же диск — чего не хватает?
6. Идемпотентность/откат деплоя (сейчас `git reset --hard` + compose up).

## Дополнение 05.10 (после волны 1)

- `compose-core-prod.yml` и `compose-core-staging.yml` на сервере — ОДИН И ТОТ ЖЕ
  файл (md5 совпадает, дизайн осознанный): мок-банк включается профилем
  `COMPOSE_PROFILES=mock` в staging-.env, в прод-.env профиля нет. Раньше пакет
  ошибочно показывал их как разные (M-2 арены — гипотеза E-2 подтверждена).
- `compose-gateway.yml` в пакете отсутствует осознанно: /opt/gateway — root:root,
  пользователь deploy его не читает (экспорт требует root-сессии).
- runner-*.json: agentId=21 во всех четырёх — реальное состояние машинных
  файлов (не артефакт экспорта), перепроверено на SRV 05.10.
- Workflows обновлены до состояния после Волны 1: shred deploy_key,
  permissions: contents: read, deploy-concurrency без cancel, деплой на
  проверенный DEPLOY_SHA, known_hosts из vars (StrictHostKeyChecking=yes),
  actions запинены по SHA, pull_request уходит на ubuntu-latest.

## Снимок после Волны 3 (05.10, вечер)

- workflows ×4 = после Волн 1–3 (push образов в GHCR, deploy через
  forced-command `deploy <stack> <sha>`, known_hosts из vars).
- infra/lovii-deploy.sh = каноничный деплой-скрипт (копия ~/bin/lovii-deploy
  SRV; версия с A4-предохранителями: allowlist источника/таргета,
  ABORT-проверка image-ID до up).
- infra/runners-compose.yml = 4 runner-контейнера + 4 dind, сеть
  lovii-ci-isolated; токены регистрации в env контейнеров (одноразовые,
  протухшие) — значения в пакете не секреты, но рекомендуются к чистке.
- infra/compose-core-staging-extras.yml = мок вынесен из prod-файла (R-3.4).
- infra/crontab.txt = после Волн 2–3 (прод-бэкап, env-parity, месячная
  сводка; @reboot раннеров и watchdog удалены).
- GHCR read: классический PAT (read:packages) владельца, персистентный
  docker login на SRV; ротация — см. canon/SECRETS_ROTATION.md и A1 follow-up.

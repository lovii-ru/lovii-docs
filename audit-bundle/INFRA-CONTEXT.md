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

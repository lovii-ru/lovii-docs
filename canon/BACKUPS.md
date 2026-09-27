# Бэкапы БД стейджинга (с 27.09.2026)

> Ежедневный автоматический бэкап живой базы стенда. До 27.09 бэкапов НЕ было —
> инцидент 26.09 (снос живой базы тестами) был закрыт CSV-снапшотом локальной БД,
> серверный staging ничем не прикрыт не был.

## Что и где

- **База:** Postgres-контейнер `lovii-core-staging-pgsql-1`, БД `lovii-core`
  (~1,5 ГБ; схемы `public` = core, `lovii_b2b`, `lovii_admin` — один дамп покрывает всё).
- **Куда:** сервер gostiny-prod-01, `deploy@…:~/backups/lovii-core-staging_YYYY-MM-DD_HHMM.dump.gz`
  (~200 МБ каждый).
- **Когда:** ежедневно 04:17 по cron deploy (`crontab -l`, строка
  `17 4 * * * /home/deploy/backups/backup-staging-db.sh`). Ротация — последние 14.
- **Скрипт:** `~/backups/backup-staging-db.sh` (стрим `pg_dump -Fc` на хост;
  в контейнерный /tmp писать НЕЛЬЗЯ — там tmpfs 128M, ловушка «No space left»).
- **Лог:** `~/backups/backup.log` — после каждого прогона строка с размером.

## Проверить / снять вручную

```sh
ssh deploy@89.19.223.16 'ls -lht ~/backups/ | head -5; tail -3 ~/backups/backup.log'
ssh deploy@89.19.223.16 '~/backups/backup-staging-db.sh'   # внеплановый бэкап прямо сейчас
```

## Восстановление (на тот же staging)

⚠️ Восстановление ЗАТИРАЕТ текущую базу стенда — сначала снять свежий дамп «как есть».

```sh
ssh deploy@89.19.223.16
# 1) свежий дамп текущего состояния (см. выше)
# 2) погасить писателей (app/horizon/scheduler), чтобы не писали в базу:
docker stop lovii-core-staging-app-1 lovii-core-staging-horizon-1 \
  lovii-core-staging-scheduler-1 lovii-b2b-staging-app-1 lovii-admin-staging-app-1
# 3) пересоздать схему и залить дамп:
gunzip -c ~/backups/lovii-core-staging_YYYY-MM-DD_HHMM.dump.gz | \
  docker exec -i lovii-core-staging-pgsql-1 pg_restore -U lovii-core -d lovii-core \
  --clean --if-exists --no-owner
# 4) поднять писателей:
docker start lovii-core-staging-app-1 lovii-core-staging-horizon-1 \
  lovii-core-staging-scheduler-1 lovii-b2b-staging-app-1 lovii-admin-staging-app-1
# 5) health: curl -s https://api-staging.lovii.ru/healthz
```

Первый бэкап: 2026-09-27 20:25 (202 МБ, валидность проверена `pg_restore --list`).
Прода это не касается (там своя чистая БД со справочниками) — бэкапится только staging.

# Audit bundle — самодостаточный пакет CI/CD LOVII для внешнего аудита

Собран 2026-10-05. Назначение: отдать контекст self-hosted CI/CD платформы
LOVII внешним моделям/агентам для независимого ревью. **Пакет санитизирован** —
см. `MANIFEST-REDACTED.md`. Отправлять сторонним сервисам можно только этот
пакет, не файлы с сервера напрямую.

## Состав

| Путь | Что это |
|---|---|
| `workflows/<repo>/ci.yml` | GitHub Actions workflows всех 4 боевых репо (core, app, b2b, admin) |
| `infra/gostiny-deploy.sh` | Forced-command SSH deploy-wrapper на сервере (прод+staging) |
| `infra/compose-core-prod.yml` | прод-стек ядра (app/horizon/scheduler/pollers/pgsql/redis/meili/tlsclient) |
| `infra/compose-core-staging.yml` | staging-стек ядра (+ tbank-mock, mailpit, pgsql-testing) |
| `infra/compose-gateway.yml` | единая точка входа (caddy + docker-socket-proxy + gost) |
| `infra/compose-lovii-{app,b2b,admin}.yml` | прод-стеки остальных репо |
| `infra/runner-*.json` | конфиги 4 self-hosted раннеров (идентификаторы, без токенов) |
| `infra/crontab.txt` | cron пользователя deploy (раннеры, бэкап) |
| `BASELINE-RECOMMENDATIONS.md` | стартовый список улучшений от внутреннего агента — аудиторы спорят с ним |
| `INFRA-CONTEXT.md` | контекст: топология сервера, доступы, границы доверия |

## Инструкция для аудирующей модели

1. Читай INFRA-CONTEXT.md первым — там топология и модель угроз.
2. Затем workflows + gostiny-deploy + compose.
3. Оцени: изоляцию раннеров, границы доверия (push→prod), секретный менеджмент,
   идемпотентность/безопасность деплоя, docker-socket, сеть, бэкапы.
4. Выход: список находок с приоритетами (P0/P1/P2), каждая — с обоснованием
   и конкретным фиксом. Спорить с BASELINE-RECOMMENDATIONS.md можно и нужно.

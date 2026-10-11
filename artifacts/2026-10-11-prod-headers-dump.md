# Дамп прод/staging-заголовков app — для арены (проверка AUD-01/AUD-02)

> Дата: 2026-10-11 · Снято снаружи (curl -sI), без SSH. Приложение к аудиту
> lovii-app `arena/99b6a5c8-lovii-app` (база master @ 1007269).
> Локальный конфиг: `lovii-app/docker/nginx/default.conf` (тот же срез).

## Вывод

- **AUD-02 подтверждён на проде**: из 5 серверных заголовков (строки 45–49
  default.conf) до браузера не доходит ни один, кроме `X-Content-Type-Options`
  на HTML — и то потому, что в `.html`-локации есть собственный `add_header`
  (строка 78). `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`,
  `Permissions-Policy` — **отсутствуют везде** (/, /version.json, статика).
- **AUD-01 на проде сейчас латентный**: `Permissions-Policy` не доходит,
  значит geolocation НЕ заблокирована. Опасность в последовательности починки:
  если исправить только наследование (сниппет), но оставить
  `geolocation=()` — гео на проде сломается сразу после деплоя. Чинить
  только парой: сниппет + `geolocation=(self)` (О-1 целиком).

## Дампы (2026-10-11)

### https://app.lovii.ru/ (прод)

```
HTTP/2 200
cache-control: public, max-age=60, must-revalidate
x-content-type-options: nosniff
```
(из запрошенных permissions-policy / x-frame-options / x-xss-protection /
referrer-policy / content-security-policy — не пришло ничего, кроме
x-content-type-options)

### https://app.lovii.ru/version.json (прод)

```
HTTP/2 200
cache-control: no-store
```
(заголовков безопасности нет)

### https://app-staging.lovii.ru/ (staging)

```
HTTP/2 200
cache-control: public, max-age=60, must-revalidate
x-content-type-options: nosniff
```
(картина идентична проду — тот же дефект наследования)

## Про Caddy-слой

Caddy на серверах — label-driven (плагин docker-proxy): маршруты задаются
лейблами `caddy:*` в compose-файлах репо, глобального Caddyfile в репо нет.
Заголовки app отдаются контейнером nginx (app.lovii.ru → контейнер напрямую,
без серверных rewrite-слоев Ansible). Для аудита «что реально доходит до
браузера» дампы выше — первоисточник.

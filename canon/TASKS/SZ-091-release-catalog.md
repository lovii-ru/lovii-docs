# SZ-091 — Каталог релизов статики lovii-app

> Источник: прод-инцидент SZ-090 (2026-10-07) и его рецидив (2026-10-08,
> session-док lovii-app/docs/sessions/151-sz090-chunk-recovery-relapse.md).
> «Го» владельца: 08.10 (workspace/status.md). Статус: **реализована, В
> STAGING (83bc58d+5ad877a, приёмка пройдена)**; прод — после явного «го».

## Проблема (аудит деплой-цепочки, 08.10)

Деплой lovii-app перезаписывает статику атомарно-целиком, и у пользователя с
открытой вкладкой/установленным PWA в браузере живёт **старый index.html**,
который ссылается на чанки с хэшами прошлого релиза. После деплоя этих чанков
на сервере нет → 404 → навигация умирает. Весь комплекс самолечения SZ-090
(бут-гейт, version-gate, chunk-recovery, /recover.html) — компенсирующая
механика поверх этой гонки; для клиентов с «застрявшим» состоянием она
тупиковая (доказано 08.10: цикл reload у Safari-клиента 31.134.188.143,
тосты у коллег в Chrome и Safari).

Цепочка (факты, file:line):
- CI: `.github/workflows/ci.yml` — `docker build --target prod`, образ
  `ghcr.io/lovii-tech/lovii-app:<sha>` с запечённым `dist/`; деплой
  `ssh deploy@… "deploy lovii-app[-staging] <sha>"`.
- Сервер: `~/bin/lovii-deploy` — `git reset --hard <sha>` в `/opt/lovii-app*`,
  pull образа по sha, `docker compose -f docker-compose.prod.yml up -d`.
- nginx: `lovii-app/docker/nginx/default.conf` — `root /usr/share/nginx/html`,
  ассеты `expires 365d immutable`, html `max-age=60 must-revalidate`.

## Цель

Сделать деплой неразрушающим для старых клиентов: чанки **предыдущих**
релизов продолжают отдаваться 200 в течение окна обновления.

## Решение (рекомендация; развилки — ниже)

Каталог релизов на хосте: `/opt/lovii-app{,-staging}/releases/<sha>/` с
симлинком `current`; nginx root смотрит в `current/`; хвост — 2–3 релиза.
Образ перестаёт быть носителем статики: деплой раскладывает `dist/` в
`releases/<sha>/` (образ остаётся носителем nginx-конфига), либо dist
выгружается из образа в volume при старте.

### Развилки — РЕШЕНО владельцем 08.10: вариант 1
1. **Volume + симлинк — ВЫБРАН**: образ кладёт dist в
   `/srv/dist`, compose монтирует shared volume, entrypoint деплоя
   копирует в `releases/<sha>` и переставляет `current`. Минус: логика в
   entrypoint.
2. ~~CI раскладывает по SSH~~ — отклонено (dist выпадает из образа).
3. ~~Multi-release контейнеры за Caddy~~ — отклонено (тяжёлая оркестрация).

## Реализация (08.10, ветка feat/sz091-release-catalog)

- `docker/nginx/10-release-sync.sh` — entrypoint nginx: immutable-копия dist
  в `/srv/www/releases/<версия>/` (из image ENV APP_VERSION), union-каталог
  на жёстких ссылках (новейший релиз + отсутствующие в нём файлы старых),
  симлинк `current`, хвост KEEP_RELEASES=3. Поймано на приёмке: старый чанк
  404-ился, т.к. nginx смотрел только в current — union решает это.
- compose: named volume `app-releases:/srv/www`; NB: APP_VERSION в
  `environment:` НЕ задавать — деплой pull-ит образ, пустая интерполяция
  затирала версионное имя fallback'ом «dev» (поймано на staging).
- SZ-092 попутно: runtimeCaching опустошён (kuper-балласт + api-cache).
- Гейт 1066/1066 🟢; staging: releases/union/current живы (292 файла),
  version.json = staging·5ad877a.

## Критерий приёмки

1. Сразу после деплоя все чанки **предыдущего** релиза отвечают 200
   (проверка скриптом: старый index.html → все его assets 200).
2. Застрявший клиент (старый HTML в кэше) доживает до естественного
   обновления без 404 и без тостов chunk-recovery.
3. Откат = перестановка симлинка `current` на прошлый sha (задокументирован
   в deploy.md).
4. Гейт lovii-app 🟢; деплои staging+prod по канону (прод — вручную).
5. Оффлайн-PWA не деградирует (прекэш SZ-055 не тронут).

## Что нужно от владельца

- ~~Выбор развилки~~ — выбран вариант 1 (08.10).
- Глубина хвоста: по умолчанию 3 релиза / 14 дней — возразить до реализации.

## Источники решений

- Прод-инцидент 07.10: `artifacts/2026-10-07-pwa-stale-shell` +
  `lovii-pwa-stale-shell-incident` (память), SZ-090 в каноне.
- Рецидив 08.10: session 151 lovii-app; nginx access_log для /assets/
  включён 08.10 (PR #22) — телеметрия для приёмки готова.
- Аварийка: `/recover.html` (PR #21) — остаётся как последний рубеж.
- Прецедент класса проблемы: F-075 («деплой со старым кодом»), F-052b.

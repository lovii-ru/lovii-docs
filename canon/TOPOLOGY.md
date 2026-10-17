# Топология платформы «Лови» — как всё связано

> Живая схема текущего состояния (актуализирована ночью 18.10.2026 после сетевого
> инцидента). Рисована в Mermaid — GitHub рендерит прямо здесь. Служит входной
> точкой для вопросов «а что откуда зависит»; детальные каноны — по ссылкам.

## 1. Общая инфраструктура: три машины + GitHub

```mermaid
flowchart TB
    subgraph HOME["🏠 Домашняя сеть (Amplifi, 192.168.180.x)"]
        MAC["💻 Mac владельца<br/>SSH-ключи: root@prod, lovii@chuwi<br/>здесь же агенты (zcode, арена)"]
        CHUWI["🖥 CHUWI «gostiny-bild» (N100, 192.168.180.156/.239)<br/>· сборочный Actions-раннер «gostiny-build»<br/>· мониторинг-хаб: Prometheus :9090, Grafana :3002, Alertmanager :9093<br/>· Uptime Kuma :3001 (внешние проверки)<br/>· бэкап-пул (3-й носитель)"]
        MAC <-->|домашняя LAN| CHUWI
    end

    subgraph PROD["🟢 Прод-сервер gostiny-prod-01 (89.19.223.16 / .31) — ОДИН сервер"]
        direction TB
        subgraph LIVE["Прод-стенды"]
            CORE_P["lovii-core (API) ← nginx :80/:443"]
            B2B_P["lovii-b2b :8002"]
            ADM_P["lovii-admin :8001"]
            APP_P["lovii-app (статика/PWA)"]
        end
        subgraph STAG["Staging-стенды (суффикс -staging)"]
            CORE_S["lovii-core-staging"]
            B2B_S["lovii-b2b-staging"]
            ADM_S["lovii-admin-staging"]
            APP_S["lovii-app-staging"]
        end
        RUNNERS["Actions-раннеры gostiny-runner-*<br/>⚠️ ОСТАНОВЛЕНЫ 18.10 — CI уехал на CHUWI"]
        TG["TG-поллер OTP ⚠️ остановлен 18.10 (DPI режет Telegram)"]
    end

    subgraph GH["🐙 GitHub (org lovii-tech)"]
        REPOS["lovii-core / app / b2b / admin<br/>+ lovii_docs (хаб доков)"]
        ACTIONS["GitHub Actions CI/CD"]
        GHCR["ghcr.io — реестр образов"]
    end

    OWNER(["👤 Владелец"])

    OWNER --> MAC
    MAC -->|"git push / gh"| REPOS
    REPOS --> ACTIONS
    CHUWI -->|"runner берёт джобы<br/>(единственный self-hosted онлайн)"| ACTIONS
    CHUWI -->|"деплой-джобы: SSH + деплой-скрипт"| PROD
    CHUWI -->|"мониторинг: SSH-туннель mon-tunnel → exporters (localhost)"| PROD
    ACTIONS -->|"пуш образов"| GHCR
    CHUWI -->|"pull образов из ghcr"| GHCR
    PROD -->|"pull образов при деплое"| GHCR
    PROD -->|"продажи: покупатели (входящий — работает штатно)"| USERS(["🛒 Покупатели / МСП"])
```

**Ключевой факт сети:** прод и staging — один физический сервер; различие только в
суффиксах контейнеров и портах. CHUWI — единственный активный CI-раннер с ночи
18.10 (после DPI-инцидента на транзите хостера).

## 2. Путь релиза (CI/CD) — как код доезжает до прода

```mermaid
flowchart LR
    DEV["Агент / владелец"] -->|"фича-ветка + локальный гейт<br/>(tools/core-tests.sh и т.п.)"| BR["Ветка в lovii-tech/*"]
    BR -->|"PR"| STG["Ветка staging"]
    STG -->|"merge / push"| CI["GitHub Actions → джобы на лейбле self-hosted<br/>(сейчас это CHUWI «gostiny-build»)"]
    CI -->|"1. checks: lint + phpstan + тесты"| CI
    CI -->|"2. build & push образов"| GHCR["ghcr.io"]
    CI -->|"3. deploy-staging: SSH → /opt/*-staging"| STAND["Staging-стенды"]
    STAND -->|"приёмка владельцем"| M["PR staging → master"]
    M -->|"merge"| MASTER["master"]
    MASTER -->|"⚠️ прод — ТОЛЬКО вручную:<br/>gh workflow run ci.yml --ref master"| CIP["CI на CHUWI"]
    CIP -->|"deploy-production: SSH → /opt/*<br/>деплой-скрипт пишет lovii-deploy.log"| PRODLIVE["Прод-стенды"]
```

Замечания к текущему состоянию:
- джобы «Build & push» и «deploy» физически исполняет CHUWI (прод-раннеры остановлены);
  деплой-скрипт на сервере валидирует SHA и пишет в `/home/deploy/lovii-deploy.log`;
- локальный гейт перед пушем обязателен (канон `ПРОТОКОЛ-ЛОКАЛЬНОГО-СТЕНДА.md`);
- сборка образов **не зависит от pecl.php.net** с 18.10 (PR #27: phpredis/xdebug
  собираются с GitHub, opcache уже вкомпилен в PHP 8.5).

## 3. Компоненты и кто с кем говорит

```mermaid
flowchart TB
    APP["📱 lovii-app<br/>(Vue3, витрина покупателя)"] -->|"только core API"| CORE["⚙️ lovii-core<br/>(Laravel, единственный владелец<br/>commerce-таблиц и денег)"]
    B2B["🏪 lovii-b2b<br/>(кабинет партнёров/точек,<br/>схема lovii_b2b)"] --> CORE
    ADM["🛡 lovii-admin<br/>(супер-админка, Shield RBAC,<br/>схема lovii_admin)"] --> CORE

    CORE --> PG[("PostgreSQL + PostGIS")]
    CORE --> REDIS[("Redis")]
    CORE --> MEILI["Meilisearch (поиск)"]
    CORE --> HOR["Horizon (очереди)"]
    B2B -->|"свой Redis/очереди"| REDIS

    subgraph OUT["Внешние интеграции (исходящие с прода)"]
        TB["Т-Банк API<br/>(платежи-моки, выписка,<br/>номинальные счёта)"]
        MAXB["MAX Bot API<br/>(OTP, боты «Лови»)"]
        TGB["Telegram Bot API<br/>(OTP) ⚠️ DPI-блок у хостера"]
        VK["VK (вход через релей)"]
        FERMA["Ferma (54-ФЗ чеки, kassa-mock)"]
        YANDEX["Яндекс Геокодер"]
    end
    CORE --> TB
    CORE --> MAXB
    CORE -.->|"выключен 18.10"| TGB
    CORE --> VK
    CORE --> FERMA
    CORE --> YANDEX

    MON["📊 Prometheus-хаб (CHUWI)"] -->|"SSH-туннель,<br/>экспортеры только localhost"| PRODNODE[("прод-сервер")]
    KUMA["Uptime Kuma (CHUWI)"] -->|"внешние HTTP-проверки"| PRODNODE
```

Правило архитектуры: app/b2b/admin **никогда не ходят в БД напрямую мимо core** —
все commerce-данные и деньги принадлежат core.

## 4. Сеть: что где работает после DPI-инцидента 17.10

```mermaid
flowchart LR
    subgraph DEST["Внешние направления"]
        BUNNY["Bunny-CDN<br/>(pecl.php.net, repo.packagist.org)"]
        TG["api.telegram.org"]
        GHNET["github.com / ghcr.io / api.github.com"]
        ALPINE["dl-cdn.alpinelinux.org"]
    end
    subgraph VANTAGE["Откуда смотрим"]
        PRODNET["прод-сервер<br/>(транзит хостера)"]
        HOMENET["дом (Mac, CHUWI)"]
    end
    PRODNET -->|"TCP:443 заблокирован DPI<br/>(ICMP при этом ходит)"| BUNNY
    PRODNET -->|"заблокирован → TG off"| TG
    PRODNET -.->|"флапает, окна по минутам"| GHNET
    HOMENET -->|"🚫 блок и здесь — блок уровня РФ"| BUNNY
    HOMENET -->|"✅ работает"| TG
    HOMENET -->|"✅ работает"| GHNET
```

Следствия (уже сделано):
- сборка отвязана от pecl — блок Bunny больше не роняет релизы;
- CI исполняется на CHUWI (дом), у которого ghcr и GitHub стабильны;
- Telegram на проде выключен владельцем (не обязателен; MAX/VK живы).

## 5. Мониторинг и бэкапы

```mermaid
flowchart LR
    EXP["exporters на проде<br/>(слушают localhost)"] -->|"SSH-туннель mon-tunnel"| PROM["Prometheus (CHUWI)"]
    PROM --> GRAF["Grafana :3002 (CHUWI)<br/>дашборд «Стенды — обзор»"]
    PROM --> AM["Alertmanager :9093<br/>(канал уведомлений пока не подключён)"]
    KUMA["Uptime Kuma :3001 (CHUWI)"] -->|"HTTP-пробы"| STANDS["стенды прод+staging"]
    SRV["прод-сервер"] -->|"бэкап-пул 08:25"| BK[("/opt/backups на CHUWI<br/>— третий носитель")]
```

- Grafana: `grafana.lan:3002` (учётка lovii), Prometheus: `prom.lan:9090`;
- алерты описаны, канал доставки не подключён — Kuma пока сторож;
- чистка диска прода — при заполнении >75% (сейчас ~55%).

## 6. Открытые развилки / хвосты (на момент 18.10)

| # | Вопрос | Кто решает |
|---|---|---|
| 1 | CI остаётся на CHUWI постоянно или вернуть прод-раннеры после починки транзита? | владелец |
| 2 | Тикет хостеру про DPI (Telegram + ghcr) — пруфы собраны | владелец («го») |
| 3 | TG-поллер прода вернётся при следующем деплое — выключить флагом env? | владелец («го») |
| 4 | Обновить канон CI_RUNNERS_SELFHOSTED.md (деплой теперь не на прод-раннерах) | куратор доков |
| 5 | b2b-queue рестартится каждые ~20 мин с exit=0 — проверить, штат ли это | разобрать |

Связанные каноны: `ARCHITECTURE.md`, `CHUWI_BUILD_STATION.md`,
`CI_RUNNERS_SELFHOSTED.md`, `PROD-SERVER-AND-MONITORING.md` (в воркспейсе),
`ПРОТОКОЛ-ЛОКАЛЬНОГО-СТЕНДА.md` (в воркспейсе).

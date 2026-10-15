# RES-017 — Мониторинг инфраструктуры; оповещения в мессенджеры временно отключены (2026-10-15)

> Запрос владельца (15.10.2026, ~21:00 МСК): «у нас есть настройка мониторинга за
> всей инфраструктурой — найди; попробуем временно отключить оповещения на мои
> мессенджеры». Исполнитель: AutoCoder. Статус: выполнено (временно, обратимо).

## 1. Где живёт мониторинг (найдено)

**Хаб — CHUWI (`gostiny-bild`, 192.168.180.156), каталог `~/monitoring/`:**

| Компонент | Порт | Что |
|---|---|---|
| Uptime Kuma v2.5.6 | :3001 | 9 мониторов: прод (app/api/admin/b2b), staging (app/api), бэкапы (push), dev-стенд (app/api) |
| Prometheus | :9090 | скрейп node/cadvisor (CHUWI + прод по туннелю), экспортеры lovii-cicd (pipeline/agents) |
| Alertmanager | :9093 | receiver `tg-lovii` → Telegram (бот-токен в `alertmanager/telegram.token`) |
| Grafana | :3002 | дашборды; alerting не сконфигурирован (contact points — только заглушка email, правил нет) |
| node_exporter / cadvisor | :9100 / :8083 | тут и на проде (`/opt/monitoring`, только экспортеры, без нотификаций) |

Метрики прода идут по SSH-туннелю `mon-tunnel.service` (172.17.0.1:9101/8084).
Прод-сервер нотификаций не шлёт (cron пуст, только бэкап-пул на CHUWI в 08:25).

**Каналы уведомлений в мессенджеры (до отключения):**
1. **Alertmanager → Telegram** (receiver `tg-lovii`): host-алерты (InstanceDown, CPU/RAM/диск/load) + Lovii-правила (CI staging, агенты-молчуны). Подключён 12.10.
2. **Kuma → notify-relay** (`notify-relay.service`, `/opt/backups/notify-relay.py`, `POST http://172.17.0.1:3010/kuma`) → **MAX + TG + VK**.
3. **Kuma → нативный MAX** (провайдер max, botapi.max.ru).

## 2. Почему шумит (живая диагностика, 15.10 вечер)

- **Сеть CHUWI → прод флапала**: пачки `connect EHOSTUNREACH 89.19.223.16:443` (Kuma heartbeats мониторов #1–#6, ~14:50–17:54 UTC = 17:50–20:54 МСК) + DNS-сбой `getaddrinfo ENOTFOUND api-staging.lovii.ru` (~20:54 МСК). Каждый переход Down/Up = отправка уведомлений (последняя зафиксированная попытка — 20:51:01 МСК).
- **Alertmanager повторял** (repeat_interval 4ч) 5 активных `LoviiAgentStale` (агенты zcode-* молчат >1ч при открытых задачах) — уходило в TG.
- **MAX с CHUWI не доставляется**: `EHOSTUNREACH 155.212.204.76/135:443` (botapi.max.ru недостижим из домашней сети — видно в логах Kuma).
- TG из Alertmanager — доставлял (иногда с ретраями).

## 3. Что сделано (временно, обратимо; ~21:06–21:11 МСК)

> Мониторинг, проверки и графики продолжают работать — отключены только уведомления. Рестарт Kuma не потребовался (правка живьём, эффект немедленный).

1. **Alertmanager — silence на все алерты, 24ч:**
   - silence id `8763d940-02cc-4028-bd56-5731fbd60e52`; окно `15.10 21:10 МСК → 16.10 21:10 МСК` (автоистечение).
   - Снять раньше: `ssh lovii@192.168.180.156 'curl -s -X DELETE http://localhost:9093/api/v2/silence/8763d940-02cc-4028-bd56-5731fbd60e52'`.
   - Проверено: `/api/v2/alerts` — все алерты `silencedBy: [8763d940…]`.
2. **Kuma — связки уведомлений отвязаны** (16 строк `monitor_notification` для уведомлений 1 `gostiny-relay` и 2 `MAX (владелец)` удалены):
   - ⚠️ Находка: флаг `active` уведомления в Kuma 2.5.6 **не влияет на отправку** (проверено по исходникам контейнера: пути up/down, cert, domain строится из `monitor_notification` без фильтра) — поэтому глушение сделано отвязкой связок.
   - Бэкап: `/home/lovii/monitoring/kuma-monitor-notification-backup-2026-10-15.txt` (CHUWI).
   - Восстановление: `/home/lovii/monitoring/kuma-notif-RESTORE-2026-10-15.txt` (CHUWI) — один INSERT на 16 строк.
   - Проверено: `SELECT count(*) = 0`; в логах Kuma после правки чисто.
3. `notify-relay.service` и экспортеры не трогались: при пустых связках webhook не вызывается, нативного MAX тоже не будет.

## 4. Как вернуть полностью

1. Kuma: выполнить restore-файл (см. §3.2).
2. Alertmanager: дождаться истечения silence (16.10 ~21:10 МСК) или удалить его (см. §3.1).
3. Проверки: `docker exec uptime-kuma sqlite3 /app/data/kuma.db "SELECT count(*) FROM monitor_notification WHERE notification_id IN (1,2);"` → `16`; `/api/v2/silences` → пусто.

## 5. Наблюдения и хвосты

- `НАБЛЮДАЕМОСТЬ-ПЛАН.md`, развилка «куда слать алерты» — фактически решена 12.10 (TG); обновить формулировку при следующем касании плана.
- Белый шум логов Kuma: `DOMAIN_EXPIRY WARN` для `.ru` (нет RDAP) — косметика.
- Push-монитор бэкапов (#10) флапнул один раз в 08:25 МСК — восстановился сам (штатное поведение).
- Напоминание о возврате оповещений поставлено (cron ~16.10 21:00 МСК).
- Связанные доки: `PROD-SERVER-AND-MONITORING.md` §4/§7, `CHUWI-BUILD-STATION.md` §Мониторинг (обновлены).

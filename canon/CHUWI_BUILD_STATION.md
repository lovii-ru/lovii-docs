# CHUWI-BUILD-STATION — домашняя сборочная станция lovii-tech

> Санитарная копия (без секретов). Канон с паролями: `~/LOVII/CHUWI-BUILD-STATION.md` на маке владельца.

> Канонический документ про мини-ПК CHUWI WN100, превращённый в Linux-сервер.
> Прочитай целиком ПЕРЕД любыми действиями с этой машиной. Обновляй после изменений.

## Что это

- Железо: CHUWI WN100 — Intel N100 (4 ядра), 12 ГБ RAM, NVMe 512 ГБ (AirDisk), 2× Ethernet, Wi-Fi.
- Роль: второй self-hosted GitHub Actions раннер для сборок lovii-tech, чтобы билды не крутились на прод-сервере (`gostiny-ci-*`). Деплой по-прежнему на прод-раннерах.
- Установлена чистая **Ubuntu Server 24.04.5 LTS** (минимум, без графики), hostname `gostiny-bild`.
- Дата установки: 2026-10-10. На SSD до этого были (стёрты): побитая Windows 11 и Astra Linux (машина б/у, из организации).

## Доступ (не публиковать нигде)

- SSH-вход: `ssh lovii@192.168.180.156` (кабель) или `lovii@192.168.180.239` (Wi-Fi).
- С мака владельца: вход **без пароля** по ключу `~/.ssh/id_ed25519` (admin@axiiom.ru), ключ в `authorized_keys`.
- Пароль пользователя lovii: **в локальном файле на маке владельца** (`~/LOVII/CHUWI-BUILD-STATION.md`), сюда не выносится (sudo с паролем, НЕ NOPASSWD).
- Wi-Fi: сеть `Sveta` (пароль — локально; в машине уже настроен, `/etc/netplan/90-wifi.yaml`).
- Роутер Amplifi: http://192.168.180.1 (сеть 192.168.180.0/24).
- Все адреса динамические (DHCP); проверяй `arp`/роутер, если IP сменился.

## Топология сети машины

| Интерфейс | MAC | Назначение |
|---|---|---|
| enp1s0 | 84:47:09:20:32:0e | кабель в роутер, DHCP (.156) |
| enp2s0 | 84:47:09:20:32:10 | второй ethernet, свободен |
| wlp0s20f3 | a4:f9:33:a4:5b:46 | Wi-Fi → Sveta, DHCP (.239, metric 600) |

⚠️ Не путать: у машины раньше фигурировал MAC `1c:98:c1:36:57:ef` и IP `.201` — это была **Astra Linux до затирания**, этого больше нет.

## Что установлено

- Ubuntu Server 24.04.5 (LVM: корень 98G, свободно ~87G; /boot 2G; EFI 1G). Timezone Europe/Moscow.
- Docker 29.1.3 (`docker.io` из репо Ubuntu) + docker-compose-v2, служба active. Пользователь lovii в группе docker (перелогиниться, если группа не применилась).
- GitHub Actions runner **v2.337.0 зарегистрирован и работает** (10.10.2026): имя `gostiny-build`,
  лейбл `gostiny-ci-build`, служба `actions.runner.lovii-tech.gostiny-build.service` (systemd, автозапуск).
  Каталог: `/opt/actions-runner-337` (рабочая версия; `/opt/actions-runner` — старый v2.328.0, можно удалить).
- OpenSSH server включён, авторизация по паролю разрешена (запасной вход) + ключ.

## Раннер

Зарегистрирован на **организацию** lovii-tech. Токен регистрации запрашивал аккаунт
`bestdeejay` (один из админов; `bestdeejay-design` — НЕ админ, ему API отдаёт 403/404).
Перерегистрация (если понадобится):

```bash
# токен: gh auth switch -u bestdeejay && gh api orgs/lovii-tech/actions/runners/registration-token --jq .token
# (действует 1 час); в браузере: github.com/organizations/lovii-tech/settings/actions/runners
ssh lovii@192.168.180.156
cd /opt/actions-runner-337
./config.sh remove --token <свежий токен>          # снять старую регистрацию
./config.sh --url https://github.com/lovii-tech \
  --token <свежий токен> --name gostiny-build --labels gostiny-ci-build \
  --work /opt/actions-runner-337/_work --unattended
sudo ./svc.sh install && sudo ./svc.sh start
# статус: sudo journalctl -u actions.runner.lovii-tech.gostiny-build.service | tail
```

- Лейбл `gostiny-ci-build` — ТОЛЬКО для сборок/тестов. Не добавлять в деплой-джобы:
  деплой остаётся на `gostiny-ci-*` на прод-сервере (канон `lovii_docs/canon/CI_RUNNERS_SELFHOSTED.md`).
- Минимальная версия раннера GitHub ужесточается: при 404/401 на регистрации — обновить
  дистрибутив (releases/actions/runner), НЕ пытаться регистрировать старый.
- Для ci.yml правок: только через репо, никакой ручни на серверах.

## Правила для агентов (важно)

1. Не запускать на машине ничего, кроме CI-задач/сборок: это домашний девайс владельца.
2. Не хранить на ней секреты/ключи деплоя (деплой-ключи живут на прод-раннерах, см. канон волны 1 аудита).
3. sudo с паролем `lovii2026` — вводить через `echo lovii2026 | sudo -S ...` (не NOPASSWD, так задумано).
4. Не менять netplan целиком: Wi-Fi — отдельный файл `/etc/netplan/90-wifi.yaml`, проводной — `50-cloud-init.yaml`.
5. Обновления системы — только осознанно (apt upgrade может уронить docker-версии под CI).
6. Если машина пропала из сети: владелец мог её выключить/переставить (это домашняя машина, а не серверная).
7. Работа ведётся по SSH с мака владельца; монитор/клавиатура машине НЕ нужны (Secure Boot в BIOS = Disabled, boot = UEFI, флешка первой — больше не трогать).

## История установки (коротко, детали — в памяти сессии агента)

- 09–10.10.2026: установка через интерактивный установщик Ubuntu Server. Все «чёрные экраны»
  были из-за Secure Boot (Disabled в BIOS решил) и предустановленной Astra Linux (затёрта).
- Страдали медленной флешкой (~4 МБ/с) — образ Ubuntu Server 24.04.5: `~/Downloads/chuwi/`, SHA256 проверен.
- Бэкап содержимого флешки владельца: `~/Documents/USB-DISK-backup`.

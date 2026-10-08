# Обход кабинета b2b: staging + прод — 2026-10-08

Ресёрч-пакет по задаче владельца «обход b2b + собрать бэклог накопившихся
проблем». Исполнитель: агент (zcode), сессия sess_c9024255.

## Артефакты

- **Screens/** — скриншоты прохода (см. таблицу ниже).
- Session-док (полный журнал, гейты, коммиты):
  `lovii-b2b/docs/sessions/012-registration-closed-and-walkthrough.md`
  (bc0c30d, ветки staging + fix/b2b-receipts-tenancy-icon).
- Бэклог: `canon/BACKLOG.md` §1.0 (P1 выкатка прод), §1.0b (P1 sz037
  dead-letter), §3 (P2 ×5), §4 (P3 ×2) — lovii_docs 5ec7e79.

## Скриншоты

| Файл | Что показывает |
|---|---|
| `prod-01-login-register-open.png` | Прод: `/panel/register` ОТКРЫТ (до выкатки фикса 2b9d234) |
| `staging-02-dashboard-mobile.png` | Staging: дашборд (узкий вьюпорт), первый рендер — виджет с ошибкой загрузки |
| `prod-03-receipts-500.png` | Прод: «Чеки» = 500 Server Error (tenancy FiscalDocument) |
| `prod-04-dashboard-red-popup.png` | Прод: та самая красная всплывашка «Ошибка при загрузке страницы» после входа |
| `prod-05-integrations-health.png` | Прод: «Здоровье интеграций» — чисто (представитель чистых разделов) |
| `staging-06-receipts-after-fix.png` | Staging: «Чеки» после фикса 646c1b1 — таблица чеков работает |

## Ключевые факты (кратко)

- Staging: регистрация закрыта (2b9d234), чеки-500 и `filament::icon.icon`
  починены (646c1b1); гейты unit+lint 🟢, CI ✅, live-приёмка ✅.
- Прод = вчерашний T-038-срез: все три бага живые, воспроизведены 08.10
  (юзер 1, 16 разделов); 130 production.ERROR в логе — почти все из двух
  починенных на staging багов.
- Чисто на проде: очередь (0 failed/pending), 409-ретраи sz037, board-SQL.
- Инфра: Redis DNS-сбои 07.10 ~08:53–09:00 ОДНОВРЕМЕННО на staging и проде
  (общий корень с необъяснённым рестартом стеков) — P2 в бэклоге.
- Ждёт владельца: выкатка b2b staging → master (BACKLOG §1.0).

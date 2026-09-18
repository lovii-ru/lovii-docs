# SZ-055 — ПЭП-реестр НПД: закрывающие документы, подписанные Push-OTP

> Статус: **В работе** (2026-09-18, исполнитель zcode)
> Приоритет: **P1** (последний блокер пилота M1 из BACKLOG_REVIEW §B)
> Репо: `lovii-core`
> Источник: `lovii-docs/BACKLOG_REVIEW.md` §A6 + §B (`pep-npd-reports`),
> зависит от SZ-054 (pull-выплаты — сделаны, staging 3d58f4c)
> Решение владельца §C2 #4: Push-OTP достаточно; переделка — после запуска
> платформы и реальных чеков.

## Что сделать

1. Миграция `pep_reports`: user_id, payout_id (unique — один документ на
   выплату), doc_type (`npd_payout_receipt`), content_hash (sha256 снимка),
   payload jsonb (что именно подписано), статус pending|signed,
   otp_hash + otp_expires_at (код не храним в открытом виде),
   confirmation_method (`push_otp`), signed_at.
2. `PepReportService` (Domain/Compliance):
   - `issueForPayout(payout)` — снимок данных выплаты → payload → hash →
     OTP (генератор инжектится) → хеш + TTL в строку → пуш клиенту через
     PushNotificationDispatcher («Код: N …» — рядом с кодом, решение
     владельца SZ-012 про автоподстановку);
   - `confirm(user, report, code)` — владелец + pending + не истёк + хеш
     совпал → signed_at, статус signed, otp_hash стёрт; иначе честные коды
     (pep_invalid_code / pep_code_expired / pep_already_signed);
   - `resend(user, report)` — новый код + новый TTL + повторный пуш.
3. Хук в `PayoutService::requestPull` — после коммита выплаты создаётся
   отчёт и уходит пуш (пуш после транзакции; сбой пуша не отменяет отчёт —
   есть resend).
4. API: `GET /pep/reports/pending` (текущий неподписанный, payload для
   показа), `POST /pep/reports/{report}/confirm`, `POST …/resend`.

## Развилки и заметки

- Текст документа — каркас (нейтральная формулировка «подтверждаю
  получение выплаты…»); юридическую формулировку утверждает владелец с
  юристом (§0.5 BACKLOG_REVIEW: оферты — не ко мне).
- Презумпция НПД (§A6) уже реализована в SZ-054 (legal_status nullable).
- Штраф + ban за нарушение — не здесь (отдельная задача, оферта + admin).

## Приёмка

- [ ] Создание pull-выплаты → pep_report pending + пуш с кодом.
- [ ] Подтверждение верным кодом → signed, otp_hash стёрт, signed_at.
- [ ] Неверный/истёкший код, чужой отчёт, повторное подтверждение — честные 422/404.
- [ ] Resend обновляет код и TTL.
- [ ] Гейты зелёные; merge в staging, деплой, смоук.

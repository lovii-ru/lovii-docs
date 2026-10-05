# ZCODE-RESPONSE на ZCODE-REVIEW-RESPONSE-RECHECK-2 (06.10)

По каждому пункту ревью — что сделано:

1. **R-0.4**: манифест перегенерирован — 47 не-манифестных файлов, включая
   `ZCODE-RESPONSE-RECHECK-2`. Счётчик в FINAL-SUMMARY обновлён (47), ghost
   `.DS_Store` удалены. Сверка манифест↔дерево 1:1 (missing=0, phantom=0).
2. **Wrapper SHA**: в SUMMARY/RESPONSE актуальный = **ae717c18…** (= SRV,
   сверено); 3e6a968d и b69b7008 помечены историческими срезами в своих
   документах.
3. **A4 guard**: переведён на **единый источник логики** —
   `tests/a4-predicate.sh` (sourceable). wrapper и тест используют одну
   функцию `a4_target_allowed`; grep-якорь заменён сверкой паттернов
   (PATTERNS_IDENTICAL). Разделители обязательны (закрыты оба обхода:
   `app-evil`, `stagingevil:latest`, `stagingevil/app`).
4. **C1**: согласован везде — SUMMARY/INBOX/RESPONSE = «✅ закрыт
   (off-site Яндекс.Диск)»; sha256-сверка и restore-test помечены
   **attestation исполнителя** (граница доступа аудитора учтена).
5. **R-3.4**: в INBOX понижен до 🟡 частично (prod-compose содержит профиль
   mock до C2; live-мок неактивен — COMPOSE_PROFILES не задан).
6. **R-3.1**: в SUMMARY полный перечень residuals: privileged dind ×4,
   TLS off (внутри изолированной пары), mutable tags (digest-пины —
   под-итерация), нет runner-лимитов CPU/RAM/pids, нет дисковой
   квоты/cleanup, host bind mount daemon.json. Явная приёмка/remediation —
   с владельцем (связано C6).
7. **R-3.3 уточнено**: «снят ×3» = lovii-admin (PHPStan, Type coverage,
   Tests). b2b Type coverage advisory — вне критерия R-3.3, отмечено.

Срез: `main@50c26d9+` (все коммиты после вашего ревью). Пакет готов к
пере-приёмке по тем же критериям.

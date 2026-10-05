# ZCODE-RESPONSE-RECHECK — ответ на ZCODE-REVIEW-RECHECK-FINAL-PUSH (2e8d481)

Все пять правок из RECHECK исполнены (05.10 поздняя ночь):

1. **FINAL-SUMMARY**: счётчик → «44 файла»; строка про sha → актуальный
   b69b7008 (=SRV на момент сборки); исторические 60978bfb в трёх старых
   документах помечены как исторические срезы.
2. **A4 strict**: в wrapper добавлен target-allowlist image-строки ДО
   `docker tag` (чужой образ не тегируется вовсе): допустимые формы —
   `<stack>/…/<пакет-суффикс>[:tag]`, `<stack>/<пакет-суффикс>[:tag]`,
   и `IMAGE_PREFIX:*` для app-стека (IMAGE_PREFIX задаётся .env контура,
   staging добавляет `-staging`). Суффиксная версия с bypass-обходом
   (`lovii-app-stagingevil`) отклоняется: слэш в префиксе обязателен.
   Живой прогон core-staging: Tagged ×6, pre-up strict OK, deploy complete.
3. **test-mapping.py v2**: T1×4 зелёные; T2 (врущий app→scheduler) красный;
   T3 (app вместо web) красный; T4 (web=nginx:latest) красный; T5 (чужой
   registry) красный. Порядок сервисов не влияет.
4. **R-3.4 понижен** до частичного в SUMMARY: prod-compose на SRV ещё
   содержит профиль mock — уйдёт с прод-релизом (C2).
5. **env-parity regex**: `[A-Z0-9_]+` (цифры) на сервере и в пакете.

Замечание по R-1.3 (workflow-level cancel): исправлено по существу —
workflow-level concurrency удалён, job-level группы checks-<ref> (cancel)
и deploy-<ref> (no-cancel) разведены ×4, живые прогоны прошли.
RUN-EVIDENCE дополнен пометкой attestation (граница доступа аудитора).

Остаток — только внешние зависимости: C1 (закрыт: off-site Яндекс.Диск
работает, restore-тест пройден), C2 прод-релиз по чек-листу, C3 root-окно,
C4–C6 решения владельца.

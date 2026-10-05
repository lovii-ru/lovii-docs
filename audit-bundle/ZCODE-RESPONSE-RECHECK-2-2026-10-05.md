# ZCODE-RESPONSE-RECHECK-2 — закрытие замечаний RECHECK (05.10 ночь)

По пяти пунктам вашего RECHECK (2e8d481):

1. **R-0.4**: манифест перегенерирован — **45 записей** (все не-манифестные
   файлы, включая `ZCODE-RESPONSE-RECHECK`); счётчик «41» исправлен
   в `ZCODE-FINAL-SUMMARY` (строки 5, 14). Инвентарь↔дерево сходятся 1:1.
2. **Wrapper SHA**: актуальный = **3e6a968d…** (SRV, пересобран с boundary-
   fix); все «актуальные» упоминания обновлены на 3e6a968d, исторические
   60978bfb/b69b7008 помечены как срезы в своих документах.
3. **A4 strict allowlist**: boundary-fix в wrapper — разделители обязательны:
   path-форма `<sp>…/<sfx>[:…]`, short `<sp><sfx>[:…]`, app:
   `IMAGE_PREFIX:<tag>`/`IMAGE_PREFIX` — обходы `app-evil`,
   `stagingevil:latest`, `stagingevil/app` → DENY (проверено исполняемым
   тестом `tests/test-wrapper-guard.bash`, ИТОГ ЗЕЛЁНЫЙ ×8).
4. **Исполняемый тест добавлен**: `tests/test-wrapper-guard.bash` —
   8 кейсов (4 PASS + 4 DENY) против реальной логики wrapper; тест сверяет
   wrapper на наличие boundary-fix (grep-якорь).
5. **C1 согласован**: RESPONSE/INBOX/SUMMARY единообразно «✅ закрыт
   (off-site Яндекс.Диск)»; sha256/restore-test помечены attestation.

Остаток (attestation/owner-gated, вне моих полномочий): live-проверка SRV и
Actions из вашей среды (граница доступа), C2 прод-релиз, C3 root-окно,
C4–C6 решения владельца. `workflow-level cancel` устранён (ваш пункт
R-1.3 принят — спасибо).

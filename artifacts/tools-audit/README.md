# tools-audit — инструментарий аудита lovii-demo (SZ-062)

**Загружен:** 2026-09-20 · **Проверено на:** lovii-demo `master` a8a86be (сборка 50),
свежий клон 2026-09-20 · **Задача:** [`canon/TASKS/SZ-062`](../../canon/TASKS/SZ-062-ds-css-icons-optimization.md)

Инструменты конвейера аудита из RES-009 §3. Рабочие копии держались у агента в
личной папке и не сохранились между сессиями — поэтому канонная копия живёт здесь.

## Состав

| Скрипт | Статус | Назначение |
|---|---|---|
| `lv_tokdiff.py` | 🟩 оригинал (RES-008 §2) | нормализация + diff токен-слоёв demo/app (theme-скоун) |
| `lv_cabdiff.py` | 🟩 оригинал (RES-008 §4) | класс-семейства кабинетов demo vs app |
| `lv_cabvals.py` | 🟩 оригинал (RES-008 §4) | сверка значений свойств по общим семействам |
| `lv_collisions.py` | 🟧 восстановлен 2026-09-20 по описанию RES-009 §3 | фатальные let/const/class-коллизии между классическими скриптами (exit 1 = фатально) |
| `lv_eslint.mjs` | 🟧 восстановлен 2026-09-20 по описанию RES-009 §3 | eslint 9 flat-config; globals синтезируются из top-level деклараций всех js/*.js |
| `lv_runtime_audit.py` | 🟧 написан 2026-09-20 (объединяет lv_shot_profile / lv_arrows_find / lv_arrows_dump / lv_crop_rows) | рантайм-обход роутов: ошибки консоли, SVG 0×0, горизонтальные переполнения, скриншоты |

Старые точечные скрипты расследования стрелок (`lv_shot_profile.py`,
`lv_arrows_find.py`, `lv_arrows_dump.py`, `lv_crop_rows.py`) не восстановлены — их
функции покрывает `lv_runtime_audit.py`. Если понадобится прежняя логика — писать
заново сюда, по описанию RES-009 §3.

## Запуск (из корня свежего клона lovii-demo)

```bash
node --check js/app.js && for f in js/*.js sw.js; do node --check "$f"; done   # синтаксис
npx eslint --config <путь>/lv_eslint.mjs js/*.js sw.js                        # статика
python3 <путь>/lv_collisions.py .                                             # коллизии
python3 <путь>/lv_tokdiff.py <demo> <app>                                     # токены demo↔app
python3 <путь>/lv_runtime_audit.py https://lovii.mobiap.com/ --viewports 390,1280  # рантайм
```

## Базовый прогон на a8a86be (2026-09-20, верификация инструментов)

| Инструмент | Результат базы | Смысл для SZ-062 |
|---|---|---|
| `node --check` (все js + sw.js) | OK, 0 ошибок | критерий 2 — «не хуже базы» |
| `lv_eslint.mjs` | **0 ошибок**, 59 предупреждений (в осн. no-unused-vars) | критерий 3 — «0 ошибок»; предупреждения — список фазы 1 |
| `lv_collisions.py` | 0 фатальных; 10 перекрытий `function` (cabinets.js ↔ dash.js: renderRepDash, renderAmbDash, renderMspCabinet и др. — известная связка) | критерий 4 — «0 фатальных»; перекрытия — разбор фазы 1 |

Ловушки рантайма: `wait_until="load"` (НЕ networkidle — баннер с setInterval
вешает); перед clip-скриншотом скроллить секцию во вьюпорт.

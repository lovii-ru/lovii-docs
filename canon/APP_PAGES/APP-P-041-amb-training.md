# APP-P-041 — Амбассадор · Обучение
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/ambassador/training` · name `AmbassadorTraining` (src/router/index.ts:747)
- Тип: вложенная (родитель: `/cabinet/ambassador`, CabinetLayout; вкладка «Обучение», icon star; accent gold)
- Доступ: роль ambassador (rolesGuard на родителе, src/router/index.ts:723)
- Назначение: Обучающий трек амбассадора (из config/roles.php core): кольцо прогресса (SVG без библиотек, канон демо) + список уроков. Уроки НЕ открываются: контента/LMS в API нет — строки не кнопки, материалы честно помечены «откроются позже» (AmbassadorTraining.vue:9-17).
- Функциональные блоки:
  - #hero — Чернильный герой (var(--lv-gradient-ink)): «Обучающий трек амбассадора» + программа трека (:120-127).
  - #track — Карточка прогресса: SVG-кольцо r=24 (dasharray = доля, дуга не рисуется при 0%, чтобы не выглядело «что-то пройдено», :136-149), процент (testid `amb-training-pct`), «Пройдено X из Y» (testid `amb-training-done`), сводка «N уроков в треке · X пройдено[ · K в процессе]», полоса прогресса (:129-161, testid `amb-training-track`). Прогресс трека = среднее по урокам (:50-54); core сейчас отдаёт 0 — LMS в фазе 1 нет.
  - #lessons — «Уроки»: иконка по id из core (value-pitch→message, rep-launch→footprints, motivation→users, finmodel→bar-chart, незнакомый id → нейтральный info; эмодзи запрещены каноном — поле emoji API не рисуется, :78-91), «Урок N · описание», «~мин», мини-прогресс + %, статус-тег done/active/pending («Пройден» / «В процессе · N%» / «Не начат», :163-193, testid `amb-training-lessons`).
  - #materials — Честная заглушка «Материалы откроются позже»: скрипты, шаблоны, калькулятор дохода появятся вместе с уроками (:195-204, testid `amb-training-materials`).
- Состояния: loading — скелетоны (герой + кольцо + 3 строки); ошибка — roleLoadErrorText («…после назначения ветки.» / «Уроки недоступны — проблема с сетью…») + «Повторить» (:108-111, testid `amb-training-error`); пусто — «Трек пока не опубликован» + CTA «Открыть структуру» (:207-216, testid `amb-training-empty`).
- Зависимости: API GET `api/v1/ambassador/training` (rolesApi.ambassadorTraining — src/modules/roles-module/api/roles-api.ts:629-631); plural (ambassador/money.ts); AppButton, AppSkeleton, LvIcon; roleLoadErrorText.
- Переходы: → APP-P-040 (CTA «Открыть структуру» в пустом состоянии); ← APP-P-039 (next-step и действие «Обучение»), таб-бар.
- Дизайн/канон — проверить визуально: 3 состояния, честные цифры (прогресс 0 не имитирует пройденное), токены ДС (--lv-tile-gold, --lv-gradient-gold, --lv-soft-tiffany для статуса «Пройден»), a11y (svg role="img" с aria-label «Пройдено N% трека»), акцент amb gold по PRODUCT_QUALITY_BAR.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)

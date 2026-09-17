> ⚠️ **АРХИВ.** Карточка закрыта и не является текущим источником требований; сохранена только для истории.

# T-006 — UX-фаза B: профиль (profile-module) по SZ-002

> Статус: **Закрыта** (приёмка-1 zcode «Достаточно» 2026-09-10; приёмка-2 Super Z «Достаточно» 2026-09-11; визуальная приёмка владельца — по желанию)
> Приоритет: P1 · Источник: SZ-002 §3 фаза B (дефекты B1–B8) · Спека: SZ-002
> Исполнитель: Super Z · Постановил: Super Z · Приёмка: zcode (§3.1) + визуальная — владелец на staging
> Репо: lovii-app, ветка `staging` · Дата: 2026-09-09

## Цель

Профиль читается как системная карточная страница: навигация — основная
(44px+ цели, primary-текст), настройки — единый паттерн, деструктивное
действие помечено и подтверждается. Функциональность не меняется.

## Контекст

1. `lovii_docs`: canon/TASKS/SZ-002-ui-ux-profile-orders-checkout.md (§2, §3
   фаза B), canon/DESIGN.md §4–§5.
2. Компоненты: `src/modules/profile-module/` (ProfileModule.vue, ProfileCard.vue,
   ProfileBanner.vue, ProfileFooter.vue, ProfileSkeleton.vue),
   `src/components/Ui/AppBadge.vue`, `src/components/Ui/AppSegmentControl.vue`.
3. Профиль-страницы (AddressesView, OrdersView, ProfileEditView) — вне задачи
   (свои фазы), менять только профиль-хаб.

## Шаги

1. **B1 — багфикс** (`ProfileCard.vue`): `var(--conten-normal-secondary)` →
   `var(--content-normal-secondary)`; `grep -rn "conten-normal" src/` — если
   есть ещё места той же опечатки, исправить и перечислить в отчёте.
2. **B2 — карточка профиля** (`ProfileCard.vue`): вся карточка — кликабельная
   цель на ProfileEditView (RouterLink-обёртка или @click+router.push);
   IconEditRegular справа от имени оставить как аффорданс; cursor/active —
   по системе. Внимание: внутри карточки нет других интерактивных элементов —
   конфликта целей нет.
3. **B3 — навигация** (`ProfileModule.vue` `__nav`): строки-ссылки —
   body-m-regular, цвет `--content-normal-primary`, мин. высота 44px
   (padding 12px 0), chevron `--content-normal-tertiary`; фон строки —
   transparent, при active — лёгкий soft-фон. «Скоро»-строки остаются
   secondary + бейдж (шаг 4), без клика.
4. **B4 — бейджи** (`ProfileModule.vue`): `soon-badge` → `<AppBadge size="s">`
   с нейтральным/soft-цветом из пропсов AppBadge; собственные стили badge
   удалить. Если у AppBadge нет подходящего варианта — минимальное расширение
   пропсом (без нового компонента).
5. **B5/B7 — настройки одним паттерном** (`ProfileModule.vue`): «Тема» —
   заменить самодельный тумблер на `AppSegmentControl` («Светлая»/«Тёмная»,
   v-model на colorMode) в карточке «Настройки» вместе с «Размер текста»
   (два SegmentControl в одной карточке-секции). Кастомные стили тумблера
   удалить. colorMode-логика (useColorMode + localStorage) не меняется.
6. **B6 — logout** (`ProfileModule.vue`): цвет строки —
   `--content-normal-negative` (иконка+текст); перед `profileStore.logout()` —
   подтверждение: лёгкий sheet/диалог в системе (если в проекте есть готовый
   confirm-паттерн — использовать его; если нет — `AppSheet`-подобный блок с
   кнопками «Выйти» (negative, solid) / «Отмена» (soft); новый глобальный
   компонент не заводить).
7. **B8 — footer** (`ProfileFooter.vue`): блок поддержки → карточка в системе
   (surface, radius 16, padding 16): заголовок «Поддержка» (body-l-semibold) +
   строка с mailto `support@lovii.ru` (`--content-normal-link`, иконка письма
   из существующего набора, если есть).
8. **Тесты**: profile.store.test не трогается; обновить/добавить компонентный
   тест при изменении шаблона ProfileModule (рендер навигации, badge,
   confirm-ветка logout: «Отмена» не логаутит).
9. **Гейты и пуш:** typecheck + vitest + сборка PWA 🟢 → пуш в `staging`.
   Session-док + `lovii-docs/status.md` в том же пуш-цикле. Скриншоты
   light+dark до/after в session-док.

## Что НЕ делать (стоп-лист)

- НЕ менять логику auth/анти-FOUC (authState-ветки, ProfileAuth, ProfileSkeleton
  — только при необходимости синхронизировать верстку скелетона с новой
  структурой).
- НЕ менять stores/API/роутинг (имена вью остаются).
- НЕ трогать ProfileBanner-контент (промо) — только если стили выбиваются из
  системы (тогда описать в отчёте, менять по минимуму).
- НЕ вводить новые зависимости/цвета/шрифты; dark/light — оба проверять.
- Тумблер темы НЕ выносить из карточки настроек и не удалять функционал
  масштаба текста (доступность).

## Критерии приёмки

- Нав-строки ≥44px, primary-цвет, chevron; «Скоро» — AppBadge.
- Настройки: один паттерн (AppSegmentControl ×2) в одной карточке.
- Logout: negative-цвет + подтверждение; отмена не логаутит.
- B1 исправлен; всей карточкой профиля попадаем в редактирование.
- typecheck/vitest/сборка 🟢, CI 🟢; скриншоты light+dark в session-доке.

## Отчёт исполнителя

Выполнена Super Z 2026-09-09 в составе единой серии SZ-002 фаз A/B/C,
lovii-app staging: `0da6a82` (+ merge `bc860ea`), session-док
`docs/sessions/021-ui-ux-profile-checkout.md`.

- B1 — `--conten-normal-secondary` → `--content-normal-secondary`;
  grep по репо — других вхождений опечатки нет.
- B2 — вся карточка профиля — RouterLink на ProfileEditView (surface,
  radius 16, grid аватар/имя+телефон/chevron, active-фон); карандаш у
  имени сохранён как доп-аффорданс.
- B3 — нав-строки: body-m-regular + `--content-normal-primary`,
  мин. высота 44px, radius 8, active-фон soft-neutral; secondary —
  только «Скоро»-строкам.
- B4 — `soon-badge` удалён, везде `AppBadge` size="s" color="tertiary";
  собственные стили бейджа удалены.
- B5/B7 — тема: `AppSegmentControl` «Светлая/Тёмная» в одной карточке
  с «Размер текста» (два SegmentControl); самодельный тумблер с
  warning-солнцем удалён; механика colorMode не менялась (computed
  поверх `useColorMode`, тот же ключ `localStorage.colorMode`).
- B6 — «Выйти»: строка 44px в своей карточке, цвет
  `--feedback-negative-solid` (токена `--content-normal-negative`
  в системе нет — отклонение); подтверждение через `AppBottomSheet`:
  «Отмена» (outlined) / «Выйти» (AppButton brand с локальным override
  фона на negative-solid, текст — on-brand белый); отмена не логаутит.
- B8 — поддержка: карточка surface/16 (заголовок body-l-semibold +
  mailto-строка 44px с `IconMailRegular`); slot-параграф из
  ProfileModule удалён; border-top футера — `--border-normal-subtle`
  (был цвет текста).

Проверки: oxlint/eslint 🟢, vitest 214 🟢 (+5 ProfileModule.test.ts:
навигация, AppBadge, сегмент темы, «Отмена» не логаутит / «Выйти»
логаутит), vue-tsc 🟢, build 🟢. Скриншоты — песочница без бэкенда;
визуальную приёмку — владелец на staging.

## Приёмка zcode (§3.1) — 2026-09-10

Факт-чек по коду lovii-app staging (`bc860ea`, CI 🟢 run 34380270533):

- **B1** — `ProfileCard.vue:109` использует `--content-normal-secondary`;
  `grep -rn "conten-normal" src/` — 0 вхождений по всему src ✓.
- **B2** — вся карточка — `RouterLink :to="{name:'ProfileEditView'}"`
  (строка 38), `IconEditRegular` сохранён как аффорданс ✓.
- **B3** — `ProfileModule.vue`: nav-строки `min-height: 44px` (строка 186)
  + комментарий «вся строка тапается» ✓.
- **B4** — «Скоро» — `AppBadge label="Скоро" size="s" color="tertiary"`
  (×2, строки 92/96); самодельных бейдж-стилей нет ✓.
- **B5/B7** — два `AppSegmentControl` в карточке настроек (строки 100/105) ✓.
- **B6** — logout: строка `--feedback-negative-solid` (строка 221),
  подтверждение через `AppBottomSheet` «Выйти из аккаунта?» с
  «Отмена»/«Выйти» (строки 126–141); `logout()` вызывается только из
  подтверждённой ветки ✓. Отклонение по токену (нет
  `--content-normal-negative` в системе) задокументировано — принимается.
- Тест `ProfileModule.test.ts` на месте (нав/AppBadge/сегмент/logout-ветки).

**Вердикт: «Достаточно»** (приёмка-1; приёмка-2 — Super Z, визуальная — владелец).

## Приёмка-2 Super Z — 2026-09-11: «Достаточно»

Сверка по дефектному списку SZ-002 §3 соответствующей фазы в коде
(lovii-app, staging):
- B1 опечатка токена исчезла по всему репо ✓; B2 вся карточка — RouterLink
  на ProfileEditView, карандаш-аффорданс ✓; B3 навигация body-m/primary/44px ✓;
  B4 «Скоро» — AppBadge ✓; B5/B7 кастомный тумблер темы ликвидирован — единый
  паттерн: SettingsSheet (нижний шит) с radiogroup «Тема» («Системная»),
  «Размер текста», «Анимации» (Task 90 + SZ-030/031) ✓; B6 выход — negative
  цвет + подтверждение AppBottomSheet «Выйти из аккаунта?» ✓; B8 футер —
  карточка «Поддержка» с mailto и иконкой ✓.

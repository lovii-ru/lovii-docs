# APP-M-005 — Настройка быстрого входа (QuickAccessSheet)

<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код; канон — canon/PARAMS.md -->

- Статус: живая
- Открытие: компонент `QuickAccessSheet` — `modules/profile-security/components/QuickAccessSheet.vue`; нижняя шторка на базе `AppBottomSheet` + собственный `<Teleport to="body">` (QuickAccessSheet.vue:2, 217). Точка входа: `modules/profile-settings/ProfileSettings.vue:27`
- Родитель: APP-P-020 (настройки)
- Назначение: включение/настройка быстрого входа на устройстве — платформенная биометрия (WebAuthn/Face ID) и ПИН-код; отключение обоих снимает гейт устройства полностью.
- Функциональные блоки:
  - #pin — включение/отключение ПИН: ввод 4–8 цифр, повтор, сверка (тост «Коды не совпадают»); QuickAccessSheet.vue:75–104
  - #biometric — строка биометрии (видна при доступности платформы): регистрация/включение/отключение Face ID; QuickAccessSheet.vue:109–132, строка :155
  - #disable — «выключить быстрый вход» целиком; тосты-подсказки о порядке действий (например «Сначала установите ПИН-код»); QuickAccessSheet.vue:117–139
- Состояния: ничего не настроено / настроен ПИН / настроена биометрия / настроены оба / этап ввода-подтверждения ПИН
- Зависимости: `useQuickAccess` (pinEnabled, biometricEnabled, verifyPin…), `showToast`, `AppSwitch`, `AppButton`, `AppBottomSheet`; WebAuthn-биометрия платформы
- Переходы: → APP-P-020 (закрытие в настройки); включает гейт APP-M-001 при следующей блокировке
- Сверка: роутер n/a / код ✓ / UI ✗ (скрины — отдельный съём)

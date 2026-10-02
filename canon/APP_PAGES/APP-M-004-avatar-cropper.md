# APP-M-004 — Кадрирование аватара (AvatarCropper)

<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код; канон — canon/PARAMS.md -->

- Статус: живая
- Открытие: компонент `AvatarCropper` — `modules/profile-edit/components/AvatarCropper.vue`; нижняя шторка на базе `AppBottomSheet` (AvatarCropper.vue:2, инстанс :50). Точка входа: `modules/profile-edit/components/ProfileEditForm.vue:12`
- Родитель: APP-P-013 (редактирование профиля)
- Назначение: круглое кадрирование выбранного фото аватара перед загрузкой на сервер.
- Функциональные блоки:
  - #cropper — `Cropper` c `CircleStencil` (vue-advanced-cropper), скелет на время инициализации; AvatarCropper.vue:5, 19–22, template :51+
  - #actions — «Готово» (`cropImage` → blob → emit `crop`) и отмена (закрытие шита); AvatarCropper.vue:29–35, `AppButton` в футере
- Состояния: инициализация кроппера (скелет) / готов к кадрированию / закрыт
- Зависимости: `vue-advanced-cropper` (+его css), `AppBottomSheet`, `AppSkeleton`, `AppButton`
- Переходы: → APP-P-013 (возврат обрезанного blob в форму профиля)
- Сверка: роутер n/a / код ✓ / UI ✗ (скрины — отдельный съём)

# Факты сессии (собраны основной линией в ходе работы)

- Перенос выполнен в рабочей копии `~/LOVII/lovii-app`, НЕ закоммичено (как и правки демо).
- Изменённые файлы клиента: `src/modules/profile-module/ProfileModule.vue`, `src/modules/profile-module/__tests__/ProfileModule.test.ts`, `src/router/index.ts`.
- Новые файлы клиента: `src/modules/profile-balance/ProfileOperations.vue`, `src/modules/profile-balance/components/ProfileCollapse.vue`, `src/modules/profile-balance/components/WalletHistoryList.vue`, `src/modules/profile-balance/helpers/pay-tier.ts`, `src/modules/profile-balance/helpers/wallet-history.ts`, `src/modules/profile-module/components/ProfileCabinets.vue`, тесты (`.../profile-balance/__tests__/`, `.../helpers/__tests__/pay-tier.test.ts`).
- Выполненные проверки (по факту прогона): `yarn vitest run` — 75 файлов / 448 тестов зелёные; `yarn type-check` — чисто; `yarn lint` — 0 warnings / 0 errors; `yarn build` — собирается.
- Новый маршрут: `/profile/operations` (имя `ProfileOperationsView`), гейт по токену как у соседних экранов.
- Ограничения данных: подписка/оборот (уровни PASS/VIP) API нет; избранные МСП API нет; история кошелька — per_page максимум 48 без страницы; «Выведено через СБП» данных нет.
- Визуальная сверка в живом клиенте не выполнена: профиль доступен только с авторизованной сессией (OTP на стейджинге), без входа показывается экран «Войдите в свой аккаунт». Дев-сервер клиента отвечал на :5173, демо — на :8080.
- Обновлён `~/LOVII/lovii-demo/docs/HANDOFF.md`: новый раздел 10 (план + состояние) и строка в журнале §8; копия во вложении рабочей папки синхронизирована.
- Артефакты этой сессии: `deliverables/lovii-profile-client-report.html` (отчёт о переносе), `memory/2026-09-14.md` (запись дня).

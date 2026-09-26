# T-021 — Auth-гард для всех непубличных экранов: после logout профиль и sub-роуты недоступны

> Статус: **Открыта**
> Приоритет: **P1** (безопасность — сегмент авторизации) · Источник: баг владельца 2026-09-25 «после выхода из аккаунта кнопкой "Выйти" профиль остаётся открытым и в него можно зайти; все непубличные экраны должны проверять сессию и авторизацию»
> Исполнитель: **zcode** · Репо: `lovii-app` (router + auth-module + profile-module + e2e) + `lovii_docs` (session-док, FINDINGS) · Дата постановки: 2026-09-25

## Контекст

Симптом: после клика «Выйти» профиль остаётся доступным — можно зайти на `/profile`
и его sub-роуты без авторизации. Владелец требует: **все непубличные экраны должны
проверять сессию и авторизацию**; публичные — только главная витрина, поиск, корзина
(до момента чекаута), витрина точки, товар, заявка МСП.

### Root cause (найдено Super Z, 2026-09-25, по коду staging)

1. **`src/router/index.ts:995` — `beforeEach` НЕ проверяет авторизацию**:
   ```ts
   router.beforeEach((to) => {
       perfMark(`route-${String(to.name)}`);   // ← только perf-метрика
   });
   ```
   Гвард делает ТОЛЬКО perf-метку. Никакой проверки `loviAccessToken`/`authState`,
   никакого редиректа на `/auth`.

2. **`rolesGuard` (router/index.ts:21–48) защищает ТОЛЬКО кабинеты** (`/cabinet/rep`,
   `/cabinet/amb`, `/cabinet/msp`, `/cabinet/team`) — он проверяет токен + роли и
   редиректит на `ProfileView` без токена. **Сам `/profile` и его sub-роуты — НЕ
   защищены**: `/profile`, `/profile/edit`, `/profile/wallet`, `/profile/wallet/transfer`,
   `/profile/orders`, `/profile/order`, `/profile/addresses`, `/profile/address`,
   `/profile/settings`, `/profile/security`, `/profile/balance`. На эти роуты можно
   зайти без токена — экран рендерит guest-состояние («Войдите в свой аккаунт») вместо
   редиректа на `/auth`.

3. **`profile.store.ts:121` — `logout()` КОРРЕКТНЫЙ**: `apiRemoveToken()` →
   `localStorage.removeItem("loviAccessToken")` → `this.profile=null` →
   `this.authState="guest"` → `window.location.reload()`. Токен удаляется, страница
   перезагружается. НО: после reload `authState="guest"`, и навигация на `/profile`
   пропускается гардом (п.1) → экран рендерит guest-состояние вместо редиректа на
   `/auth`. Пользователь «остался на профиле».

4. **`authState`** (`profile.store.ts:12–18`): `pending` (токен есть, профиль грузится) →
   `authed` (профиль загружен) → `guest` (токена нет/выход). Это UI-состояние для
   анти-FOUC скелетона — **не для роутер-гарда**. Гард должен проверять наличие
   `loviAccessToken` (или `authState !== "guest"`).

5. **401-handler** (axios-интерсептор, см. `profile.store.ts:88` комментарий): при 401
   от API токен сбрасывается + reload. Это валидация токена на API-вызовах. Гард
   роутера проверяет **присутствие** токена (не валидность) — это допустимо: невалидный
   токен clears on next API call → reload → guest.

### Канон публичности (владелец, 2026-09-25)

| Роут | Публичный? | До какого момента |
|---|---|---|
| `/` Главная (home) | ✅ да | всегда |
| `/search`, `/stores`, `/popular` (поиск, каталог точек) | ✅ да | всегда |
| `/store/:id`, `/product/:id` (витрина точки, товар) | ✅ да | всегда |
| `/cart` (корзина) | ✅ да | **до чекаута** — `/checkout`/`create-order` требует авторизации |
| `/apply`, `/msp-signup` (заявка МСП) | ✅ да | до отправки заявки (тогда нужен токен) |
| `/auth` (OTP-вход) | ✅ да | всегда |
| `/profile*` (профиль + все sub-роуты) | ❌ нет | требуется авторизация |
| `/cabinet/*` (rep/amb/msp/team/platform) | ❌ нет | требуется авторизация + роль (rolesGuard) |
| `/dash` (платформа/владелец) | ❌ нет | требуется авторизация + роль founder |
| Magic link `/…?token=…` (SZ-008, P-1) | ✅ да | это flow входа — логинит, не блокировать |

## Что сделать

### Фаза А — Аудит роутов (read-only, в один список)

А.1. **Выгрузить все роуты** из `router/index.ts` (38KB) в таблицу: name, path, meta
(текущее), есть ли гард, публичный/защищённый по канону выше. Отметить расхождения
с каноном (где защищённый роут без гарда — это баг).

А.2. **Проверить все sub-роуты профиля** (`/profile/*`) и кабинетов (`/cabinet/*`) —
какой гард стоит (если есть), редиректит ли без токена на `/auth`.

А.3. **Зафиксировать «было»** в таблице (для session-дока): какие роуты защищены,
какие открыты (баг).

### Фаза Б — Глобальный auth-гард в `beforeEach`

Б.1. **Добавить auth-проверку в `router.beforeEach`** (router/index.ts:995): для
роутов БЕЗ `meta.public === true` проверять `localStorage.loviAccessToken` (или
`useProfileStore().authState !== "guest"`); если нет токена → `next({ name: "AuthView" })`
(или `ProfileView` с явным переходом на `/auth`).

Б.2. **Marking публичных роутов**: добавить `meta: { public: true }` на: `/` (home),
`/search`, `/stores`, `/popular`, `/store/:id`, `/product/:id`, `/cart`, `/apply`,
`/msp-signup`, `/auth`, magic-link target (SZ-008). Все остальные — `meta.public`
отсутствует = требуют авторизации.

Б.3. **Cart checkout gate**: `/cart` публичный, но `/checkout`/`create-order` action —
требует токена. Если `/checkout` отдельный роут — `meta.public` НЕ ставить; если
checkout — это action внутри cart — проверять токен перед `POST /orders` (редирект на
`/auth` если нет, потом возврат на checkout после логина).

Б.4. **Magic link** (SZ-008, P-1, session 017): роут с `?token=…` — НЕ блокировать
гардом (это flow входа); токен из URL обрабатывается отдельно (логинит). Пометить
`meta: { public: true }` ИЛИ специальный `meta: { isAuthFlow: true }`.

Б.5. **guest token (`loviGuestToken`)**: гард НЕ должен путать guest-токен с access-токеном.
Проверять ТОЛЬКО `loviAccessToken`. Guest-токен — для публичного API-доступа (витрина),
не для авторизации.

Б.6. **Не сломать `rolesGuard`** (cabinets) и `router.onError` (chunk-recovery): новый
auth-гард — в том же `beforeEach` ДО rolesGuard (или как общий гард, а rolesGuard
остаётся per-route). Chunk-recovery (`router.onError`) — не трогать.

### Фаза В — Logout redirect

В.1. **В `profile.store.ts:121 logout()`** — после `window.location.reload()` проверить:
после reload гард (Фаза Б) должен редиректить с защищённого роута на `/auth`. Если
logout вызывается с `/profile` → после reload пользователь должен оказаться на `/auth`,
не на `/profile` (где сейчас guest-состояние).

В.2. **Альтернатива** (решение zcode, обосновать в отчёте): вместо `window.location.reload()`
сделать `router.push({ name: "AuthView" })` + очистка стора — мягче, без полной перезагрузки.
Но: `reload` сейчас гарантирует сброс всех in-memory кешей (msp.store, roles.store и т.д.);
если переходить на `router.push` — нужно явно reset'ить все сторы. zcode выбирает и
обосновывает; владелец — на приёмке.

### Фаза Г — Аудит всех непубличных экранов (по канону «проверять сессию»)

Г.1. **Пройти по всем роутам** (из Фазы А.1) и проверить: каждый непубличный роут
либо имеет `meta.public` отсутствует И прикрывается новым auth-гардом, либо имеет
свой гард (как rolesGuard для кабинетов).

Г.2. **Проверить прямые переходы** (e2e): без токена зайти на `/profile/wallet`,
`/profile/orders`, `/profile/settings`, `/profile/addresses`, `/profile/edit`,
`/profile/wallet/transfer`, `/profile/security`, `/profile/balance`, `/cabinet/msp`,
`/cabinet/rep`, `/cabinet/amb`, `/cabinet/team`, `/dash` — все должны редиректить на
`/auth`.

Г.3. **Edge cases**: 
- cart → checkout без токена → редирект на `/auth` (с возвратом после логина);
- magic link → пускает (логинит);
- store/product → пускает (публичные);
- после 401 (невалидный токен) → axios-interceptor сбрасывает + reload → гард редиректит на `/auth`.

### Фаза Д — Тесты

Д.1. **Unit-тесты** на auth-гард: мок `localStorage.loviAccessToken` есть/нет + `meta.public`
— проверка редиректа. Покрыть: публичный роут пускает, защищённый без токена редиректит,
защищённый с токеном пускает.

Д.2. **E2E (Playwright)**: 
- логин → logout → попытка зайти на `/profile` → редирект на `/auth`;
- без токена прямой заход на `/profile/wallet` → редирект `/auth`;
- cart публичный → checkout без токена → редирект `/auth`;
- magic link → пускает + логинит.

Д.3. **Регрессия**: существующие e2e (auth, profile, msp) — не сломать. `yarn test`
зелёный.

### Фаза Е — Документация

Е.1. **Session-док** `lovii-app/docs/sessions/NNN-t021-auth-guard.md`: таблица «было/стало»
по всем роутам (защищён/публичен, гард), коммит beforeEach-гарда, e2e-скрины logout→/auth,
edge cases, вердикт по logout-redirect (В.2).

Е.2. **`canon/FINDINGS.md`**: новый F-NNN «router.beforeEach не проверял авторизацию
(только perfMark); profile+sub-routes доступны без токена; rolesGuard закрывал только
cabinets» — статус «закрыто» после Фазы Б (с ссылкой на коммит).

Е.3. **`as-is/06-vhod-otp.md`** — обновить §«Гард роутера»: было «beforeEach только
perfMark» → стало «auth-гард + meta.public + redirect на /auth».

## Что не делать

- **Не трогать `rolesGuard`** (cabinets) — он проверяет роли поверх авторизации; новый
  auth-гард — общая проверка токена, rolesGuard — конкретная роль. Оба работают вместе.
- **Не ломать `router.onError`** (chunk-recovery, PWA) — отдельный механизм.
- **Не валидировать токен в гарде** (это делает 401-handler на API-вызовах) — гард
  проверяет только присутствие `loviAccessToken`.
- **Не путать `loviAccessToken` и `loviGuestToken`** — guest-токен для публичной
  витрины, не для авторизации.
- **Не блокировать magic link** (SZ-008, P-1) — это flow входа.
- **Не трогать запретные зоны** (WORK_PROTOCOL §1.2): биллинг/`tbank-mock`,
  `ProfileWallet`/`PayCard`/балансы/история (это T-020), чарджбэк `SZ-045`/`F-050`.
  T-021 трогает router + auth-module + profile-module (store/ logout) + e2e.
- **Не force-push**, не в `master` напрямую — PR + зелёный CI.
- **Регламент T-017 Фаза Г**: локально, `yarn test` зелёный, коммит на шаг, session-док
  на шаг, артефакты в каноне, CI зелёный с первого раза.

## Приёмка

1. `router.beforeEach` — проверяет `loviAccessToken` для непубличных роутов, редиректит
   на `/auth` без токена; публичные (`meta.public=true`) пускает.
2. Все непубличные роуты (`/profile*`, `/cabinet/*`, `/dash`) — защищены (либо глобальным
   гардом, либо rolesGuard); прямой заход без токена → `/auth`.
3. Cart публичный, checkout требует токена → редирект `/auth` + возврат после логина.
4. Magic link — пускает (логинит), не блокируется гардом.
5. Logout (`profile.store.ts:121`) — после выхода пользователь на `/auth` (не на
   `/profile` с guest-состоянием); вердикт по В.2 (reload vs router.push) в session-доке.
6. Unit + e2e тесты — зелёные; `yarn test` + CI зелёный с первого раза.
7. FINDINGS F-NNN закрыт; as-is/06 обновлён.
8. Гейты: `yarn test` зелёный (вкл. усиленный DS-guard из T-019, если вмержен);
   `task_guard`/`doc-canon-check --strict`/`fact-guard` зелёные для docs-правок.

## Отчёт исполнителя

_(заполняет zcode: таблица «было/стало» по всем роутам (защищён/публичен/гард), SHA-коммит
beforeEach-гарда + meta.public, e2e-скрины logout→/auth + прямых заходов на sub-роуты,
вердикт по logout-redirect (В.2), результаты `yarn test` + CI, оставшиеся риски.)_

## Приёмка-1

_(независимый факт-чек Super Z — дата, вердикт `Достаточно` / `Доработка: …`.)_

## Приёмка-2

_(владелец — визуальная приёмка: logout → профиль недоступен; прямой заход на
`/profile/wallet`, `/cabinet/msp` без токена → `/auth`; cart→checkout без токена →
`/auth`; magic link работает; вердикт.)_

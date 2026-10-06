# T-014 п.1 — разбор дефекта копирования ссылки-приглашения в кабинете представителя

READ-ONLY анализ. Репозиторий: `/Users/best/LOVII/lovii-app`, HEAD `fe8af79` (branch `staging`), рабочее дерево чистое.
Ветку/сборку/тесты не запускал (запрещено в этом раунде). Ничего в репо не менял.

## Conclusion

1. **Дефект подтверждён и он именно там, где назван владельцем — `src/modules/roles-module/representative/RepresentativeProfile.vue:79`.**
   Конструкция `await navigator.clipboard?.writeText(inviteUrl.value).catch(() => undefined)` не различает успех и отказ, а строки `:80–81` безусловно ставят `copied = true` и показывают тост «Ссылка-приглашение скопирована». Итог: **ложное подтверждение успеха в обоих сценариях** —
   (a) `navigator.clipboard` отсутствует (http/insecure context, старый браузер), (b) `writeText` отклонён (нет разрешения, insecure context, ограничение user-activation). Ни исключения, ни `false` наружу не выходит.

2. **(a) и (b) ведут себя технически по-разному, но приводят к одному и тому же ложному успеху.** Это проверено эмпирически (Node, см. Analysis): при отсутствии `navigator.clipboard` вся цепочка optional chaining короткозамыкается, `.catch(...)` **вообще не вызывается**, промис даже не создаётся — `await undefined` завершается мгновенно. При отклонении `writeText` промис отклоняется, но `.catch(() => undefined)` его глушит. В обоих случаях управление доходит до `copied.value = true` и `showToast("Ссылка-приглашение скопирована")`.

3. **«Молчаливые return» в `referral.ts` — НЕ дефект и правки не требуют.** Форма-гейт (единственная точка проверки — `normalizeReferralCode`, строка `:59–67`) — это корректная семантика чистых функций; `buildReferralUrl` возвращает `null` для мусорного кода осознанно («ссылка с мусором хуже, чем её отсутствие», `:72`). Пользователю уже показывается честное состояние: `inviteUnavailable` (`RepresentativeProfile.vue:65–67`) → текст «Ссылку по этому коду собрать не удалось — код не в формате платформы» (`:153`) и полное отсутствие блока приглашения (`:162–165`), что покрыто тестом (`roles-representative.test.ts:775–784`). **Единственный реально непокрытый и невидимый пользователю отказ — клипборд (`:79`), а не format gate.**

4. **API тостов не имеет вариантов** (`toast.ts:17`, только `showToast(message, durationMs = 4000)`), поэтому «ошибочный» тост — это то же текстовое сообщение, ровно как уже сделано в двух других местах. **Готовый канонический паттерн уже существует и используется в том же продукте для того же текста:** `ProfileModule.vue:323–335` (`try { … showToast("Ссылка-приглашение скопирована") } catch { showToast("Не удалось скопировать") }`) и `ProfileWallet.vue:477–484` (`"Не удалось скопировать номер"`). Дефектный паттерн `?.` + `.catch(()=>undefined)` размножен ровно в трёх местах: `RepresentativeProfile.vue:79`, `AmbassadorReps.vue:69`, `MspPayment.vue:182`.

5. **Отдельного общего хелпера/компонента для клипборда в репозитории нет** (`find src -iname "*copy*"` пусто; `src/package/composables/` содержит только `useDragScroll.ts`; `document.execCommand` в `src/` не используется вовсе). То есть «fallback» надо не переиспользовать, а строить; ближайшая каноничная форма — inline `try/catch` + тост (пп. 4). `@vueuse/core` в зависимостях есть (`package.json:28`), `useClipboard` доступен, но в проекте не используется ни разу — вводить его как новый паттерн не стоит без причины.

## Evidence (file:line)

### Дефект в кабинете представителя
- `src/modules/roles-module/representative/RepresentativeProfile.vue:76–85` — `async function copyInvite()`:
  - `:77` — `if (!inviteUrl.value) return;` (ранний выход, корректно: блока приглашения в DOM нет);
  - `:79` — `await navigator.clipboard?.writeText(inviteUrl.value).catch(() => undefined);` ← **точка дефекта**;
  - `:80` — `copied.value = true;` ← ставится безусловно;
  - `:81` — `showToast("Ссылка-приглашение скопирована");` ← **ложный успех**;
  - `:82–84` — сброс `copied` через 2000 мс.
- `:38` — `const copied = ref(false);`
- `:6` — `import { showToast } from "@/package/global-helpers/toast.ts";`
- `:58` — `const inviteUrl = computed(() => buildReferralUrl(profile.value?.promo_code));`
- `:65–67` — `inviteUnavailable = Boolean(profile.value?.promo_code) && inviteUrl.value === null`
- Триггер: `:177–185` — `<button … data-testid="rep-profile-copy" @click="copyInvite">`; `:183–184` — глиф/подпись `copied ? 'check'/'Скопировано' : 'copy'/'Скопировать ссылку'`.
- Ветка подсказки: `:150–156` (`!inviteUrl`), блок приглашения `v-if="inviteUrl"`: `:162–166`; ссылка текстом: `:173–175` (`data-testid="rep-profile-invite-link"`, обычный `<span>`, выделяемый/читаемый — важно для a11y-риска ниже).

### referral.ts — «молчаливые return»
- `:43` — `PROMO_CODE_PATTERN = /^[A-Z]{2}[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/`
- `:59–67` — `normalizeReferralCode` → `null` при не-строке/несовпадении шаблона (чистая функция, «единственная точка проверки формы», `:56–58`).
- `:74–81` — `buildReferralUrl` → `null` при невалидном коде (`:72` — «ссылка с мусором хуже, чем её отсутствие»); домен по умолчанию `window.location.origin` (`:76`).
- `:87–112` — `parseReferralCode` → `null` при не-строке/пустой строке/неразбираемом URL (`:108–110` catch).
- `:120–136` — `saveReferral` → `null` при невалидном коде (`:123–125`) и при провале записи в `localStorage` (`:131–133`, приватный режим).
- `:142–172` — `getReferral` → `null` при недоступном `localStorage` (`:147–149`), отсутствии записи (`:151–153`), битой/истёкшей записи (с очисткой, `:159–169`).
- `:175–181` — `clearReferral` глушит исключения.
- `:210–242` — `capturePromoFromQuery` → `null` (T-010, универсальная ловля суффиксов).
- Потребители, для которых `null` — норма: `App.vue:53` (`captureReferral`), `auth-api.ts:96` (`withReferral`, поле добавляется только при наличии кода), `AuthPhone.vue:25` (`getReferral()?.code ?? null`), `AuthPromoCode.vue:19–25` (невалидный ручной ввод молча не сохраняется — **решение владельца T-010**, не дефект), `ProfileModule.vue:325` (тот же `buildReferralUrl` — и там уже правильная обработка ошибки клипборда).

### toast API
- `src/package/global-helpers/toast.ts:5–13` — `toast = reactive({ message, visible })`, один активный тост;
- `:17–27` — `export function showToast(message: string, durationMs = 4000): void`. **Вариантов (error/success/info) нет** — только текст и длительность.
- `src/components/Ui/AppToast.vue:9` — `<div v-if="toast.visible" class="app-toast" role="status">` — единственный визуальный стиль, `role="status"` (не `alert`), монтируется один раз в `App.vue:111`.

### Существующие паттерны копирования в `src/` (grep `clipboard`/`writeText`/`execCommand`)
| Файл:строка | Приём | Ложный успех? |
|---|---|---|
| `representative/RepresentativeProfile.vue:79` | `?.` + `.catch(()=>undefined)` + безусловный `copied`/тост | **ДА** |
| `ambassador/AmbassadorReps.vue:69` | то же (тост не показывается, но `copied=true` безусловно) | **ДА (мелкий)** |
| `msp/MspPayment.vue:180–185` | то же | **ДА (мелкий)** |
| `profile-module/ProfileModule.vue:323–335` | `try { await writeText } catch { showToast("Не удалось скопировать") }` | нет — **эталон** |
| `profile-balance/ProfileWallet.vue:477–484` | `try { … "Номер карты скопирован" } catch { "Не удалось скопировать номер" }` | нет — **эталон** |
| `profile-module/components/SettingsSheet.vue:208–220` | `try { await writeText } catch { return; }` (ярлык не врёт) | нет |
- `execCommand` в `src/` — **0 совпадений**. Отдельного `AppCopy`/`CopyButton` компонента нет (в `src/components/Ui/` только `AppButton`, `AppIconButton`, `AppToast` и пр.).

### Тестовые конвенции
- `vitest.config.ts:15` — `environment: "happy-dom"`; `:17` — `setupFiles: ["./src/test-setup.ts"]`; `:18` — `include: ["src/**/*.{test,spec}.ts"]`; `:11–13` — фиксированный `__APP_VERSION__`; `:28–38` — coverage-порог 4%.
- `src/test-setup.ts:1–43` — **только** полифилл `localStorage` (Proxy). Клипборд в setup не патчится.
- `package.json:54` — `happy-dom ^20.8.9`; `:28` — `@vueuse/core ^14.2.1`; `:48` — `@vue/test-utils ^2.4.6`; скрипт `test:unit` = `vitest run` (`package.json:14`).
- Спеки `global-helpers`: `src/package/global-helpers/__tests__/` — `referral.test.ts`, `referral-universal.test.ts`, `safe-json.test.ts`, `address-helpers.test.ts`, `cache-helpers.test.ts`, `color-mode.test.ts`, `error-handler.test.ts`, `motion.test.ts`, `payment-helpers.test.ts`, `price-helpers.test.ts`, `push-helpers.test.ts`.
- `src/package/global-helpers/__tests__/referral.test.ts:1–12` — импорт функций напрямую из `@/package/global-helpers/referral.ts`; `:61–63` опирается на `window.location.origin`; `:65–68` — «не собирает ссылку из невалидного кода» → `toBeNull()`; `:87–95` — мусор → `null`.
- `src/package/global-helpers/__tests__/referral-universal.test.ts:1–4` — `mount` из `@vue/test-utils`, `localStorage.clear()` в `beforeEach`; `:59–90` — монтаж компонента без мока клипборда.
- `src/modules/roles-module/__tests__/roles-representative.test.ts`:
  - `:17` — `vi.mock("@/package/global-helpers/toast.ts", () => ({ showToast: vi.fn() }))` — **тост уже замокан, его вызовы тривиально проверяемы**;
  - `:10–15` — `vi.mock("@/package/config/axios.ts", …)` с `get`/`post`;
  - `:134–157` — `mockApi({ profile, points, approvals })`, фикстура `:56–65` (`promo_code: "AA2222"`);
  - `:159–167` — `mountScreen(component, routeName)` = `mount(comp, { global: { plugins: [testRouter] } })` + `flushPromises()`;
  - `:703–709` — `beforeEach`: `Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })` ← **единственный способ мока в проекте**;
  - `:720–737` — тест успеха: проверяет `writeText` с `` `${window.location.origin}/?ref=AA2222` ``, подпись «Скопировано», смену глифа;
  - `:739–773` — тест разметки приглашения (ссылка текстом, QR — inline SVG);
  - `:775–784` — тест «код из ядра не в формате платформы» (`promo_code: "AA2220"`);
  - `:786–800` — тест «промокода нет».
  - **Теста на отказ клипборда нет ни одного** — то есть текущее ложное подтверждение ничем не зафиксировано.
- `src/modules/roles-module/__tests__/roles-ambassador.test.ts:302–318` — тот же приём мока клипборда + `expect(writeText).toHaveBeenCalledWith("AA2222")`.
- `src/modules/profile-module/components/__tests__/SettingsSheet.test.ts:216–236` — мок `writeText` через `Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })`.
- Мок тоста также в `roles-team.test.ts:23`, `roles-msp.test.ts:21`.
- E2E: `e2e/playwright.config.ts:31` — `permissions: ["geolocation"]`; слова `clipboard` в `e2e/tests`, `e2e/scenarios`, `e2e/helpers`, конфиге — **нет**. Клипборд в E2E не проверяется.

### Окружение/happy-dom (проверено локально, только чтение/Node-eval)
- happy-dom по умолчанию **предоставляет** `navigator.clipboard` (`Clipboard {}`) и его `writeText` **резолвится успешно**. Значит «плохие» ветки (a)/(b) в тестах нужно моделировать явно (reject-мок или `delete navigator.clipboard`), «само» они не воспроизводятся.
- Семантика выражения (Node-eval, оба сценария):
  - `nav = {}` → `nav.clipboard?.writeText("x").catch(…)` → **`.catch` не вызван**, промис не создан, исключения нет → `await` завершается, код идёт дальше;
  - `nav = { clipboard: { writeText: () => Promise.reject(new Error("NotAllowedError")) } }` → **`.catch` вызван**, отказ проглочен.
  - → в обоих случаях достигаются `copied.value = true` (`:80`) и `showToast("Ссылка-приглашение скопирована")` (`:81`).

### История
- `git log -L 76,85:…RepresentativeProfile.vue`: `9791d2c` (2026-09-13) ввёл `copyInvite` с `?.` + `.catch()=>undefined`; `4e89338` добавил строку `showToast("Ссылка-приглашение скопирована")` (`:81`), ужесточив ложь до явного текста «скопирована».

## Analysis

**1. Что именно ломается и когда.**

`copyInvite()` (`RepresentativeProfile.vue:76–85`) вызывается кликом по `rep-profile-copy` (`:177–185`). Логика:
```
if (!inviteUrl.value) return;                       // :77  корректный ранний выход
await navigator.clipboard?.writeText(url).catch(() => undefined);  // :79  ← глушит всё
copied.value = true;                                // :80  безусловно
showToast("Ссылка-приглашение скопирована");        // :81  безусловно
```

- **(a) `navigator.clipboard === undefined`** (не-secure context `http://`, встраиваемые webview, старые браузеры, где Clipboard API не экспонируется). Из-за optional chaining вся цепочка `navigator.clipboard?.writeText(...).catch(...)` **короткозамыкается целиком**: `.catch` не вызывается, промиса/ошибки нет, `await` возвращает `undefined`. → `copied = true`, тост «Ссылка-приглашение скопирована», подпись «Скопировано» и глиф-галочка на 2 секунды. **Клипборд пуст.**
- **(b) `clipboard` есть, но `writeText` отклонён** (`NotAllowedError` — нет разрешения / не-secure context / потерян transient user activation). Промис отклоняется, но `.catch(() => undefined)` **превращает отказ в успех**. → тот же ложный тост и `copied = true`. **Клипборд пуст.**
- Косвенные следствия: пользователь вставляет в мессенджер старый буфер и отправляет не тот текст; ложная галочка на кнопке ломает доверие к интерфейсу; дефект не диагностируем — ни тоста об ошибке, ни лога.

**2. Что в `referral.ts` реально «молчит» и что из этого видно пользователю.**
- `normalizeReferralCode` (`:59–67`) — **чистая функция-предикат**. Возврат `null` здесь — не «проглатывание отказа», а результат проверки. Правки не нужны.
- `buildReferralUrl` (`:74–81`) — **уже проброшен наверх корректно**: компонент читает `=== null` через `inviteUnavailable` (`RepresentativeProfile.vue:65–67`) и показывает честный текст вместо пустоты (`:150–156`, `:153`), а сам блок приглашения не рисуется (`:162`). Это подтверждено тестом `roles-representative.test.ts:775–784` и зафиксировано комментарием-каноном `:60–64`. **Это правильная обработка, а не дефект.**
- `parseReferralCode` (`:87–112`), `saveReferral` (`:120–136`), `getReferral` (`:142–172`) — `null` для мусора/отсутствия/битой записи — **корректное поведение**: приглашение при этом не затирается («пустой или битый заход не меняет ничего», `:116–118`, `:246–248`), что прямо покрыто тестами (`referral.test.ts:115–127`, `:152–167`, `:195–204`). Ни один из этих `null` не является user-facing «отказом»: это фоновое состояние реферальной атрибуции. Молчаливый отказ ручного ввода в `AuthPromoCode.vue:19–25` — **осознанное решение владельца T-010**, задокументировано в `referral.test.ts`/`referral-universal.test.ts:74–87`.
- **Вывод:** единственный «молчаливый отказ», который реально касается пользователя и не подсвечен, — это не format gate, а `catch(() => undefined)` на `RepresentativeProfile.vue:79`. Поверхностная «починка referral.ts» ошибочна и не нужна; нужно починить потребление клипборда.

**3. Тост/варианты.** `showToast(message, durationMs?)` (`toast.ts:17`) — вариантов нет, `AppToast.vue:9` — один стиль, `role="status"`. «Ошибочный» вариант в проекте выражается **текстом** сообщения, а не стилем: `"Не удалось скопировать"` (`ProfileModule.vue:333`), `"Не удалось скопировать номер"` (`ProfileWallet.vue:482`), `"Не удалось сохранить ПИН-код"` (`QuickAccessSheet.vue:89`), `"Не удалось вернуть заявку"` (`RepresentativeApprovals.vue:93`). Т.е. для fallback достаточно `showToast("Не удалось скопировать ссылку")` — **без изменения API тостов**.

**4. Готовый helper / паттерн.** Общего хелпера нет (`src/package/global-helpers/` и `src/package/composables/` его не содержат; `useClipboard` из `@vueuse/core` — доступен, но не используется нигде). Но **есть канонический inline-паттерн** с try/catch и честным тостом (`ProfileModule.vue:323–335`, `ProfileWallet.vue:477–484`), причём в `ProfileModule.vue` он применён **к тому же самому сценарию** — «скопировать реф-ссылку по промокоду» (`:325` вызывает тот же `buildReferralUrl`, `:331` — та же строка «Ссылка-приглашение скопирована»). Это означает: дефект — регресс/несогласованность внутри одной и той же функции продукта, а не отсутствие решения.

**5. Тестовая конвенция** (для будущего теста на fallback): happy-dom + `src/test-setup.ts` (кроме localStorage — ничего); мок клипборда — только через `Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })` (роли-тесты `:703–709`, `roles-ambassador.test.ts:304–307`, `SettingsSheet.test.ts:218–221`); тост в спеках ролей уже замокан (`roles-representative.test.ts:17`) → проверка `showToast` — через импорт мока. В happy-dom `navigator.clipboard` существует и по умолчанию **успешно** резолвится, поэтому failure-кейсы нужно задавать явным reject-моком либо `delete`/`value: undefined`.

**6. Готовый компонент «копировать».** Отсутствует (`find src -iname "*copy*"` — пусто; в `src/components/Ui/` его нет). Каждый экран делает свою кнопку инлайн (`rep-profile__copy`, `amb-invite__copy`, `msp-payment__...`, `profile-copy-card`, `profile-promo-copy`). Никакого `AppCopy` «уже решающего эту задачу» в репозитории нет.

## Gaps and risks

1. **Риск регресса на secure-context браузерах.** Успешный путь (`writeText` резолвится) должен остаться ровно таким же: `copied = true` + тост «Ссылка-приглашение скопирована» + смена глифа. Существующий тест `roles-representative.test.ts:720–737` жёстко проверяет и `writeText(url)`, и подпись «Скопировано», и оба глифа — при правке он обязан остаться зелёным без изменения ожиданий.
2. **Не менять порядок `copied`/тост.** Если переносить `copied = true` в `try`-блок, надо не забыть сохранить 2-секундный сброс (`:82–84`) и его вызов только на успехе; иначе кнопка «залипнет» в «Скопировано» или перестанет показывать подтверждение.
3. **Отсутствие проверки ветки (a).** Optional chaining делает «нет Clipboard API» неотличимым от «скопировано». Нужен явный предикат (`typeof navigator.clipboard?.writeText !== "function"` либо `try/catch` без `?.`), иначе ветка (a) так и останется ложным успехом даже после «починки» catch.
4. **A11y — не сломать уже существующее решение.** Ссылка уже отдана читаемым/выделяемым текстом (`:173–175`) ровно потому, что «QR сам по себе не читается скринридером и не копируется» (комментарий-канон `:159–161`). Fallback не должен заменять/прятать этот `<span>` или делать копирование единственным путём; независимо от этого ссылку можно выделить вручную. Тост `role="status"` уместен (не `alert`), менять не нужно.
5. **`execCommand("copy")` — ловушка.** Напрашивающийся «настоящий fallback» через `document.execCommand` в проекте не используется нигде, устарел и требует выделения текста; вводить его как новое решение рискованно (в т.ч. для дизайн/поведенческого канона). Безопаснее — честный тост об ошибке + сохранить выделяемый текст, не плодить неработающий второй путь.
6. **Единообразие vs scope.** Тот же дефект живёт в `AmbassadorReps.vue:69` и `MspPayment.vue:182`. Если чинить только представителя — останется несогласованность (и вопрос владельцу на будущее). Если выносить helper — растёт scope и появляется новый файл в `global-helpers/`, что должно быть отдельным осознанным решением.
7. **Design-system guard — ратчет.** `src/__tests__/design-system.guard.test.ts:1–40` валит тест при появлении новых литералов radius/shadow/color. Если появится новый компонент/разметка (например, кнопка `AppCopy`) — обязаны использовать токены канона; правка `design-system.baseline.json` — отдельное видимое решение, а не побочный эффект.
8. **Пробелы в покрытии (не риски, а факты).** Failure-путь клипборда не покрыт ни одним тестом ни в `roles-representative.test.ts`, ни в `roles-ambassador.test.ts`, ни в `SettingsSheet.test.ts`; E2E клипборд не проверяет вовсе (`e2e/playwright.config.ts:31` — только geolocation). В happy-dom «нет клипборда» не воспроизводится по умолчанию — нужен явный мок.
9. **Непроверенное в этом раунде.** Реальное поведение на конкретных целевых браузерах/стендах (стоит ли стенд на https, есть ли у PWA установленного режима своя политика разрешений) я не проверял — тесты/сборку/браузер не запускал по условию задачи. Утверждение о «insecure context ⇒ clipboard undefined» — из спецификации Clipboard API, не из замера на этом стенде.

## Suggested placement

**Основное изменение — точечное, внутри существующего компонента (без новых сущностей):**
- `src/modules/roles-module/representative/RepresentativeProfile.vue`, функция `copyInvite` (`:76–85`) — привести к каноническому паттерну `ProfileModule.vue:323–335`: обернуть `writeText` в `try/catch`, `copied = true` и успешный тост — **только** на успехе, в `catch` — `showToast("Не удалось скопировать ссылку")` (текст-конвенция канона), при отсутствии `navigator.clipboard?.writeText` — идти тем же `catch`-путём (не через `?.`, а через явную проверку/`try`).
- Сопутствующая правка текста подсказки/поведения **не требуется**: `inviteUnavailable` (`:65–67`) и hint (`:150–156`) уже честные.

**Тест — там же, где уже живёт покрытие этого экрана:**
- `src/modules/roles-module/__tests__/roles-representative.test.ts`, блок `describe("RepresentativeProfile — промокод, счётчики, честный ранг")` (`:702`), рядом с тестом копирования (`:720–737`). Использовать уже существующий мок тоста (`:17`) и приём `Object.defineProperty(navigator, "clipboard", …)` (`:705–708`): (1) `writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError"))` → ожидать тост об ошибке и **отсутствие** подписи «Скопировано»; (2) `value: undefined`/`delete` → тот же результат. Существующий успешный тест не трогать.

**Опционально (вне обязательного scope T-014 п.1, отдельным решением):**
- Если владелец захочет закрыть дефект системно — вынести общий `copyText(text): Promise<boolean>` в `src/package/global-helpers/clipboard.ts` (рядом с `safe-json.ts`/`toast.ts`) и переиспользовать в `AmbassadorReps.vue:67–74` и `MspPayment.vue:180–185`; тесты — `src/package/global-helpers/__tests__/clipboard.test.ts` по образцу `referral.test.ts` (чистый unit без mount). Это единственный вариант, который убирает все три ложных успеха; вводить его как «побочный эффект» исправления одного экрана не стоит.
- `@vueuse/core`'s `useClipboard` не рекомендую: доступен (`package.json:28`), но нигде в проекте не используется; канон репозитория — простой `try/catch` (`ProfileModule.vue`, `ProfileWallet.vue`).

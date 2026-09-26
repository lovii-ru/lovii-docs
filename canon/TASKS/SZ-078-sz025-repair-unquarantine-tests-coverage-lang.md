# SZ-078 — Ремонт SZ-025 (passkeys/device registry): раскарантинить тесты, восстановить coverage 70%, починить lang-ключи

> Статус: **Открыта** (но **отложена** — после T-018, T-021, T-019, T-020; не давит на текущую очередь zcode)
> Приоритет: **P2** · Источник: хвост F-064 (разблокировка b2b PR #1 через карантин SZ-025-тестов + снижение coverage порога 70→66) · Исполнитель: **zcode** · Репо: `lovii-b2b` (+ `lovii-core` при необходимости) + `lovii_docs` (session-док, FINDINGS) · Дата постановки: 2026-09-26
> Зависимость: T-022 (pin php base images) — желательно вмержен, но не блокирует (SZ-078 про тесты, не про образ).

## Контекст

Разблокировка b2b PR #1 (T-017 Фаза В-b2b, 26.09) потребовала временных мер:
- **Карантин SZ-025-тестов** (`@group wip-webauthn`, `sz025-quarantine`, `PartnerSecurityTest` и др. — 28 тестов из ~574) — они не проходили из-за 14-суточной дивергенции (master-линия staging-кода: device registry, passkeys, ключи локализации).
- **Coverage порог снижен 70→66** (ci.yml, `3f9cff8`) — карантин снял ~4% покрытия.
- **`--parallel` убран** из CI pest-команды (paratest не пробрасывает `--exclude-group` в воркеры — найдено zcode, F-064).
- **Missing lang-ключи** — в SZ-025 (passkeys/security blade) есть ключи перевода, которых нет в lang-файлах.

Это технический долг. SZ-078 его закрывает: код SZ-025 доводится до рабочего состояния, тесты раскарантинены, coverage восстановлен, lang-ключи добавлены.

### Канон (B4 + решения владельца по SZ-025)

SZ-025 = «Безопасность кабинета: сессии, устройства, Passkeys» — device registry, auth audit, logout-everywhere, WebAuthn passkeys. Реализовано 10.09 (`f8100ee`), но тесты сломаны «с рождения» (мастер-линия красная с 10–11.09). Корень поломки — 14-суточная дивергенция master↔staging + внешние факторы (pest dev, PHP 8.5.11), найден и починен в F-064. Теперь код-база стабильна, и SZ-025-тесты можно довести.

### Ключевые файлы (для zcode)

- `app/Domain/Auth/Services/WebAuthn/` — `WebAuthnService.php` (512), `CborDecoder.php`, `CoseKey.php`, `AuthenticatorData.php`, `Base64Url.php`.
- `app/Models/B2b/PartnerAuthEvent.php` + `app/Enums/PartnerAuthEvent.php` — коллизия имён (починена алиасом в F-064, проверить, что алиас на месте).
- `tests/Feature/Auth/PartnerSecurityTest.php`, `PasskeyLoginTest.php`; `tests/Unit/WebAuthn/CborCoseTest.php`, `WebAuthnServiceTest.php`; `tests/Support/SyntheticAuthenticator.php`.
- `ci.yml` — coverage порог (66 временно), `--parallel` (убран, вернуть после раскарантина если paratest починят exclude-group в воркерах).
- lang-файлы: `lang/ru/auth.php`, `lang/ru/security.php` (или где ключи passkeys/security).

## Что сделать

### Фаза А — Инвентарь карантина (read-only)

А.1. Список всех тестов в группах `wip-webauthn`, `sz025-quarantine` + `PartnerSecurityTest` + др. — файл, что тестируют, почему не проходят (QueryException? миграции? lang-ключи? device registry данные?).

А.2. Список missing lang-ключей (запустить тесты, собрать ключи, которых не хватает).

А.3. Проверить алиас `PartnerAuthEvent` (модель/enum коллизия из F-064) — на месте, не сломан ли.

### Фаза Б — Починить код SZ-025 (чтобы тесты проходили)

Б.1. Device registry + auth audit — проверить, что БД/миграции корректны (`partner_security_tables` миграция `2026_09_11_100001`), данные тестов соответствуют схеме.

Б.2. Passkeys/WebAuthn — `SyntheticAuthenticator` генерит валидные CBOR/CoseKey данные; `WebAuthnService` корректно верифицирует; `CborDecoder` бинарно-безопасный (zcode фиксил mb_* '8bit' — проверить, что фикс на месте).

Б.3. Lang-ключи — добавить недостающие в lang-файлы (ru/en).

### Фаза В — Раскарантинить + восстановить coverage

В.1. Снимать `@group`-карантины с тестов по мере починки (по одному, с прогоном).

В.2. Восстановить coverage порог 66→70 в `ci.yml` (когда все тесты раскарантинены и покрытие вернулось).

В.3. Рассмотреть возврат `--parallel` (если paratest v7.24.1 починил проброс `--exclude-group` в воркеры — проверить; если нет — оставить непараллельный, скорость вторична).

### Фаза Г — Документация

Г.1. Session-док `lovii-b2b/docs/sessions/NNN-sz078-sz025-repair.md` — что починено, какие тесты раскарантины, coverage до/после, lang-ключи.

Г.2. `canon/FINDINGS.md` — обновить F-064 (хвост SZ-078 закрыт) + любые новые находки (если в коде SZ-025 найдены баги).

Г.3. `as-is/05-rol-i-kabinety.md` — обновить §про security/passkeys (если менялось).

## Что не делать

- **Не трогать запретные зоны** (WORK_PROTOCOL §1.2): биллинг/`tbank-mock`, `ProfileWallet`/`PayCard` (T-020), чарджбэк SZ-045/F-050. SZ-078 — про security/passkeys тесты.
- **Не начинать SZ-078 до T-018, T-021, T-019, T-020** (или до явного «го» владельца) — zcode токен-экономно, сначала приоритетные.
- **Не поднимать coverage порог выше 70** (канон) без решения владельца.
- **Регламент T-017 Фаза Г** — локально (`vendor/bin/pint --test && rector --dry-run && phpstan && pest`), зелёный CI с первого раза (или обоснованное исключение «внешний upstream-дрейф» — фикс в WORK_PROTOCOL §1.1, если повторится).

## Приёмка

1. Все SZ-025-тесты раскарантинены (`@group`-метки сняты) и проходят (546+ → ~574+).
2. Coverage порог восстановлен 66→70, CI зелёный.
3. Missing lang-ключи добавлены (ru/en), тесты на ключи проходят.
4. `--parallel` — вердикт (вернуть если paratest починил, оставить непараллельным если нет).
5. Session-док + FINDINGS обновлены.

## Отчёт исполнителя

_(заполняет zcode: таблица раскарантиненных тестов, SHA-коммиты, coverage до/после, lang-ключи, вердикт по --parallel.)_

## Приёмка-1

_(независимый факт-чек Super Z — дата, вердикт `Достаточно` / `Доработка: …`.)_

## Приёмка-2

_(владелец — дата, вердикт.)_

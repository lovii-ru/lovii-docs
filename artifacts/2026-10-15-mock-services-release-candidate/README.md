# Контрольная сборка кандидата продукта mock-services — 2026-10-15

Статус: **собрана; отличия ждут утверждения владельцем.**
Постановка: `HANDOFF-2026-10-15-mock-services-night.md` (в этом каталоге).
Источник: `rucorp/mock-services` @ `main` **`0137c65`** — «docs: зачистка внутренних артефактов
(ревизия SZ)» (PR #135, влит 20:49 МСК). Репо чистое, открытых PR нет.

## Артефакты сборки (вне git)
- Папка: `~/LOVII/mock-services-release-candidate-2026-10-15/` — 88 файлов (+ 120 файлов статики сайта).
- Архив: `~/LOVII/mock-services-release-candidate-2026-10-15.zip` — 2 334 934 байт;
  sha256 `6a11e3685100be9e2d60bb19ee499a2f6d38582cb5bc957a46366c4d0c6ea061`.
- Список файлов (без `dist/`): `files-list.txt`; полный — в архиве; отличия — `diff-vs-0.7.0.txt`.

## Состав сборки
| Раздел | Состав |
|---|---|
| Сервисы | `services/` — 10 адаптеров (alfa, atol, first-ofd, kassa, kontur-ofd, sber, taxcom, tbank, vtb, yookassa); у kontur/taxcom — доп. `drift.js` (нужен selftest'ам) |
| Ядро | `packages/core/` — index.js, selftest.js, README.md |
| Протоколы | `protocols/` — 9 манифестов (у ЮKassa манифеста нет намеренно) |
| Compose | `docker-compose.yml` (dev, из исходников), `docker-compose.include.yml` (полный, digest-пин 0.7.0), `docker-compose.staging.yml` (банк+касса) |
| Документация | `README.md`; `docs/integration/` ×10; `docs/openapi/` ×9; `docs/overview.md`, `docs/capabilities.md`, `docs/hardening.md`, `docs/roadmap.md`, `docs/tables.md`, `docs/rfc/RFC-001-multi-tenant-sandboxes.md` |
| Док-сайт | `site-build/**` (VitePress 1.6.4, изолированные зависимости), `_sidebar.md` (навигация), `dist/` (собранная статика, base `/mock-services/`) |
| Прочее | `scripts/docker-healthcheck.js`, `LICENSE`, `NOTICE`, `package.json` |

## Прогоны (независимо; координатор, 2026-10-15, 21:01–21:04 МСК)
- `npm test` @ 0137c65 — **EXIT=0**: core 84 · tbank ✅ · kassa 176 · yookassa 250 · atol 228 ·
  alfa 377 · sber 71 · vtb 85 · first-ofd 108 · kontur-ofd 109 · taxcom 106 (все 0 failed);
  check:links 33 ✅ · check:site 32 ✅ · check:tables 71/27 ✅ · check:env ✅ (с известным
  include-долгом `KNOWN_INCLUDE_DEBT`) · check:drift 827/827 ✅.
- `site-build` → `npm test` — ✅: 32 страницы, базы `/mock-services/` и `/`, legacy routes OK.
- Выжимка логов: `npm-test-0137c65-summary.txt` (полный лог ~210 КБ — у координатора).
- CI: PR #135 — зелёный (CI 23 мин, док-сайт 29 мин); main-прогоны после мержа — в очереди
  self-hosted (координатор следит, доложит при отклонениях).

## Отличия от одобренного образца 0.7.0 (на утверждение владельца)
- **Добавлено (24):** Такском (сервис — 4 файла, гайд, OpenAPI, манифест); док-сайт `site-build/**` (10)
  + `_sidebar.md`; доки `docs/overview|capabilities|hardening|roadmap|tables.md` + `docs/rfc/RFC-001…`;
  собранная статика `dist/` (120 файлов).
- **Удалено (2):** `docs/integration/lovii.md`, `protocols/upstream-snapshot.json`.
- **Изменено:** `README.md` (после #130), compose×3 (10 сервисов), `package.json` (10 сервисов);
  сервисы/гайды — в рамках #124–#135 (вывод ИС, нейтрализация).
- **Структура:** сохранена repo-раскладка (`docs/integration`, `docs/openapi`, `scripts/…`);
  в образце 0.7.0 было уплощение (`integration/`, `openapi/`, `docker-healthcheck.js` в корне).

## Открытые решения (владельцу)
1. **Dockerfile ↔ `docker-compose.yml`:** dev-compose собирает `build: .`, Dockerfile в составе нет.
   Рекомендация: добавить `Dockerfile` в состав.
2. **CONTRIBUTING / SECURITY / AGENTS / CHANGELOG:** README, `_sidebar.md` и страницы сайта на них
   ссылаются; спека относит их к «инфраструктуре разработки», в кандидат они не включены (но их
   страницы уже внутри собранной статики). Решить: держать в продукте или чистить ссылки и manifest.
3. **Адаптация под автономность (спека §2.2):** в кандидате пока не работает `npm test`
   (check-скрипты не входят) — следующий блок после утверждения состава.
4. Мелочи: `.nojekyll`, `.dockerignore`, `.gitignore` не включены (деплой артефактом; нет Dockerfile;
   zip-формат). `package.json` → `files` (npm-pack, с 08.10) устарел — обновить при финализации.
5. К сведению: в хендоффе осталась формулировка «продуктовый релиз — в отдельном репо»; спека 15.10
   и воркфлоу: продукт = `rucorp/mock-services`, отдельный не создаём. Подтвердить актуальность.

## Следующее
Утверждение отличий/решений владельцем → адаптация и упаковка 0.8 → волны сайта DOC (арена) по ходу.

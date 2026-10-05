# Манифест санитизации — что вычищено / чего нет в пакете

Проверено grep'ом по всему пакету. Данные состояния на 2026-10-05.

## Нет в пакете (и не должно попасть)

- Любые значения секретов: GitHub Secrets (DEPLOY_SSH_KEY, DEPLOY_HOST,
  DEPLOY_USER, DEPLOY_PATH — в workflows только имена-ссылки `${{ secrets.* }}`);
- Содержимое `.env` серверов (токены ботов MAX/TG/VK, терминалы Т-Банка,
  T-API токен, пароли БД/Redis/Meilisearch, OTP-секреты);
- `.credentials` файлы раннеров (registration token) — из раннеров взят только
  `.runner` (agentId/agentName/labels, без токенов);
- mTLS-сертификаты и ключи Т-Банка (serт, приватные ключи, CA-бандлы);
- `authorized_keys` сервера (в пакете только список комментариев-имён ключей
  в ACCESS-MATRIX репо, не сами ключи);
- IP-адрес сервера и домены намеренно оставлены (публичные), но в связке с
  «этот сервер держит банковский контур» — пометка для аудита, не утечка.

## Что вместо секретов в файлах

- compose-файлы: только `${VAR}`-ссылки на .env сервера — литералов нет
  (проверено grep'ом token|secret|password|key);
- workflows: `${{ secrets.* }}`;
- gostiny-deploy: registry/token приходят по stdin при вызове, на диске не
  хранятся (видно в коде wrapper'а).

## Если найден секрет

Любая модель/агент, нашедший в пакете что-то, похожее на секрет, должен
пометить это как CRITICAL-находку, а не использовать. Утечка секрета из
пакета = ротация всего задетого (см. RULES.md §2).

## Инвентарь файлов пакета (R-0.4)

Актуальный снимок на 2026-10-05. В таблице перечислены все файлы `audit-bundle/`,
кроме этого манифеста (самоссылочный SHA-256 не включается). Поля: путь,
размер в байтах, SHA-256. Перегенерировать таблицу после каждой правки пакета.

| Путь | Байты | SHA-256 |
|---|---:|---|
| `./ARENA-FOLLOWUP-ZCODE-WAVE2-2026-10-05.md` | 16682 | `a856058d16471d9fc8671aabfa337d48d7821032b35b240335ef0d3e50dce5ea` |
| `./ARENA-INBOX-2026-10-05.md` | 4986 | `4cd45952e2285fd2da799bce10b78c17e96ca0c236e32ff4c5ad707986f87076` |
| `./AUDIT-CONTROL-2026-10-05.md` | 23567 | `2bbc84e969011f0eb4f8921ededbad7090cb889d43419d2bb43cb5dc36757ff0` |
| `./AUDIT-FINDINGS-2026-10-05.md` | 28235 | `5b408c00506eda71eec888428351705f78a3a487baf63b9ea1a8c1692005b625` |
| `./AUDIT-RECONCILIATION-2026-10-05.md` | 6969 | `787973156c150fbad0c15c3981d2fe35e28c060d2a119aa2f8f4305fb25d184a` |
| `./AUDIT-RESPONSE-ZCODE-R2-2026-10-05.md` | 6451 | `7962456107ed0ef46173de632f79a73c4b15f2b08158542eb37b47e422514eba` |
| `./AUDIT-VERDICT-ZCODE-2026-10-05.md` | 5899 | `6e80e66cb827b2d4ece9e7f628cd8fa8022ccd78f8200cdb08e4a6af6611063f` |
| `./BASELINE-RECOMMENDATIONS.md` | 4914 | `a59994745ddb2562c52567157fe31af2bbb3b81fe39ee903a2123ef6da849aef` |
| `./EXECUTION-WAVE2-2026-10-05.md` | 4845 | `5d15377bd39012444e15583ce0f0e05d8e5c8d40cc01c8a901c60fd8b12491be` |
| `./INFRA-CONTEXT.md` | 4896 | `4e114fbbc4f9fbd1b07ef4ac321985b9074ca6626502cb421fa244db5871c701` |
| `./README.md` | 2481 | `a51dd859ccdd4dd38ce739549322fb6032568101cbfad50827b61e9a9b33a65a` |
| `./infra/compose-core-prod.yml` | 13616 | `a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87` |
| `./infra/compose-core-staging.yml` | 13616 | `a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87` |
| `./infra/compose-gateway.yml` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `./infra/compose-lovii-admin.yml` | 2862 | `a208c83d2a30a4f8160390ee95d74174dddbcbd159e55e140efe5a6912790b4e` |
| `./infra/compose-lovii-app.yml` | 1464 | `e366305f5098e890894b91022b5ecdee348e5a7555f622cb823f6daaf5a78367` |
| `./infra/compose-lovii-b2b.yml` | 3912 | `3c2830ccd27728fdb93b2d09ad138f3e6ed4c9857da5015cc9754aa0f6d80169` |
| `./infra/crontab.txt` | 575 | `bc4968db68de0fb6b7c0895d6a482004b6d0ae39ac97071ecc2a68e923c4a37e` |
| `./infra/gostiny-deploy.sh` | 2055 | `b3721df6e589a09573aa010ec8ad02a3d60bf563e316623f1238cbca399c4784` |
| `./infra/runner-admin.json` | 302 | `05b73fed212fadc5bc586ee5e8bc2568ee5b83ac2223b83e0c6a1ba3b5ace53d` |
| `./infra/runner-app.json` | 298 | `6280323b742ad1130e5b5a26f93a17ba955442b7fce0a269f84544f425bf9fd2` |
| `./infra/runner-b2b.json` | 298 | `d237103e6c089c1f3c7abd5b5c258235563ee2200d87b017f8dd36ae7ad92fbb` |
| `./infra/runner-core.json` | 300 | `55fcc601802db22eb3c175f9b3b1bb82b3d15b4fe9e9224e09565c458ef63ad9` |
| `./workflows/lovii-admin/ci.yml` | 12244 | `72df6b79992f7c0ac432e8f0b993115c516cc0e98eb7ac251ab0253f83494158` |
| `./workflows/lovii-app/ci.yml` | 10578 | `79d38a2d1acb4f73c347217d5d947934f0e4431b215a86b7bdd44b41a1697a9a` |
| `./workflows/lovii-b2b/ci.yml` | 13649 | `9fdc77e1ce575f1b828b6b54f896b5bda8b3658af58716c735f6410c95b67697` |
| `./workflows/lovii-core/ci.yml` | 15138 | `cb197bf12a6a09e63c7bebc8932a06636c8c6036fb5e735578612810255e4063` |

Снимки `workflows/*/ci.yml` в этом пакете отражают состояние после Волны 1.
Серверный `lovii-deploy` и скрипты Волны 2 здесь пока не экспортированы;
для контрольных вопросов и требуемых доказательств см. `ARENA-FOLLOWUP-ZCODE-WAVE2-2026-10-05.md`.

Команда для сверки отдельного файла из корня репозитория:
`sha256sum audit-bundle/<путь>`.

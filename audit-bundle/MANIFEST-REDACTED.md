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

## Инвентарь (sha256, генерируется при сборке — R-0.4)

Финал 05.10: включает EXECUTION-WAVE3-CLOSEOUT.

```
84ca6419e30603279198cfd726628ee7cf1bda17ea456c2a5806900159e60cd0  audit-bundle/.DS_Store
a856058d16471d9fc8671aabfa337d48d7821032b35b240335ef0d3e50dce5ea  audit-bundle/ARENA-FOLLOWUP-ZCODE-WAVE2-2026-10-05.md
8b05df6bff447f65e5d81364007da1cb595eb905136f1aaef26b447d1efecbb9  audit-bundle/ARENA-FOLLOWUP-ZCODE-WAVE3-2026-10-05.md
4e3b648c85dfe694afde6ccbbe675b59c89eba2d0f6a8834e67974b8b55d13a2  audit-bundle/ARENA-INBOX-2026-10-05.md
2bbc84e969011f0eb4f8921ededbad7090cb889d43419d2bb43cb5dc36757ff0  audit-bundle/AUDIT-CONTROL-2026-10-05.md
25aaf33ee0f3454130d91c7170958dc1d0fd8a6c3f6b75fea9aad74dfab1fc40  audit-bundle/AUDIT-CONTROL-R3-2026-10-05.md
5b408c00506eda71eec888428351705f78a3a487baf63b9ea1a8c1692005b625  audit-bundle/AUDIT-FINDINGS-2026-10-05.md
787973156c150fbad0c15c3981d2fe35e28c060d2a119aa2f8f4305fb25d184a  audit-bundle/AUDIT-RECONCILIATION-2026-10-05.md
7962456107ed0ef46173de632f79a73c4b15f2b08158542eb37b47e422514eba  audit-bundle/AUDIT-RESPONSE-ZCODE-R2-2026-10-05.md
6e80e66cb827b2d4ece9e7f628cd8fa8022ccd78f8200cdb08e4a6af6611063f  audit-bundle/AUDIT-VERDICT-ZCODE-2026-10-05.md
a59994745ddb2562c52567157fe31af2bbb3b81fe39ee903a2123ef6da849aef  audit-bundle/BASELINE-RECOMMENDATIONS.md
5d15377bd39012444e15583ce0f0e05d8e5c8d40cc01c8a901c60fd8b12491be  audit-bundle/EXECUTION-WAVE2-2026-10-05.md
a13b5ce1d7de60038c4196466fb6c07d9741b1bda5b1fe744f7a98b5eb45e5d1  audit-bundle/EXECUTION-WAVE3-2026-10-05.md
1ce720512e3243b64e689a3a6823d50d56611d5bd6ba330f47f6f058aeb1d549  audit-bundle/EXECUTION-WAVE3-CLOSEOUT-2026-10-05.md
e1a2bc46fa0fae09801ab1fbe6dbf3556bd1ff40e2f7ed1001719eebc41bbda8  audit-bundle/INFRA-CONTEXT.md
a51dd859ccdd4dd38ce739549322fb6032568101cbfad50827b61e9a9b33a65a  audit-bundle/README.md
a3ab5abc5bfbdbe0294dfa02e6d013cb868b661f1ce7d9cfee79302cae316c87  audit-bundle/infra/compose-core-prod.yml
b707d02fedac42b529c1b819e53e264fa5cb43898cc088d110d080abbb0ae777  audit-bundle/infra/compose-core-staging-extras.yml
b74a32680da25b814dda1d44a8692047bdb752e53d0c155c900cf9b4aa628cc9  audit-bundle/infra/compose-core-staging.yml
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  audit-bundle/infra/compose-gateway.yml
a208c83d2a30a4f8160390ee95d74174dddbcbd159e55e140efe5a6912790b4e  audit-bundle/infra/compose-lovii-admin.yml
e366305f5098e890894b91022b5ecdee348e5a7555f622cb823f6daaf5a78367  audit-bundle/infra/compose-lovii-app.yml
3c2830ccd27728fdb93b2d09ad138f3e6ed4c9857da5015cc9754aa0f6d80169  audit-bundle/infra/compose-lovii-b2b.yml
1c9b73c8f48c7e21971eb35a2cc31d8ffb4ac0eb832ceaafe53297759f9b0583  audit-bundle/infra/crontab.txt
b3721df6e589a09573aa010ec8ad02a3d60bf563e316623f1238cbca399c4784  audit-bundle/infra/gostiny-deploy.sh
3b95a53f31bd66353d3bf24ba1d01b2556d5bacca770a7cb1cef35ed511f069f  audit-bundle/infra/lovii-deploy.sh
05b73fed212fadc5bc586ee5e8bc2568ee5b83ac2223b83e0c6a1ba3b5ace53d  audit-bundle/infra/runner-admin.json
6280323b742ad1130e5b5a26f93a17ba955442b7fce0a269f84544f425bf9fd2  audit-bundle/infra/runner-app.json
d237103e6c089c1f3c7abd5b5c258235563ee2200d87b017f8dd36ae7ad92fbb  audit-bundle/infra/runner-b2b.json
55fcc601802db22eb3c175f9b3b1bb82b3d15b4fe9e9224e09565c458ef63ad9  audit-bundle/infra/runner-core.json
62a7558c4806942c7d1fb7ab3c8cb2a6ef5594d8d6ddfcdb2e7e8eb649c47783  audit-bundle/infra/runners-compose.yml
d4194966bba8c9b52cbf7f86d0c86ab6edbadbc9ea32e61fdf88b43b8c1b7b86  audit-bundle/workflows/.DS_Store
746a908523c89e8ddfb9b8661a1f06f51dde651559d66c4b0fae18922eabacf6  audit-bundle/workflows/lovii-admin/ci.yml
74d88cf76dbac3bd363f3b862505052273bfb7e0a4ad66e8f55176ea6fd3c2ad  audit-bundle/workflows/lovii-app/ci.yml
1f868f469d0282ea3d88f6a94a2d44352d3c6698a8dc1a3a7e1902481757ffa1  audit-bundle/workflows/lovii-b2b/ci.yml
795eda4ec2b564dddbf6a76fa25dd1a483d54cfe0d48884c7b952cf249c363f5  audit-bundle/workflows/lovii-core/ci.yml
```

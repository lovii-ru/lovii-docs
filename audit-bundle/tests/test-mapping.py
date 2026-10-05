#!/usr/bin/env python3
"""A4 mapping/unit tests — воспроизводимые тесты lovii-deploy v3 (по ревью арены).

Проверяет инварианты тегирования lovii-deploy v3+:
  T1  правильные маппинги всех 4 репо — зелёные;
  T2  врущий маппинг (core: app→scheduler) — красный (uncovered);
  T3  app-репо: сервис app вместо web — красный (uncovered);
  T4  web=nginx:latest (чужой target) — красный (сторонний target);
  T5  web=произвольный registry — красный (сторонний target).

Запуск: python3 test-mapping.py  (без зависимостей, python >= 3.7)
Выход: exit 0 = все тесты зелёные; exit 1 = красный (список отказов).
"""

THIRD_PARTY_PREFIXES = (
    "redis:", "imresamu/", "getmeili/", "node:", "alpine:", "docker:",
    "postgres:", "mysql:", "library/", "nginx:",
)

def is_third_party(img: str) -> bool:
    return any(img.startswith(p) for p in THIRD_PARTY_PREFIXES)

# Ожидаемые таблицы пакет→сервисы (копия логики lovii-deploy v3)
EXPECTED_PKGS = {
    "lovii-core": {
        "app":        {"package": "lovii-core-app",        "services": ["app"]},
        "worker":     {"package": "lovii-core-worker",     "services": ["horizon", "telegram-poller-orders", "telegram-poller-otp", "telegram-poller-support"]},
        "scheduler":  {"package": "lovii-core-scheduler",  "services": ["scheduler"]},
    },
    "lovii-app": {
        "app":        {"package": "lovii-app",             "services": ["web"]},
    },
    "lovii-b2b": {
        "app":        {"package": "lovii-b2b-app",         "services": ["app"]},
        "scheduler":  {"package": "lovii-b2b-scheduler",   "services": ["scheduler"]},
        "queue":      {"package": "lovii-b2b-queue",       "services": ["queue"]},
    },
    "lovii-admin": {
        "app":        {"package": "lovii-admin-app",       "services": ["app"]},
        "scheduler":  {"package": "lovii-admin-scheduler", "services": ["scheduler"]},
    },
}

# Фикстуры compose config --format json (срез SRV 05.10)
FIXTURES = {
    "lovii-core": {"services": {
        "app": {"image": "lovii-core-staging/app"},
        "horizon": {"image": "lovii-core-staging/worker"},
        "scheduler": {"image": "lovii-core-staging/scheduler"},
        "telegram-poller-orders": {"image": "lovii-core-staging/worker"},
        "telegram-poller-otp": {"image": "lovii-core-staging/worker"},
        "telegram-poller-support": {"image": "lovii-core-staging/worker"},
        "redis": {"image": "redis:alpine"},
        "meilisearch": {"image": "getmeili/meilisearch:v1.40.0"},
        "pgsql": {"image": "imresamu/postgis:17-3.5-alpine"},
    }},
    "lovii-app": {"services": {
        "web": {"image": "lovii-app-staging/web"},
    }},
    "lovii-b2b": {"services": {
        "app": {"image": "lovii-b2b-staging/app"},
        "scheduler": {"image": "lovii-b2b-staging/scheduler"},
        "queue": {"image": "lovii-b2b-staging/queue"},
        "redis": {"image": "redis:alpine"},
    }},
    "lovii-admin": {"services": {
        "app": {"image": "lovii-admin-staging/app"},
        "scheduler": {"image": "lovii-admin-staging/scheduler"},
    }},
}

def audit(repo, compose_services, pkgs=None):
    """Список отказов A4 для (репо, compose-сервисы, таблица пакетов)."""
    pkgs = pkgs or EXPECTED_PKGS[repo]
    fails = []
    # 1. каждый сервис таблицы существует в compose
    for pkgkey, spec in pkgs.items():
        for svc in spec["services"]:
            if svc not in compose_services:
                fails.append(f"{repo}: сервис {svc} (пакет {pkgkey}) отсутствует в compose")
    # 2. strict allowlist image-строки: сервис из таблицы должен иметь
    #    image стека (префикс <repo>-staging/) — сторонний/чужой регистри = отказ
    for pkgkey, spec in pkgs.items():
        for svc in spec["services"]:
            img = compose_services.get(svc, {}).get("image", "")
            if not img:
                continue
            if is_third_party(img):
                fails.append(f"{repo}: сторонний target {svc}={img}")
            # строгая проверка: локальный образ сервиса обязан принадлежать
            # пакету: суффикс образа = суффикс пакета (core-worker → /worker)
            # допустимый суффикс образа: для пакетов вида <repo>-<x> → /<x>;
            # для базового пакета (lovii-app) → /<имя сервиса> (web)
            base = f"lovii-{repo.split('-')[-1] if False else ''}"
            pkg_name = spec["package"]
            if pkg_name == "lovii-app":
                allowed_suffix = f"/{svc}"
            else:
                allowed_suffix = "/" + pkg_name.split("-", 2)[-1]
            stack_prefix = f"{repo}-staging/"
            if not (img.startswith(stack_prefix) and img.endswith(allowed_suffix)):
                fails.append(f"{repo}: строгий allowlist: {svc}={img} (ожидался *{allowed_suffix})")
    # 3. reverse coverage: не-сторонний образ compose обязан быть покрыт
    covered = set(s for spec in pkgs.values() for s in spec["services"])
    for name, svc in compose_services.items():
        img = svc.get("image", "")
        if not is_third_party(img) and name not in covered:
            fails.append(f"{repo}: {name}={img} не покрыт таблицей")
    return fails

TESTS = [
    ("T1 core правильный",              "lovii-core",  {}),
    ("T1 app правильный (web)",         "lovii-app",   {}),
    ("T1 b2b правильный",               "lovii-b2b",   {}),
    ("T1 admin правильный",             "lovii-admin", {}),
    ("T2 core врущий app→scheduler",    "lovii-core",
     {"app": {"image": "lovii-core-staging/scheduler"}}),
    ("T3 app-репо: app вместо web",     "lovii-app",
     {"web": {"image": "lovii-app-staging/app"},
      "app": {"image": "lovii-app-staging/app"}}),
    ("T4 web=nginx:latest",             "lovii-app",
     {"web": {"image": "nginx:latest"}}),
    ("T5 web=чужой registry",           "lovii-app",
     {"web": {"image": "evil-registry.example.com/app:latest"}}),
]

overall_fails = []
for name, repo, override in TESTS:
    services = dict(FIXTURES[repo]["services"])
    services.update(override)
    fails = audit(repo, services)
    expect_red = name.startswith(("T2", "T3", "T4", "T5"))
    status = "🔴 КРАСНЫЙ" if fails else "🟢 зелёный"
    print(f"{name}: {status}")
    for f in fails:
        print(f"   - {f}")
    if expect_red and not fails:
        overall_fails.append(f"{name}: ожидали КРАСНЫЙ, получили зелёный")
    if not expect_red and fails:
        overall_fails.append(f"{name}: ожидали зелёный: {fails}")

print()
if overall_fails:
    print("ИТОГ: КРАСНЫЙ")
    for f in overall_fails:
        print(" !", f)
    raise SystemExit(1)
print("ИТОГ: ЗЕЛЁНЫЙ — T1×4 зелёные, негативные T2–T5 красные как ожидалось")

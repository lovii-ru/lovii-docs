#!/usr/bin/env python3
"""lv_runtime_audit.py — рантайм-обход роутов lovii-demo в headless chromium (SZ-062, фаза 5).

По каждому роуту × вьюпорт × тема собирает:
  - ошибки консоли и pageerror;
  - SVG с фактическим размером 0×0 (баг класса «стрелок профиля», RES-009 §1);
  - горизонтальное переполнение документа;
  - скриншот (если --shots DIR).

Известная ловушка: у баннера демо setInterval — НЕ использовать
wait_until="networkidle" (виснет); используем "load" + явный таймаут.

Использование:
  python3 lv_runtime_audit.py [BASE_URL] [--demo-root /путь/к/lovii-demo] \
      [--shots DIR] [--routes "#/home,#/orders,..."]
  BASE_URL по умолчанию https://lovii.mobiap.com/
Выход: exit 1 — если найдены ошибки консоли / SVG 0×0 / переполнения; иначе 0.
"""
import argparse
import sys
from pathlib import Path

DEFAULT_ROUTES = [
    "#/home", "#/popular", "#/stores", "#/orders", "#/auth",
    "#/settings", "#/wallet", "#/addresses",
    "#/dash", "#/dash/rep", "#/dash/amb", "#/dash/owner", "#/dash/investor",
    "#/msp", "#/cab/rep", "#/cab/amb", "#/cab/msp",
]
VIEWPORTS = [(390, 844), (768, 1024), (1280, 800)]
THEMES = ["light", "dark"]


def audit_route(page, url, theme, shots_dir, name):
    problems = []
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))

    page.set_viewport_size({"width": page.viewport_size["width"], "height": page.viewport_size["height"]})
    page.goto(url, wait_until="load")
    page.wait_for_timeout(900)
    if theme == "dark":
        page.evaluate("document.documentElement.setAttribute('data-theme','dark')")
        page.wait_for_timeout(250)

    zero_svg = page.evaluate(
        """() => [...document.querySelectorAll('svg')]
            .map(s => { const r = s.getBoundingClientRect();
                        return {cls: s.getAttribute('class')||'', w: r.width, h: r.height}; })
            .filter(s => s.w < 1 || s.h < 1)"""
    )
    overflow = page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    if console_errors:
        problems += [f"console: {e[:160]}" for e in console_errors]
    if zero_svg:
        problems += [f"svg 0×0: .{s['cls']} ({s['w']:.0f}x{s['h']:.0f})" for s in zero_svg[:8]]
    if overflow > 0:
        problems.append(f"горизонтальное переполнение: +{overflow}px")

    if shots_dir and not problems:
        safe = name.strip("#/").replace("/", "_") or "root"
        page.screenshot(path=str(shots_dir / f"{safe}.png"), full_page=False)
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="https://lovii.mobiap.com/")
    ap.add_argument("--demo-root", default=None, help="клон демо — взять роуты из parseHash (не реализовано, базовый набор)")
    ap.add_argument("--shots", default=None)
    ap.add_argument("--routes", default=None, help="через запятую, например '#/home,#/orders'")
    ap.add_argument("--viewports", default="390", help="например 390,1280")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright  # noqa: import здесь — быстрый фейл без playwright

    routes = [r.strip() for r in args.routes.split(",")] if args.routes else DEFAULT_ROUTES
    vps = [(int(w), 800) for w in args.viewports.split(",")]
    shots_dir = Path(args.shots) if args.shots else None
    if shots_dir:
        shots_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for w, _h in vps:
            ctx = browser.new_context(viewport={"width": w, "height": 844})
            page = ctx.new_page()
            page.set_viewport_size({"width": w, "height": 844})
            for theme in THEMES:
                for route in routes:
                    url = args.base.rstrip("/") + "/" + route
                    try:
                        problems = audit_route(page, url, theme, shots_dir, route)
                    except Exception as e:  # навигация может кинуть на редиректах
                        problems = [f"nav/error: {str(e)[:160]}"]
                    status = "🟩" if not problems else "🟥"
                    print(f"{status} {w}px {theme:5s} {route:24s} " + ("; ".join(problems[:4]) if problems else "ok"))
                    total += len(problems)
            ctx.close()
        browser.close()

    print(f"\nИтог: {total} проблем(ы)")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()

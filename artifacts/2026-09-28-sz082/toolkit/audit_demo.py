#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SZ-082 Phase A — lovii-demo (static site: design/*.html, js/*.js) auditor (READ-ONLY).
Screens/scripts not referenced by entry points (index.html, other js/html) -> candidates.
SCREEN_MAP.md (Draft, prose) -> names diff reported as inventory (P3, manual сверка 50 роутов).
Usage: python3 audit_demo.py <demo_root> <out_dir> [--repo-name demo] [--screen-map path]
"""
import os, re, sys, argparse
from lib_common import (LIVE, Candidate, iter_files, read_text, write_report, git_head)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root'); ap.add_argument('out_dir')
    ap.add_argument('--repo-name', default='demo')
    ap.add_argument('--screen-map', default='')
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    cands = []

    html = [f for f in iter_files(root, ('.html',)) if '/design/' in f.replace('\\', '/')]
    js = [f for f in iter_files(os.path.join(root, 'js'), ('.js',))]
    # entry points: index.html + all other js/html (referenced if name appears anywhere else)
    corpus = [os.path.join(root, 'index.html')] + js + html
    corpus = [f for f in corpus if os.path.exists(f)]

    def refs_for(base):
        ev = []
        for f in corpus:
            if os.path.abspath(f) == os.path.abspath(target_path):
                continue
            txt = read_text(f)
            rel = os.path.relpath(f, root)
            for i, line in enumerate(txt.splitlines(), 1):
                if re.search(rf"[\w/\-]*{re.escape(base)}\.(?:js|html)\b", line):
                    ev.append(f"{rel}:{i}: {line.strip()[:120]}")
                    if len(ev) >= 8:
                        return ev
        return ev

    items = [(f, 'design-screen') for f in html] + [(f, 'js-script') for f in js]
    for path, kind in items:
        base = os.path.basename(path)
        stem = base.rsplit('.', 1)[0]
        target_path = path
        ev = refs_for(stem)
        if ev:
            continue
        c = Candidate(cid=f"demo:{kind}:{base}", repo=args.repo_name, kind=kind,
                      path=os.path.relpath(path, root),
                      why='файл не упомянут ни одним другим html/js (включая index.html) — вне навигации')
        c.add('S1_crossref', ev)
        c.add('S2_screen_map', [f"SCREEN_MAP: упоминание"] if args.screen_map and stem.lower() in read_text(args.screen_map).lower() and os.path.exists(args.screen_map) else [])
        out = cands
        if c.verdict() != LIVE:
            out.append(c)

    # inventory: SCREEN_MAP screen names vs files (P3 ручная сверка «50 роутов»)
    map_names = []
    if args.screen_map and os.path.exists(args.screen_map):
        map_names = re.findall(r"Экран\s*[«\"]([^»\"]+)[»\"]", read_text(args.screen_map))

    meta = {'head': git_head(root), 'screens_map_names': map_names[:40],
            'map_status': 'Draft (prose) — машинная сверка 50 роутов невозможна, см. отчёт',
            'html_files': len(html), 'js_files': len(js)}
    jp, mp = write_report(args.out_dir, args.repo_name, cands, meta)
    print(f"[{args.repo_name}] html={len(html)} js={len(js)} candidates={len(cands)} -> {mp}")


if __name__ == '__main__':
    main()

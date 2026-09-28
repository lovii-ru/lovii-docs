#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SZ-082 Phase A — lovii-core auditor (READ-ONLY).
Scans: commands/jobs/events/listeners/services-actions-classes/config keys w/o usages,
public API endpoints vs client repos.
Usage:
  python3 audit_core.py <core_root> <out_dir> [--clients dir1,dir2]
False-positive traps encoded (from the card):
  * artisan Commands: checked against schedule sources (routes/console.php, Kernel, config, cron docs)
  * Events: checked against listener auto-discovery (EventServiceProvider, AsEventListener)
  * Public API: endpoints searched in CLIENT repos, not only in core
  * Migrations: never scanned (hard-coded in lib)
"""
import os, re, sys, argparse
from lib_common import (Candidate, iter_files, read_text, search, write_report, git_head, LIVE)

KIND_DIRS = {
    'command': ('app/Console/Commands',),
    'job': ('app/Jobs',),
    'event': ('app/Events',),
    'listener': ('app/Listeners',),
    'class': ('app/Services', 'app/Actions', 'app/Support', 'app/Http/Controllers',
              'app/Http/Resources', 'app/Http/Middleware', 'app/Repositories'),
}


def php_files(root):
    return iter_files(root, ('.php',))


def fqcn_of(root, path):
    rel = os.path.relpath(path, root).replace('/', '\\')[:-4]
    return 'App' + rel[3:] if rel.startswith('app') else rel


def class_candidates(root, files, out_cands, kind, dirs):
    all_php = files
    targets = []
    for d in dirs:
        full = os.path.join(root, d)
        if os.path.isdir(full):
            targets += [f for f in iter_files(full, ('.php',))]
    for t in sorted(set(targets)):
        if kind == 'class' and ('/Console/Commands/' in t.replace('\\', '/')):
            continue  # already owned by 'command' kind — prevents double-reporting
        base = os.path.basename(t)[:-4]
        fq = fqcn_of(root, t)
        rel = os.path.relpath(t, root)
        c = Candidate(cid=f"core:{kind}:{base}", repo='core', kind=f'php-{kind}',
                      path=rel, why=f'PHP {kind}: нет ни imports (use), ни FQCN-упоминаний в кодовой базе')
        c.add('S1_import', search(root, all_php, rf"use\s+App\\[\w\\]*{re.escape(base)}\s*;", exclude_path=t))
        c.add('S2_fqcn', search(root, all_php, rf"App\\[\w\\]*{re.escape(base)}\b", exclude_path=t))
        if c.verdict() == 'LIVE':
            continue
        c.add('S3_shortname', search(root, all_php, rf"\b{re.escape(base)}\b", exclude_path=t))
        if kind == 'command':
            sig = re.search(r"\$signature\s*=\s*['\"]([\w:\-]+)", read_text(t))
            if sig:
                s = sig.group(1)
                sched = [f for f in all_php if any(k in f for k in ('routes/console.php', 'Kernel', 'bootstrap/app'))]
                sched += iter_files(root, ('.md',))  # cron docs / deploy runbooks
                c.add('S_schedule', search(root, sched, re.escape(s)))
                if c.verdict() == 'LIVE':
                    continue
                c.add('S_sig_str', search(root, all_php, re.escape(s), exclude_path=t))
        if kind == 'event':
            c.add('S_listener_reg', search(root, all_php, rf"{re.escape(base)}\b",
                                           exclude_path=t))  # EventServiceProvider::$listen / AsEventListener — попадание = AMBIGUOUS
        if c.verdict() != LIVE:
            out_cands.append(c)  # CANDIDATE и AMBIGUOUS оба попадают в отчёт


def audit_config_keys(root, files, out_cands):
    cfg_dir = os.path.join(root, 'config')
    if not os.path.isdir(cfg_dir):
        return
    all_php = files
    for f in sorted(iter_files(cfg_dir, ('.php',))):
        base = os.path.basename(f)[:-4]
        refs = search(root, all_php, rf"config\(\s*['\"]{re.escape(base)}[.\['\"]", exclude_path=f)
        # config files may also be used via Config::get — second strategy
        refs2 = search(root, all_php, rf"Config::get\(\s*['\"]{re.escape(base)}[.\['\"]", exclude_path=f)
        if refs or refs2:
            continue
        c = Candidate(cid=f"core:config:{base}", repo='core', kind='config-key',
                      path=os.path.relpath(f, root),
                      why="config-файл: ни config('file.…'), ни Config::get('file.…') в кодовой базе")
        c.add('S1_config_call', refs)
        c.add('S2_config_facade', refs2)
        c.add('S3_name_ref', search(root, all_php, rf"\b{re.escape(base)}\b", exclude_path=f))
        if c.verdict() != LIVE:
            out_cands.append(c)


def audit_public_api(root, files, out_cands, clients):
    """Route URI in core routes/*.php -> search in client repos. Never P1: max CANDIDATE with manual note."""
    route_files = [f for f in iter_files(os.path.join(root, 'routes'), ('.php',))]
    uris = set()
    rx = re.compile(r"Route::(?:get|post|put|patch|delete|any)\(\s*['\"]([^'\"]+)['\"]")
    for rf in route_files:
        for m in rx.finditer(read_text(rf)):
            uris.add((m.group(1), os.path.relpath(rf, root)))
    client_files = []
    for cl in clients:
        if not os.path.isdir(cl):
            print(f"  !! client dir not found (пропущен): {cl}", file=sys.stderr)
            continue
        client_files += [f for f in iter_files(cl, ('.ts', '.js', '.vue', '.tsx', '.json'))]
    for uri, rfrom in sorted(uris):
        if uri in ('/', '{any}'):
            continue
        frag = re.escape(uri).replace(r'\{[^}]+\}', '[^\'\"]+') if '{' in uri else re.escape(uri)
        frag = re.sub(r"\\\{[^}]+\\\}", "[^'\"]+", frag)
        c = Candidate(cid=f"core:api:{uri}", repo='core', kind='api-endpoint',
                      path=f"{rfrom} → {uri}",
                      why='маршрут не найден ни в одном клиентском репо (api-клиенты), ни в core-тестах')
        c.add('S_client_call', search(os.path.dirname(root) or '/', client_files, frag))
        test_files = [f for f in files if '/tests/' in f or '/Test/' in f]
        c.add('S_core_tests', search(root, test_files, frag))
        doc_files = iter_files(root, ('.md',))
        c.add('S_docs', search(root, doc_files, frag))
        if c.verdict() != LIVE:
            c.priority = 'P2'  # public API — never auto-P1 (card rule)
            out_cands.append(c)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root'); ap.add_argument('out_dir')
    ap.add_argument('--clients', default='')  # comma-separated client repo roots for API cross-check
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    files = php_files(root)
    cands = []
    for kind, dirs in KIND_DIRS.items():
        class_candidates(root, files, cands, kind, dirs)
    audit_config_keys(root, files, cands)
    clients = [c for c in args.clients.split(',') if c]
    if clients:
        audit_public_api(root, files, cands, clients)
    meta = {'head': git_head(root), 'exclusions': 'database/migrations (hard rule), vendor, storage',
            'clients': clients or '—'}
    jp, mp = write_report(args.out_dir, 'core', cands, meta)
    print(f"[core] candidates={len(cands)} -> {mp}")


if __name__ == '__main__':
    main()

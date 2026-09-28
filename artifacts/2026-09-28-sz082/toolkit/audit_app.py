#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SZ-082 Phase A — lovii-app auditor (READ-ONLY).
Scans: vue-components w/o imports, orphan routes, scss, icons usage, PWA junk.
Usage: python3 audit_app.py <app_repo_root> <out_dir> [--icons-dict <path>] [--exclude-glob p1,p2]
Exclusions example (design-session zone): "src/modules/**/otp*,src/**/audit-fixes*"
"""
import os, re, sys, argparse
from lib_common import (LIVE, Candidate, iter_files, read_text, search, all_src_files,
                        write_report, git_head, kebab, HARD_EXCLUDE_PARTS)


def build_excludes(root: str, globs):
    rx = [re.compile(g.strip().replace('**/', '(?:.*/)?').replace('*', '[^/]*')) for g in globs if g.strip()]
    files = all_src_files(root)
    if not rx:
        return files
    kept = []
    for fp in files:
        rel = os.path.relpath(fp, root).replace('\\', '/')
        if any(r.match(rel) or r.match(os.path.basename(rel)) for r in rx):
            continue
        kept.append(fp)
    return kept


def audit_components(root, files, out_cands):
    vue = [f for f in files if f.endswith('.vue')
           and not any(d in f for d in ('/views/', '/pages/', '/screens/'))]  # views owned by route auditor
    bases = {os.path.basename(v)[:-4]: v for v in vue}
    code = [f for f in files if f.endswith(('.ts', '.js', '.vue', '.tsx'))]
    for name, path in sorted(bases.items()):
        if name in ('App',):
            continue
        c = Candidate(cid=f"app:vue:{name}", repo='app', kind='vue-component',
                      path=os.path.relpath(path, root),
                      why='.vue файл: нет строгих импортов имени файла ни в одном src-файле')
        c.add('S1_import', search(root, code, rf"[\w/\.\-]*{re.escape(name)}(\.vue)?['\"]", exclude_path=path))
        c.add('S2_dyn_import', search(root, code, rf"import\(\s*['\"][^'\"]*{re.escape(name)}", exclude_path=path))
        if c.verdict() == 'LIVE':
            continue
        kb = kebab(name)
        c.add('S3_template_tag', search(root, [f for f in files if f.endswith('.vue')],
                                        rf"<{re.escape(kb)}[\s>/]", exclude_path=path))
        c.add('S4_global_reg', search(root, [f for f in code if f.endswith(('.ts', '.js'))],
                                      rf"component\(\s*['\"]{re.escape(kb)}['\"]"))
        if c.verdict() != LIVE:
            out_cands.append(c)


ROUTE_RX = re.compile(r"component\s*:\s*\(\)\s*=>\s*import\(\s*['\"]([^'\"]+)['\"]")
ROUTE_PATH_RX = re.compile(r"path\s*:\s*['\"]([^'\"]+)['\"]")


def audit_routes(root, files, out_cands):
    router_files = [f for f in files if 'router' in f and f.endswith(('.ts', '.js'))]
    imported, route_paths = set(), []
    for rf in router_files:
        txt = read_text(rf)
        for m in ROUTE_RX.finditer(txt):
            imported.add(os.path.basename(m.group(1)))
        for m in ROUTE_PATH_RX.finditer(txt):
            route_paths.append((os.path.relpath(rf, root), m.group(1)))
    views = [f for f in files if f.endswith('.vue') and ('views' in f or 'pages' in f or 'screens' in f)]
    for v in views:
        base = os.path.basename(v)[:-4]
        if base in imported:
            continue
        c = Candidate(cid=f"app:route:{base}", repo='app', kind='route-orphan-screen',
                      path=os.path.relpath(v, root),
                      why='view/screen не встречается в component:()=>import(...) ни одного router-файла')
        c.add('S_route_record', search(root, router_files, re.escape(base), exclude_path=v))
        c.add('S1_import', search(root, [f for f in files if f.endswith(('.ts', '.js', '.vue'))],
                                  rf"[\w/\.\-]*{re.escape(base)}(\.vue)?['\"]", exclude_path=v))
        if c.verdict() != LIVE:
            out_cands.append(c)


def audit_scss(root, files, out_cands):
    scss = [f for f in files if f.endswith('.scss')]
    others = [f for f in files if not f.endswith('.scss')] + scss
    for s in scss:
        base = os.path.basename(s)[:-5]
        c = Candidate(cid=f"app:scss:{base}", repo='app', kind='scss',
                      path=os.path.relpath(s, root),
                      why='.scss: нет @use/@import базового имени ни в одном src-файле (включая другие scss)')
        c.add('S1_scss_ref', search(root, others, rf"@(?:use|import)[^;]*{re.escape(base)}", exclude_path=s))
        c.add('S2_any_ref', search(root, others, rf"['\"][^'\"]*{re.escape(base)}\.scss['\"]", exclude_path=s))
        if c.verdict() != LIVE:
            out_cands.append(c)


def audit_icons(root, files, out_cands, dict_path):
    """Collect icon-name usages. If canon dict provided -> diff vs dictionary."""
    usage = {}
    rx = re.compile(r"(?:name|icon)\s*:\s*['\"]([\w\-]+)['\"]|<(?:AppIcon|BaseIcon|VIcon)[^>]*name=['\"]([\w\-]+)['\"]")
    for f in files:
        for m in rx.finditer(read_text(f)):
            n = m.group(1) or m.group(2)
            if n:
                usage[n] = usage.get(n, 0) + 1
    if dict_path and os.path.exists(dict_path):
        dict_names = set(re.findall(r"['\"]([\w\-]+)['\"]", read_text(dict_path)))
        for n in sorted(set(usage) - dict_names):
            out_cands.append(Candidate(
                cid=f"app:icon:{n}", repo='app', kind='icon-outside-dictionary', path=n,
                why=f"иконка используется ({usage[n]}×), но отсутствует в канон-словаре иконок ДС"))
        for n in sorted(dict_names - set(usage)):
            out_cands.append(Candidate(
                cid=f"app:icon-dict-unused:{n}", repo='app', kind='icon-unused', path=n,
                why='иконка в словаре ДС, но ни одного использования в src не найдено'))
    return usage


def audit_pwa(root, files, out_cands):
    pub = os.path.join(root, 'public')
    if not os.path.isdir(pub):
        return
    pub_files = iter_files(pub)
    ref_files = files + [os.path.join(root, 'index.html')] if os.path.exists(os.path.join(root, 'index.html')) else files
    ref_names = '\n'.join(read_text(f) for f in ref_files)
    for pf in pub_files:
        base = os.path.basename(pf)
        if base in ('manifest.webmanifest', 'manifest.json', 'sw.js', 'service-worker.js', 'robots.txt', 'favicon.ico'):
            continue  # entry points by convention
        rel = os.path.relpath(pf, root)
        if base not in ref_names and rel.replace('public/', '') not in ref_names:
            c = Candidate(cid=f"app:pwa:{rel}", repo='app', kind='pwa-asset',
                          path=rel, why='файл в public/: имя не встречается в src, index.html и манифестах')
            c.add('S_manifest', search(root, [f for f in iter_files(root, ('.json', '.js', '.html', '.ts')) if 'manifest' in f or 'sw' in f or f.endswith('index.html')], re.escape(base)))
            if c.verdict() != LIVE:
                out_cands.append(c)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root'); ap.add_argument('out_dir')
    ap.add_argument('--icons-dict', default='')
    ap.add_argument('--exclude-glob', default='')
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    excludes = [e for e in args.exclude_glob.split(',') if e]
    files = build_excludes(root, excludes)
    cands = []
    audit_components(root, files, cands)
    audit_routes(root, files, cands)
    audit_scss(root, files, cands)
    usage = audit_icons(root, files, cands, args.icons_dict)
    audit_pwa(root, files, cands)
    meta = {'head': git_head(root), 'exclusions': excludes or '—', 'icon_usage_count': len(usage)}
    jp, mp = write_report(args.out_dir, 'app', cands, meta)
    print(f"[app] candidates={len(cands)} -> {mp}")


if __name__ == '__main__':
    main()

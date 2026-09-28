#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SZ-082 Phase A — lovii-b2b / lovii-admin (Filament) auditor (READ-ONLY).
Checks Filament Resources vs PanelProvider registrations.
  * explicit ->resources([...])  : resource not in list => candidate (S_registration decides)
  * ->discoverResources(dir,...) : everything under dir is AUTO-registered => LIVE by fact;
                                   report records the discovery mode (no false positives).
Usage: python3 audit_filament.py <repo_root> <out_dir> [--repo-name b2b]
"""
import os, re, sys, argparse
from lib_common import LIVE, Candidate, iter_files, read_text, search, write_report, git_head


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root'); ap.add_argument('out_dir')
    ap.add_argument('--repo-name', default='filament')
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    files = iter_files(root, ('.php',))
    cands = []

    providers = [f for f in files if ('Filament' in f and 'Provider' in f) or 'PanelProvider' in f]
    explicit, discovery = set(), []
    for p in providers:
        txt = read_text(p)
        for m in re.finditer(r"(?:->)?resources\(\s*\[(.*?)\]", txt, re.S):
            for rm in re.finditer(r"([\w\\\\]+Resource)::class", m.group(1)):
                explicit.add(rm.group(1).split('\\')[-1])
        for m in re.finditer(r"discoverResources\(\s*(?:in:\s*)?[^,]+?,\s*(?:for:\s*)?['\"]([^'\"]+)['\"]", txt):
            discovery.append((os.path.relpath(p, root), m.group(1)))

    res_dir = os.path.join(root, 'app', 'Filament')
    resources = iter_files(res_dir, ('.php',)) if os.path.isdir(res_dir) else []
    for r in resources:
        base = os.path.basename(r)[:-4]
        rel = os.path.relpath(r, root)
        c = Candidate(cid=f"{args.repo_name}:filament:{base}", repo=args.repo_name,
                      kind='filament-resource', path=rel,
                      why='Filament Resource отсутствует в явной регистрации PanelProvider и не покрыт discoverResources')
        c.add('S_registration', [f"registered: {b}" for b in sorted(explicit) if b == base])
        covered = False
        for _, ns in discovery:
            if rel.startswith('app/Filament'):
                covered = True
        c.add('S_discovery', [f"discoverResources namespace: {ns} (покрывает app/Filament/**)" for _, ns in discovery] if covered else [])
        c.add('S_other_refs', search(root, files, rf"\b{re.escape(base)}\b", exclude_path=r))
        if c.verdict() != LIVE:
            cands.append(c)

    meta = {'head': git_head(root),
            'mode': f"explicit={len(explicit)}, discovery={len(discovery)}",
            'providers': [os.path.relpath(p, root) for p in providers]}
    jp, mp = write_report(args.out_dir, args.repo_name, cands, meta)
    print(f"[{args.repo_name}] resources={len(resources)} explicit={len(explicit)} discovery={len(discovery)} candidates={len(cands)} -> {mp}")


if __name__ == '__main__':
    main()

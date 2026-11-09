#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (C) 2026 D-LAB-5
"""
Start Claude Code in this repository with the product's application
repositories added (shared.json's app_repos), found beside this one:

    ../<this>-shared   here: the docs, and the session's settings and memory
    ../<app repo>      each added with --add-dir when it is there

Run it through start-claude.sh (Linux, macOS) or start-claude.cmd (Windows).
Anything after the command goes to claude as it is, e.g.
`./start-claude.sh --continue`. `--print-command` only shows what would run.

A repository that is not beside this one is named with the command that
clones it, and left out: the session starts anyway.

Python's standard library only: Python is on every computer that runs an
edge, Node is not.
"""

import json
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def app_dirs():
    try:
        shared = json.loads((REPO / "shared.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        sys.exit(f"cannot read shared.json: {exc}")
    found = []
    for entry in shared.get("app_repos") or []:
        repo = str(entry.get("repo", "")) if isinstance(entry, dict) else str(entry)
        if not repo:
            continue
        here = REPO.parent / repo.split("/")[-1]
        if (here / ".git").exists():
            found.append(here)
        else:
            print(f"not beside {REPO.name}: {repo}  (gh repo clone {repo} {here})", file=sys.stderr)
    return found


def main(argv):
    dry = "--print-command" in argv
    rest = [a for a in argv if a != "--print-command"]
    args = [a for d in app_dirs() for a in ("--add-dir", str(d))] + rest
    if dry:
        print(" ".join(["claude"] + [shlex.quote(a) for a in args]))
        return 0
    exe = shutil.which("claude")     # on Windows this finds claude.exe or the claude.cmd shim
    if not exe:
        print("Claude Code (`claude`) is not installed or not on PATH", file=sys.stderr)
        return 1
    try:
        return subprocess.call([exe] + args, cwd=REPO)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

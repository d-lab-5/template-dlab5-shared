#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copy the ontology from the app repository where its source lives (its build
# and backend need it there) into ontology/ for the docs. Where it is and which
# files to copy are in shared.json: "ontology": {"source": …, "files": […]}.
#
#   scripts/sync-ontology.sh [--check] [<source folder>]
#
# The source folder defaults to shared.json's, relative to this repository,
# or $ONTOLOGY_SOURCE. --check copies nothing and exits 1 when they differ.
# CI cannot run it when the app repository is private; run it before a push.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
check=0
if [[ "${1:-}" == "--check" ]]; then check=1; shift; fi
conf() { node -e 'const o=require(process.argv[1]).ontology; if(!o){process.exit(3)} console.log(process.argv[2]==="files"?(o.files||[]).join("\n"):(o.source||""))' "$here/shared.json" "$1"; }
if ! conf source >/dev/null; then echo "shared.json has no ontology: nothing to sync" >&2; exit 2; fi
given="${1:-${ONTOLOGY_SOURCE:-$(conf source)}}"
[[ -n "$given" ]] || { echo "shared.json's ontology has no source: pass the folder" >&2; exit 2; }
[[ "$given" = /* ]] && src="$given" || src="$here/$given"
mapfile -t files < <(conf files)
(( ${#files[@]} )) || { echo "shared.json's ontology lists no files" >&2; exit 2; }
if [[ ! -d "$src" ]]; then
  echo "no ontology at $src (pass the folder, or set ONTOLOGY_SOURCE)" >&2
  exit 2
fi
differ=0
for f in "${files[@]}"; do
  [[ -f "$src/$f" ]] || { echo "missing in the source: $f" >&2; exit 2; }
  if ! cmp -s "$src/$f" "$here/ontology/$f"; then
    differ=1
    if (( check )); then echo "differs: ontology/$f" >&2; else mkdir -p "$(dirname "$here/ontology/$f")"; cp "$src/$f" "$here/ontology/$f"; echo "copied ontology/$f"; fi
  fi
done
if (( check )); then
  (( differ )) && { echo "run scripts/sync-ontology.sh to copy the ontology" >&2; exit 1; }
  echo "ontology matches $src"
elif (( ! differ )); then
  echo "ontology already matches $src"
fi

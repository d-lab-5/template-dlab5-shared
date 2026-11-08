#!/usr/bin/env bash
# Test the template by using it: make a product's docs repo with sample
# answers (from the working tree, so uncommitted changes count), then prove
# the result works as a product would use it.
#
#   ./test.sh             a product without an ontology, and one with
#   KEEP=1 ./test.sh      leave the made repositories behind to inspect
#
# For each:
#   1. copier copy; the answers become shared.json, the skeleton files exist
#   2. npm ci, npm run check and npm run site pass; site.json says what it holds
#   3. --base: every internal link in the built pages resolves under it
#   4. a link to a private app repository fails the check
#   5. copier update to a newer template changes the template's files and
#      leaves the product's alone
set -euo pipefail
cd "$(dirname "$0")"
COPIER=${COPIER:-$(command -v copier || echo "$HOME/.local/share/dlab5-tools/copier/bin/copier")}
[ -x "$COPIER" ] || { echo "copier is needed: python3 -m venv ~/.local/share/dlab5-tools/copier && ~/.local/share/dlab5-tools/copier/bin/pip install copier"; exit 1; }
WORK=$(mktemp -d "${TMPDIR:-/tmp}/shared-template-test.XXXXXX")
cleanup() { if [ "${KEEP:-0}" = 1 ]; then echo "  kept: $WORK"; else rm -rf "$WORK"; fi; }
trap cleanup EXIT
commit() { git -c user.email=t@example.com -c user.name=t commit -qm "$1"; }

# the template as it is in this working tree, committed in a scratch copy
TPL="$WORK/template"
mkdir -p "$TPL" && cp -r copier.yml template "$TPL"/
(cd "$TPL" && git init -q -b main && git add -A && commit v1 && git tag v1)

make() {   # name, extra copier args...
  local name=$1; shift
  local dst="$WORK/$name"
  "$COPIER" copy --trust --defaults --quiet --vcs-ref HEAD \
    --data product="Demo $name" --data domain=erp-lab-5 \
    --data description="A demo product for the template's test." \
    --data app_repos="ERP-LAB-5/demo-app*, ERP-LAB-5/demo-tools" "$@" "$TPL" "$dst"
  (cd "$dst" && git init -q -b main && git add -A && commit made)
  echo "$dst"
}

check_site() {   # dir, slug, ontology(0|1)
  local dst=$1 slug=$2 onto=$3
  (cd "$dst"
   npm ci --ignore-scripts --silent --no-audit --no-fund >/dev/null
   npm run -s check
   npm run -s site >/dev/null
   node -e '
     const m = require("./_site/site.json");
     const want = { slug: process.argv[1], domain: "erp-lab-5" };
     for (const [k, v] of Object.entries(want)) if (m[k] !== v) throw new Error(`site.json ${k}: ${m[k]}`);
     if (m.counts.adrs !== 1) throw new Error("site.json counts the ADRs wrong");
     if ((m.counts.classes > 0) !== (process.argv[2] === "1")) throw new Error("site.json counts the classes wrong");' "$slug" "$onto"
   [ -f _site/index.html ] && [ -f _site/adr/0001-record-architecture-decisions.html ] && [ -f _site/roadmap.html ]
   if [ "$onto" = 1 ]; then [ -f _site/ontology/index.html ]; else [ ! -e _site/ontology ] && ! grep -q 'href="ontology/"' _site/index.html; fi
   if [ "$onto" = 0 ]; then [ ! -e _site/CNAME ]; fi
   # under a base, as docs.dlab5.net builds it: every relative link resolves inside _site
   node scripts/site.mjs --base "/erp-lab-5/$slug/" >/dev/null
   node -e '
     const fs = require("fs"), path = require("path");
     const root = path.resolve("_site"), base = process.argv[1];
     const pages = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : p.endsWith(".html") && pages.push(p); } })(root);
     let bad = 0;
     for (const p of pages) {
       if (path.relative(root, p).startsWith("diagrams/") && !p.endsWith("index.html")) continue;   // Archify pages carry their own links
       for (const [, href] of fs.readFileSync(p, "utf8").matchAll(/(?:href|src)="([^"#?]*)/g)) {
         if (!href || /^(https?:|mailto:|data:)/.test(href)) continue;
         let target = href.startsWith("/") ? (href.startsWith(base) ? path.join(root, href.slice(base.length)) : null) : path.resolve(path.dirname(p), href);
         if (target && (href.endsWith("/") || fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, "index.html");
         if (!target || !fs.existsSync(target)) { bad++; console.error(`  ${path.relative(root, p)}: ${href}`); }
       }
     }
     if (bad) { console.error(`${bad} broken links`); process.exit(1); }
     console.log(`   ${pages.length} pages, every link resolves under ${base}`);' "/erp-lab-5/$slug/")
}

echo "== without an ontology"
a=$(make plain)
check_site "$a" demo-plain 0
grep -q '"private": true' "$a/shared.json"

echo "== a link to a private app repository is refused"
(cd "$a" && echo "See https://github.com/ERP-LAB-5/demo-app for the code." >> ROADMAP.md
 if npm run -s check >/dev/null 2>&1; then echo "   the private link passed"; exit 1; fi
 git checkout -q ROADMAP.md)
echo "   refused"

echo "== with an ontology and its own domain"
b=$(make onto --data ontology=true --data own_domain=docs.demo.example.org --data languages="en, de" \
  --data ontology_source=../demo-app/ontology --data ontology_files="tbox/demo.ttl, shapes/demo-shapes.ttl")
mkdir -p "$WORK/demo-app/ontology/tbox" "$WORK/demo-app/ontology/shapes"
cat > "$WORK/demo-app/ontology/tbox/demo.ttl" <<'TTL'
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <https://demo.example.org/ns#> .
<https://demo.example.org/ns> a owl:Ontology ; owl:versionInfo "0.1" .
ex:Widget a owl:Class ; rdfs:label "Widget"@en, "Bauteil"@de .
ex:partOf a owl:ObjectProperty ; rdfs:domain ex:Widget ; rdfs:range ex:Widget ; rdfs:label "part of"@en .
TTL
cat > "$WORK/demo-app/ontology/shapes/demo-shapes.ttl" <<'TTL'
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <https://demo.example.org/ns#> .
ex:WidgetShape a sh:NodeShape ; sh:targetClass ex:Widget ;
  sh:property [ sh:path ex:partOf ; sh:maxCount 1 ; sh:message "one parent at most" ] .
TTL
(cd "$b" && scripts/sync-ontology.sh >/dev/null && scripts/sync-ontology.sh --check >/dev/null && git add -A && commit ontology)
check_site "$b" demo-onto 1
(cd "$b" && npm run -s site >/dev/null
 [ "$(cat _site/CNAME)" = docs.demo.example.org ]
 grep -q '<link rel="canonical" href="https://docs.demo.example.org/adr/0001-record-architecture-decisions.html">' _site/adr/0001-record-architecture-decisions.html
 grep -q '<th>de</th>' _site/ontology/index.html
 grep -q 'Bauteil' _site/ontology/index.html)
echo "   CNAME, canonical links and the label languages"

echo "== copier update to a newer template"
(cd "$TPL" && echo "/* v2 */" >> template/site/site.css && echo "## Ideas" >> template/ROADMAP.md.jinja && git add -A && commit v2 && git tag v2)
(cd "$b"
 echo "- a product's own line" >> ROADMAP.md
 git add -A && commit edits
 "$COPIER" update --trust --defaults --quiet --vcs-ref v2 >/dev/null
 grep -q "/\* v2 \*/" site/site.css || { echo "   the template's stylesheet did not change"; exit 1; }
 grep -q "a product's own line" ROADMAP.md || { echo "   the product's roadmap lost its line"; exit 1; }
 ! grep -q "## Ideas" ROADMAP.md || { echo "   the product's roadmap was rewritten"; exit 1; }
 git diff --quiet -- shared.json adr diagrams || { echo "   the product's files changed"; exit 1; })
echo "   the stylesheet changed, the roadmap and shared.json did not"
echo "✓ template-dlab5-shared works"

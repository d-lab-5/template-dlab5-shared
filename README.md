# template-dlab5-shared

A [Copier](https://copier.readthedocs.io/) template for a D-LAB-5 product's
**public documentation repository**, `<product>-shared`: its decisions (ADRs),
roadmap, [Archify](https://github.com/tt-a1i/archify) diagrams and ontology
reference, with a sweep that keeps private things out.

Every product made from it is built into one site, **https://docs.dlab5.net/**,
under `/<domain>/<slug>/`, by
[d-lab-5/d-lab-5.github.io](https://github.com/d-lab-5/d-lab-5.github.io).
A product may also publish to a domain of its own.

| Domain | `domain` |
|---|---|
| D-LAB-5, the core | `d-lab-5` |
| DigitalHome.Cloud | `digitalhome` |
| ERP-LAB-5 | `erp-lab-5` |
| Atelier-5 | `atelier-5` |
| artdecoris labs | `artdecoris` |

## Making one

```bash
copier copy --trust gh:d-lab-5/template-dlab5-shared example-shared
cd example-shared && git init -b stage && npm install
npm run check && npm run serve      # http://127.0.0.1:8792/
```

Then create the public repository on GitHub, push `stage` and `main`, and add
one line to `sites.json` in `d-lab-5/d-lab-5.github.io`:

```json
{"slug": "example", "repo": "<owner>/example-shared"}
```

under the product's domain. docs.dlab5.net rebuilds every night, or at once
with *Run workflow*.

**When a product needs one:** its application repositories are private, or
it spans several repositories. A single public repository can keep its
decisions in its own `docs/`.

## Who owns what

| The template owns (an update replaces them) | The product owns (made once) |
|---|---|
| `scripts/`, `site/site.css`, `site/favicon.*`, `.github/workflows/pages.yml` | `shared.json`: name, domain, own domain, app repos, ontology |
| `SECURITY.md`, `LICENSE`, `package.json`, `package-lock.json` | `adr/`, `ROADMAP.md`, `diagrams/`, `site/landing.md`, `ontology/` |
| `.gitignore`, `.nvmrc`, `.claude/settings.json` (the plugins: `dlab5-house`, `dlab5-shared-docs`) | `README.md`, `CLAUDE.md`, `NOTICE` |

`copier update --trust` brings in the template's changes. A fix to a script
belongs here, not in a product.

## What the scripts do

- `npm run diagrams`: render each `diagrams/src/<name>.<type>.json` whose
  source changed, with Archify, a Claude Code skill. The pages are committed,
  so CI never needs it.
- `npm run check`, which is what CI runs:
  - `shared.json` is complete;
  - every diagram is rendered from its current source and listed once;
  - the ontology parses;
  - the site builds;
  - the public sweep finds no account ids, ARNs, keys, cloud hostnames,
    emails, local paths, RDF outside `ontology/`, or links to app
    repositories marked private.
- `npm run site [-- --base /<domain>/<slug>/]`: plain HTML into `_site/`,
  with relative links. The build writes `site.json` for the index. With an
  own domain, it also writes a `CNAME` and canonical links.
- `scripts/sync-ontology.sh [--check]`: copy the ontology from the app
  repository that holds its source.

## Testing the template

`./test.sh` makes two products from the working tree, one with an ontology and
an own domain, and runs their checks and builds. It also checks every link
under a base path, the refusal of a private link, and an update to a newer
template. It needs Copier, e.g. `pipx install copier`.

MIT.

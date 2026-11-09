---
name: dlab5-shared-docs
description: Making and working in a D-LAB-5 product's public documentation repository, `<product>-shared`, made from the Copier template d-lab-5/template-dlab5-shared — ADRs, roadmap, Archify diagrams and an ontology (T-Box) reference, with a public sweep — and getting it onto docs.dlab5.net, the one site that builds every product of the five development domains (d-lab-5 core, DigitalHome-cloud, ERP-LAB-5, Atelier-5, artdecoris-labs) under /<domain>/<slug>/. Use when someone wants docs, ADRs, diagrams or a docs site for a product, asks where a product's decisions live, wants to add a product to docs.dlab5.net, moves ADRs out of an app repo, adds a diagram to a -shared repo, or when a repo shows the tells: shared.json, .copier-answers.yml from template-dlab5-shared, scripts/diagrams.mjs and scripts/site.mjs, diagrams/src/*.json, adr/NNNN-*.md at the root. Carries the rules of a public repo (T-Box only, invented names, private repos named never linked), who owns which file, and the traps already hit.
---

# D-LAB-5 shared docs

Every product's decisions, roadmap, diagrams and ontology reference live in
one **public** repository per product, `<product>-shared`, made from
**d-lab-5/template-dlab5-shared**. **docs.dlab5.net** builds them all: its
CI (d-lab-5/d-lab-5.github.io) reads `sites.json`, clones each product's
`main`, and runs the product's own `scripts/site.mjs --base /<domain>/<slug>/`.

| Domain | `domain` | GitHub owner |
|---|---|---|
| D-LAB-5, the core | `d-lab-5` | d-lab-5 (a user account) |
| DigitalHome.Cloud | `digitalhome` | DigitalHome-cloud |
| ERP-LAB-5 | `erp-lab-5` | ERP-LAB-5 |
| Atelier-5 | `atelier-5` | Atelier-5 |
| artdecoris labs | `artdecoris` | artdecoris-labs |

The first product is the Mediathek: d-lab-5/mediathek-digitalhome-shared. It
is at docs.dlab5.net/digitalhome/mediathek/ and also at its own domain,
docs.mediathek.digitalhome.cloud.

## When a product needs one

- Its application repositories are private. Only the docs can be public.
- It spans several repositories, e.g. a cloud and an edge, so the
  decisions need one place both can cite.

A single public repository can keep `docs/adr/` in itself instead. Give it a
`-shared` repository only when it should appear on docs.dlab5.net.

## Making one

```bash
copier copy --trust gh:d-lab-5/template-dlab5-shared <product>-shared
#   product, slug, domain, description, repo (owner/name),
#   app_repos ("owner/a*, owner/b": a trailing * marks a private one),
#   own_domain (optional), languages, ontology (+ source, files), diagram_groups
cd <product>-shared && git init -b stage && npm install && npm run check
```

Copier lives in `~/.local/share/dlab5-tools/copier/bin/copier`, if it isn't
on the PATH.

1. Create the public repository (`gh repo create <owner>/<product>-shared
   --public`). This needs the person's go-ahead: it publishes.
2. Push `stage`, and `main` through a promotion PR.
3. Add `{"slug": "<slug>", "repo": "<owner>/<product>-shared"}` under its
   domain in `sites.json` in d-lab-5/d-lab-5.github.io. Then run that repo's
   workflow, or wait for the night. The slug and domain must match the
   product's `shared.json`; the build refuses a mismatch.
4. **An own domain** (optional) needs a CNAME `<name>` →
   `<owner>.github.io`, which the person adds. Then set the domain in the
   repo's Pages settings, and enforce HTTPS once the certificate exists.
   Pages refuses `https_enforced` before that.

**Moving existing ADRs in:** they are *moved*, not copied. Afterwards the app
repos refer to "ADR-00NN in `<product>-shared`", and `NOTICE` records the
commit they came from. Delete the template's seed `adr/0001-record-architecture-decisions.md`
if the product brings its own ADR-0001.

## Who owns what

- **The template owns** `scripts/` (`config`, `diagrams`, `site`, `check`,
  `ontology`, `sync-ontology`), `site/site.css`, `site/favicon.*`, `.github/workflows/pages.yml`,
  `SECURITY.md`, `LICENSE`, `package.json` and its lock. `copier update
  --trust` brings fixes. A fix goes into the template, never into one
  product's copy.
- **The product owns** `shared.json`, `adr/`, `ROADMAP.md`, `diagrams/`,
  `site/landing.md`, `ontology/`, `README.md`, `CLAUDE.md` and `NOTICE`.
- **Wording particular to the product** goes in `shared.json` → `texts`: the
  footer, the gallery and decisions leads, and the ontology page's
  paragraphs. Defaults are in `scripts/config.mjs`.

## The rules of a public repository

- **T-Box only.** Classes, properties, shapes and concepts. Never A-Box data:
  no real people, places, events, items or vaults. **Invent names** for
  examples; a name taken from real data is a leak, even in a file name.
- **No account ids or ARNs.** No hostnames of cloud resources, keys, tokens,
  emails or local paths.
- **A private app repository is named, never linked.** `npm run check`
  refuses a `github.com/<owner>/<repo>` link to one that `shared.json` marks
  private.
- **`npm run check` is the sweep,** and CI runs it. It cannot catch a real
  name written as prose, so read what you add.

## Diagrams

- **Drawing them:** with the Archify skill. A source is
  `diagrams/src/<name>.<type>.json`, rendered by `npm run diagrams`, and the
  rendered page is committed. Never edit the page.
- **Listing them:** each diagram once, under a group in `diagrams/README.md`
  or under its ADR's `## Diagrams`, as `- [Title](../diagrams/<name>.html):
  what it explains.` That line is the gallery card's text.
- **Facts come from the code.** Read the app repositories first, and cite
  their paths in the cards. The diagrams carry no repository evidence,
  because the code is elsewhere.
- **Archify limits that bite:**
  - a workflow has six columns at most;
  - a dataflow has five stages at most;
  - a sequence note needs about 44 to 66px before the next message;
  - an architecture boundary must not enclose a component it doesn't wrap.

## Traps already hit

- **A custom domain set before its DNS record exists** makes the github.io
  address redirect to a name that doesn't resolve.
- **The certificate:** if it doesn't come, set the domain again with
  `gh api -X PUT repos/<r>/pages -f cname=…`.
- **`pkill -f "http.server 8792"` kills its own shell.** Match it as
  `"[h]ttp.server 8792"`.
- **Creating a public repo** is refused by the permission check until the
  person approves it in chat. Ask; don't work around it.
- **docs.dlab5.net is not rebuilt by a product's push.** It runs nightly or on
  *Run workflow*: a push trigger from another org would need a token.
- **The aggregator keeps a product's last good copy** when its build fails,
  and marks the card. A product that never built is left out and named in
  the log.
- **Only the root 404 page is served.** The aggregated site's 404 is the
  index's own; a product's 404 links from its base, so it works on its own
  domain.

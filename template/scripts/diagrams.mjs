#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 D-LAB-5
/**
 * A product's diagrams: render them with Archify, check they are in step,
 * and describe them for the site's gallery (scripts/site.mjs).
 *
 *   node scripts/diagrams.mjs build [name ...] [--all]   render what changed (needs Archify)
 *   node scripts/diagrams.mjs check                      exit 1 when anything below is not true
 *
 * Layout:
 *   diagrams/src/<name>.<type>.json   the source: the only file to edit
 *   diagrams/<name>.html              the page Archify rendered from it (committed)
 *   diagrams/src/rendered.json        which source each page was rendered from
 *
 * Every diagram is listed once, with what it explains:
 *   - in diagrams/README.md under one of its "## <group>" headings, or
 *   - in the ADR it belongs to, under "## Diagrams".
 * Each line reads `- [Title](../diagrams/<name>.html): what it explains.` and
 * is the gallery card's text, so it is written once.
 *
 * Archify is a Claude Code skill, not a dependency: it is found in
 * ~/.claude/skills/archify or ~/.agents/skills/archify, or at $ARCHIFY. Only
 * `build` needs it; `check` and the site read the repository alone, so CI runs
 * without it. The receipts it writes beside each page are gitignored.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO } from "./config.mjs";

export { REPO };
export const DIR = join(REPO, "diagrams");
const SRC = join(DIR, "src");
const ADRS = join(REPO, "adr");
const RECORD = join(SRC, "rendered.json");
const LISTS = join(DIR, "README.md");
const NAME = /^(.+)\.([a-z]+)\.json$/;
const LINK = /^\s*[-*]\s*\[([^\]]+)\]\(\.\.\/diagrams\/([^)#]+)\.html\)\s*:?\s*(.*)$/;
// what a diagram is made of, by type, for the card's one-line size
const PARTS = [["participants", "participants"], ["messages", "messages"], ["states", "states"],
  ["transitions", "transitions"], ["nodes", "nodes"], ["flows", "flows"], ["components", "components"],
  ["connections", "connections"], ["entities", "tables"], ["relationships", "relations"],
  ["types", "types"], ["events", "events"], ["spans", "spans"]];

const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const read = (path) => readFileSync(path, "utf8");
const rel = (p) => relative(REPO, p).split("\\").join("/");

/** Every source: {name, type, file, page, data}. */
export function sources() {
  if (!existsSync(SRC)) return [];
  return readdirSync(SRC).filter((f) => NAME.test(f)).sort().map((f) => {
    const [, name, type] = f.match(NAME);
    const data = JSON.parse(read(join(SRC, f)));
    return { name, type: data.diagram_type || type, file: join(SRC, f), page: join(DIR, `${name}.html`), data };
  });
}

const record = () => (existsSync(RECORD) ? JSON.parse(read(RECORD)) : {});

function links(section) {
  return section.split("\n").map((l) => l.match(LINK)).filter(Boolean)
    .map(([, title, name, about]) => ({ title: title.trim(), name, about: about.trim() }));
}

/** The ADRs: {file, stem, num, heading, status, context, links}. */
export function adrs() {
  if (!existsSync(ADRS)) return [];
  return readdirSync(ADRS).filter((f) => /^\d{4}-.*\.md$/.test(f)).sort().map((f) => {
    const text = read(join(ADRS, f));
    const heading = (text.match(/^#\s+(.+)$/m) || [, f])[1];
    const status = (text.match(/^Status:\s*(.+)$/m) || [, ""])[1].replace(/\*\*/g, "");
    const context = (text.split(/^## Context\s*$/m)[1] || "").split(/\n\s*\n/).map((p) => p.trim()).find(Boolean) || "";
    const section = (text.split(/^## Diagrams\s*$/m)[1] || "").split(/^## /m)[0];
    return { file: f, stem: f.slice(0, -3), num: f.slice(0, 4), heading, status,
      context: context.replace(/\s+/g, " "), links: links(section) };
  });
}

/** The gallery's groups, in order: the README's sections, then each ADR that lists a diagram. */
export function groups() {
  const out = [];
  if (existsSync(LISTS)) {
    for (const part of read(LISTS).split(/^## /m).slice(1)) {
      const [head, ...rest] = part.split("\n");
      const body = rest.join("\n");
      const found = links(body);
      if (!found.length) continue;
      const lead = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith("-")) || "";
      out.push({ id: head.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), heading: head.trim(),
        lead: lead.replace(/\s+/g, " "), links: found, file: "diagrams/README.md" });
    }
  }
  for (const a of adrs()) {
    if (a.links.length) out.push({ id: `adr-${a.num}`, heading: a.heading, adr: a, lead: a.context,
      links: a.links, file: `adr/${a.file}` });
  }
  return out;
}

/** "3 participants · 9 messages": what a diagram holds. */
export function size(data) {
  return PARTS.filter(([k]) => Array.isArray(data[k]) && data[k].length).slice(0, 2)
    .map(([k, word]) => `${data[k].length} ${word}`).join(" · ");
}

function archify() {
  const found = [process.env.ARCHIFY, join(homedir(), ".claude", "skills", "archify", "bin", "archify.mjs"),
    join(homedir(), ".agents", "skills", "archify", "bin", "archify.mjs")].find((p) => p && existsSync(p));
  if (!found) {
    console.error("Archify is not installed: put the skill in ~/.claude/skills/archify, or set ARCHIFY to its bin/archify.mjs");
    process.exit(2);
  }
  return found;
}

function build(names, all) {
  const done = record();
  const todo = sources().filter((s) => names.length ? names.includes(s.name)
    : all || !existsSync(s.page) || done[s.name]?.source !== sha(s.file) || done[s.name]?.page !== sha(s.page));
  if (names.length && todo.length !== names.length) {
    console.error(`no source for: ${names.filter((n) => !todo.some((s) => s.name === n)).join(", ")}`);
    return 1;
  }
  let failed = 0;
  for (const s of todo) {
    const want = rel(s.page);
    if (s.data.meta?.output !== want) {                    // the page goes beside the others, whatever the source said
      s.data.meta = { ...s.data.meta, output: want };
      writeFileSync(s.file, JSON.stringify(s.data, null, 2) + "\n");
    }
    const quality = s.data.meta?.quality_profile || "showcase";
    const run = spawnSync("node", [archify(), "finalize", s.type, rel(s.file), want, "--quality", quality, "--json"],
      { cwd: REPO, encoding: "utf8" });
    let out = {};
    try { out = JSON.parse(run.stdout.trim().split("\n").pop()); } catch { /* reported below */ }
    if (run.status === 0 && out.ok) {
      done[s.name] = { source: sha(s.file), page: sha(s.page) };
      console.log(`rendered ${s.name} (${s.type}): ${Object.entries(out.gates || {}).map(([g, v]) => `${g} ${v}`).join(", ")}`);
    } else {
      failed++;
      const why = (out.diagnostics || []).map((d) => `${d.code || ""} ${d.message || ""}`.trim()).join("; ");
      console.error(`FAILED ${s.name}: ${why || run.stderr || run.stdout}`);
    }
  }
  if (!todo.length) console.log("every page is up to date with its source");
  writeFileSync(RECORD, JSON.stringify(Object.fromEntries(Object.entries(done).sort()), null, 2) + "\n");
  return failed ? 1 : 0;
}

/** What is out of step, as sentences; empty when everything is. */
export function problems() {
  const out = [];
  const done = record();
  const all = sources();
  const names = new Set(all.map((s) => s.name));
  for (const s of all) {
    if (!existsSync(s.page)) out.push(`${s.name}: not rendered (npm run diagrams)`);
    else if (done[s.name]?.source !== sha(s.file)) out.push(`${s.name}: the source changed since the page was rendered (npm run diagrams)`);
    else if (done[s.name]?.page !== sha(s.page)) out.push(`${s.name}: the page was changed by hand; edit the source and render it`);
  }
  for (const f of existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".html")) : []) {
    if (!names.has(f.slice(0, -5))) out.push(`diagrams/${f}: a page without a source in diagrams/src`);
  }
  const seen = new Map();
  for (const g of groups()) {
    for (const l of g.links) {
      if (seen.has(l.name)) out.push(`${l.name}: listed in both ${seen.get(l.name)} and ${g.file}; list it once`);
      seen.set(l.name, g.file);
      if (!names.has(l.name)) out.push(`${g.file}: lists ${l.name}, which has no source`);
      if (!l.about) out.push(`${g.file}: say what ${l.name} explains after the link ("): …")`);
    }
  }
  for (const s of all) if (!seen.has(s.name)) out.push(`${s.name}: listed nowhere (diagrams/README.md, or its ADR's "## Diagrams")`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd = "build", ...rest] = process.argv.slice(2);
  const names = rest.filter((a) => !a.startsWith("--"));
  if (cmd === "build") process.exit(build(names, rest.includes("--all")));
  if (cmd === "check") {
    const p = problems();
    p.forEach((x) => console.error(`✗ ${x}`));
    if (!p.length) console.log(`✓ ${sources().length} diagrams, each rendered from its source and listed once`);
    process.exit(p.length ? 1 : 0);
  }
  console.error("usage: node scripts/diagrams.mjs [build [name ...] [--all] | check]");
  process.exit(2);
}

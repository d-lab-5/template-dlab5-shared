#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (C) 2026 D-LAB-5
/**
 * Everything CI checks before the site is published, and what to run before
 * a push:
 *
 *   1. shared.json is complete, and every diagram is rendered from its
 *      current source and listed once;
 *   2. the ontology parses (when there is one), and the site builds;
 *   3. the public sweep: this repository is public and holds only T-Box
 *      structures, decisions and diagrams. No A-Box data (instances of
 *      people, events, places), no account ids, ARNs, app or distribution
 *      hostnames, emails, keys, or local paths; and no link to an app
 *      repository shared.json marks private.
 *
 *   node scripts/check.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.mjs";
import { REPO, problems } from "./diagrams.mjs";
import { readOntology } from "./ontology.mjs";
import { buildSite } from "./site.mjs";

const failures = [];
const fail = (x) => failures.push(x);

// 1. the configuration, and the diagrams
let c = null;
try { c = config(); } catch (e) { fail(e.message); }
problems().forEach(fail);

// 2. the ontology parses and holds no individuals but concepts; the site builds
if (c?.ontology) {
  try {
    const o = readOntology();
    if (!o.classes.length) fail("ontology: no classes found");
  } catch (e) { fail(`ontology: ${e.message}`); }
}
try { buildSite(); } catch (e) { fail(`site: ${e.stack || e.message}`); }

// 3. the public sweep, over every tracked text file
const tracked = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: REPO, encoding: "utf8" })
  .split("\n").filter(Boolean);
const RULES = [
  [/\b\d{12}\b/, "a 12-digit number (an AWS account id?)"],
  [/arn:aws[a-z-]*:/, "an ARN"],
  [/AKIA[0-9A-Z]{16}|(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{36,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a key or token"],
  [/\b[a-z0-9]{13,14}\.amplifyapp\.com|\bd[a-z0-9]{12,13}\.cloudfront\.net|\.execute-api\.|\.lambda-url\./, "an app, distribution or function hostname"],
  [/[A-Za-z0-9._%+-]+@(?!anthropic\.com\b)[A-Za-z0-9-]+\.[a-z]{2,}/, "an email address"],
  [/\/home\/[a-z]|C:\\Users\\/, "a local path"],
];
// a private app repository is named, never linked: the link would lead nowhere, and says too much
for (const a of c?.app_repos || []) {
  if (a.private && a.repo) RULES.push([new RegExp(`github\\.com/${a.repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])`, "i"), `a link to the private repository ${a.repo}`]);
}
const TEXT = /\.(md|mjs|js|json|ttl|ya?ml|sh|css|txt)$|^(LICENSE|NOTICE|CNAME|\.gitignore|\.nvmrc)$/;
for (const f of tracked.filter((f) => TEXT.test(f.split("/").pop()) && !f.startsWith("node_modules/") && f !== "package-lock.json")) {
  const text = readFileSync(join(REPO, f), "utf8");
  for (const [re, what] of RULES) {
    const m = text.match(re);
    if (m && !(f === "scripts/check.mjs")) fail(`${f}: ${what}: ${m[0].slice(0, 40)}`);
  }
}
// A-Box data: Turtle only in ontology/, and no named individuals there except concepts and the ontology itself
for (const f of tracked.filter((f) => /\.(ttl|jsonld|nt|nq|trig)$/.test(f))) {
  if (!/^ontology\/(tbox|shapes)\//.test(f)) fail(`${f}: RDF outside ontology/tbox and ontology/shapes; A-Box data is never published here`);
}
for (const f of tracked.filter((f) => /^ontology\/.*\.ttl$/.test(f))) {
  if (/\/id\/(person|pet|event|place|item|thing)\//.test(readFileSync(join(REPO, f), "utf8"))) fail(`${f}: holds an A-Box individual (…/id/…)`);
}

failures.forEach((x) => console.error(`✗ ${x}`));
if (failures.length) process.exit(1);
console.log(`✓ shared.json, ${c?.ontology ? "the ontology, " : ""}diagrams in step, site builds, nothing private in the repository`);

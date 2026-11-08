// SPDX-License-Identifier: MIT
// Copyright (C) 2026 D-LAB-5
/**
 * What this documentation is about, read from shared.json at the repository's
 * root. Every script takes its product's name, domain and texts from here, so
 * the scripts themselves are the same in every <product>-shared repository
 * and `copier update` can replace them (template-dlab5-shared).
 *
 *   {
 *     "product": "Example",                  the name a reader sees
 *     "slug": "example",                     docs.dlab5.net/<domain>/<slug>/
 *     "domain": "d-lab-5",                   one of DOMAINS
 *     "description": "One line for the index card.",
 *     "repo": "d-lab-5/example-shared",      this repository
 *     "own_domain": "",                      e.g. docs.example.org, or "" for none
 *     "app_repos": [{"repo": "d-lab-5/example-app", "private": true}],
 *     "languages": ["en"],                   label columns in the ontology page
 *     "ontology": null | {"source": "../example-app/ontology", "files": ["tbox/x.ttl", …]},
 *     "texts": { … }                         optional overrides of TEXT_DEFAULTS
 *   }
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DOMAINS = ["d-lab-5", "digitalhome", "erp-lab-5", "atelier-5", "artdecoris"];

const TEXT_DEFAULTS = {
  footer: "{product} by D-LAB-5",
  diagrams: "how {product} is built and how it works, and the decisions that needed a picture",
  decisions: "Architecture Decision Records: what was decided for {product}, why, and what follows from it. A decision is not edited once accepted; a later one extends or replaces it.",
  ontology_title: "The {product} ontology",
  ontology_scope: "The T-Box only: it defines kinds of things and how they relate, and holds no instance data. The A-Boxes, the actual things described, are never published here.",
  borrowed: "Terms from standard vocabularies, and what they mean in {product}.",
  shapes: "What an A-Box is checked against when it is saved; a save that breaks a rule is refused with the message shown.",
  concepts: "The fixed vocabularies a person picks from.",
};

let cached;

/** shared.json with its defaults filled in; throws a sentence when it is wrong. */
export function config() {
  if (cached) return cached;
  let raw;
  try { raw = JSON.parse(readFileSync(join(REPO, "shared.json"), "utf8")); }
  catch (e) { throw new Error(`shared.json: ${e.code === "ENOENT" ? "missing (copier copy makes it)" : e.message}`); }
  for (const k of ["product", "slug", "domain", "repo"]) if (!raw[k]) throw new Error(`shared.json: "${k}" is required`);
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(raw.slug)) throw new Error("shared.json: slug is lowercase letters, digits and -");
  if (!DOMAINS.includes(raw.domain)) throw new Error(`shared.json: domain is one of ${DOMAINS.join(", ")}`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(raw.repo)) throw new Error("shared.json: repo is owner/name");
  const fill = (s) => String(s).replaceAll("{product}", raw.product);
  const texts = Object.fromEntries(Object.entries({ ...TEXT_DEFAULTS, ...(raw.texts || {}) }).map(([k, v]) => [k, fill(v)]));
  cached = {
    ...raw,
    description: raw.description || "",
    own_domain: raw.own_domain || "",
    app_repos: raw.app_repos || [],
    languages: raw.languages?.length ? raw.languages : ["en"],
    ontology: raw.ontology || null,
    texts,
    repo_url: `https://github.com/${raw.repo}`,
  };
  return cached;
}

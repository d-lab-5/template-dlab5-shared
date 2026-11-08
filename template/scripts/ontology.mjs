// SPDX-License-Identifier: MIT
// Copyright (C) 2026 D-LAB-5
/**
 * A product's T-Box as a readable reference: classes, properties, the terms
 * borrowed from standard vocabularies, the SHACL rules an A-Box must keep, and
 * the SKOS concept schemes in the languages shared.json names. Read from
 * ontology/ (a copy of the app repository's, see scripts/sync-ontology.sh)
 * with N3. Only when shared.json has an "ontology".
 *
 *   import { readOntology, ontologyHtml } from "./ontology.mjs";
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import N3 from "n3";
import { REPO, config } from "./config.mjs";

export const ONTOLOGY = join(REPO, "ontology");
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL = "http://www.w3.org/2002/07/owl#";
const SH = "http://www.w3.org/ns/shacl#";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const DCT = "http://purl.org/dc/terms/";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Every Turtle file under ontology/, by its path. */
export function turtleFiles() {
  const out = [];
  for (const dir of ["tbox", "shapes"]) {
    if (!existsSync(join(ONTOLOGY, dir))) continue;
    for (const f of readdirSync(join(ONTOLOGY, dir)).filter((f) => f.endsWith(".ttl")).sort()) out.push(`${dir}/${f}`);
  }
  return out;
}

export function readOntology() {
  const store = new N3.Store();
  const prefixes = {};
  for (const f of turtleFiles()) {
    const parser = new N3.Parser();
    store.addQuads(parser.parse(readFileSync(join(ONTOLOGY, f), "utf8"), null, (p, iri) => { if (p) prefixes[p] = iri.value ?? iri; }));
  }
  const short = (term) => {
    if (!term) return "";
    if (term.termType === "BlankNode") return "[ ]";
    const v = term.value;
    let best = null;
    for (const [p, iri] of Object.entries(prefixes)) if (v.startsWith(iri) && (!best || iri.length > best[1].length)) best = [p, iri];
    return best ? `${best[0]}:${v.slice(best[1].length)}` : `<${v}>`;
  };
  const objs = (s, p) => store.getObjects(s, p, null);
  const one = (s, p) => objs(s, p)[0];
  const labels = (s, p = RDFS + "label") => {
    const out = {};
    for (const o of objs(s, p)) if (o.termType === "Literal") out[o.language || "en"] = o.value;
    return out;
  };
  const text = (s, p) => { const o = objs(s, p).find((x) => x.termType === "Literal" && (!x.language || x.language === "en")); return o ? o.value : ""; };
  const typed = (cls) => store.getSubjects(RDF + "type", cls, null);
  const list = (head) => {                                   // an RDF list as terms
    const out = [];
    for (let n = head; n && n.value !== RDF + "nil"; n = one(n, RDF + "rest")) {
      const f = one(n, RDF + "first");
      if (!f) break;
      out.push(f);
    }
    return out;
  };
  const byName = (a, b) => a.name.localeCompare(b.name);

  const onto = typed(OWL + "Ontology")[0];
  const meta = onto ? { iri: onto.value, labels: labels(onto), description: text(onto, DCT + "description"),
    version: text(onto, OWL + "versionInfo"), license: one(onto, DCT + "license")?.value || "" } : {};

  const classes = typed(OWL + "Class").filter((c) => c.termType === "NamedNode").map((c) => ({
    name: short(c), iri: c.value, labels: labels(c), comment: text(c, RDFS + "comment"),
    parents: objs(c, RDFS + "subClassOf").filter((x) => x.termType === "NamedNode").map(short),
    union: objs(c, OWL + "unionOf").flatMap(list).map(short),
  })).sort(byName);

  const kinds = { [OWL + "ObjectProperty"]: "object", [OWL + "DatatypeProperty"]: "datatype", [OWL + "AnnotationProperty"]: "annotation" };
  const props = new Map();
  for (const [cls, kind] of Object.entries(kinds)) {
    for (const p of typed(cls)) {
      const domain = one(p, RDFS + "domain");
      const range = one(p, RDFS + "range");
      props.set(p.value, { name: short(p), iri: p.value, kind, labels: labels(p), comment: text(p, RDFS + "comment"),
        domain: domain ? (domain.termType === "BlankNode" ? objs(domain, OWL + "unionOf").flatMap(list).map(short).join(" or ") : short(domain)) : "",
        range: range ? short(range) : "",
        functional: store.has(N3.DataFactory.quad(p, N3.DataFactory.namedNode(RDF + "type"), N3.DataFactory.namedNode(OWL + "FunctionalProperty"))),
        parent: objs(p, RDFS + "subPropertyOf").map(short).join(", ") });
    }
  }
  const properties = [...props.values()].sort(byName);

  // standard terms the T-Box only labels or explains: how a borrowed term is used here
  const known = new Set([...classes.map((c) => c.iri), ...props.keys(), onto?.value]);
  const borrowed = store.getSubjects(RDFS + "label", null, null)
    .filter((s) => s.termType === "NamedNode" && !known.has(s.value) && !store.getQuads(s, RDF + "type", SKOS + "Concept", null).length
      && !store.getQuads(s, RDF + "type", SKOS + "ConceptScheme", null).length)
    .map((s) => ({ name: short(s), iri: s.value, labels: labels(s), comment: text(s, RDFS + "comment") })).sort(byName);

  const describe = (c) => {                                  // one property shape's rules, in words
    const r = [];
    const min = one(c, SH + "minCount")?.value, max = one(c, SH + "maxCount")?.value;
    if (min || max) r.push(min && max ? (min === max ? `exactly ${min}` : `${min} to ${max}`) : min ? `at least ${min}` : `at most ${max}`);
    for (const [p, word] of [["datatype", ""], ["class", "a "], ["node", "shape "], ["hasValue", "always "], ["pattern", "matches "]]) {
      for (const o of objs(c, SH + p)) r.push(word + (o.termType === "Literal" ? `/${o.value}/` : short(o)));
    }
    const ors = objs(c, SH + "or").flatMap(list).map((b) => [...objs(b, SH + "datatype"), ...objs(b, SH + "class")].map(short).join(" ")).filter(Boolean);
    if (ors.length) r.push(ors.join(" or "));
    const ins = objs(c, SH + "in").flatMap(list).map(short);
    if (ins.length) r.push(`one of ${ins.join(", ")}`);
    const langs = objs(c, SH + "languageIn").flatMap(list).map((x) => x.value);
    if (langs.length) r.push(`in ${langs.join(", ")}`);
    if (one(c, SH + "uniqueLang")?.value === "true") r.push("one per language");
    const lo = one(c, SH + "minInclusive")?.value, hi = one(c, SH + "maxInclusive")?.value;
    if (lo || hi) r.push(`${lo ?? "…"} to ${hi ?? "…"}`);
    if (one(c, SH + "qualifiedMinCount")) r.push(`at least ${one(c, SH + "qualifiedMinCount").value} matching ${short(one(c, SH + "qualifiedValueShape"))}`);
    return r.join(" · ");
  };
  const shapes = typed(SH + "NodeShape").map((s) => ({
    name: short(s), target: objs(s, SH + "targetClass").map(short).join(", "),
    rules: [...describe(s) ? [{ path: "(the node)", rule: describe(s), message: text(s, SH + "message") }] : [],
      ...objs(s, SH + "property").map((c) => {
        const path = one(c, SH + "path");
        return { path: path ? short(path) : "", rule: describe(c), message: text(c, SH + "message") };
      })],
  })).sort((a, b) => (b.target ? 1 : 0) - (a.target ? 1 : 0) || a.name.localeCompare(b.name));

  const schemes = typed(SKOS + "ConceptScheme").map((sc) => {
    const concepts = store.getSubjects(SKOS + "inScheme", sc, null).map((c) => ({
      name: short(c), labels: labels(c, SKOS + "prefLabel"), alt: objs(c, SKOS + "altLabel").map((x) => x.value),
      broader: objs(c, SKOS + "broader").map(short)[0] || "",
    }));
    const order = [];                                       // top concepts first, each followed by its narrower ones
    const kids = (b, depth) => concepts.filter((c) => c.broader === b).sort(byName).forEach((c) => { order.push({ ...c, depth }); kids(c.name, depth + 1); });
    kids("", 0);
    concepts.filter((c) => !order.some((o) => o.name === c.name)).forEach((c) => order.push({ ...c, depth: 0 }));
    return { name: short(sc), labels: labels(sc, SKOS + "prefLabel"), fallback: labels(sc), concepts: order };
  }).sort(byName);

  return { meta, prefixes, classes, properties, borrowed, shapes, schemes, files: turtleFiles() };
}

const names = (l) => config().languages.map((g) => `<td lang="${g}">${esc(l[g] || "")}</td>`).join("");
const anchor = (name) => name.replace(/[^A-Za-z0-9]+/g, "-");

/** The reference page's body. */
export function ontologyHtml(o) {
  const t = config().texts;
  const head = `<tr><th>Term</th>${config().languages.map((g) => `<th>${esc(g)}</th>`).join("")}</tr>`;
  const classes = o.classes.map((c) => `<tr id="${anchor(c.name)}"><td><code>${esc(c.name)}</code>${
    c.parents.length ? `<br><small>is a ${c.parents.map((p) => `<code>${esc(p)}</code>`).join(", ")}</small>` : ""}${
    c.union.length ? `<br><small>one of ${c.union.map((p) => `<code>${esc(p)}</code>`).join(", ")}</small>` : ""}${
    c.comment ? `<br><small>${esc(c.comment)}</small>` : ""}</td>${names(c.labels)}</tr>`).join("");
  const props = o.properties.map((p) => `<tr id="${anchor(p.name)}"><td><code>${esc(p.name)}</code> <small class="tag">${esc(p.kind)}${p.functional ? ", one value" : ""}</small>${
    p.domain || p.range ? `<br><small>${esc(p.domain || "anything")} → ${esc(p.range || "anything")}</small>` : ""}${
    p.parent ? `<br><small>narrows <code>${esc(p.parent)}</code></small>` : ""}${
    p.comment ? `<br><small>${esc(p.comment)}</small>` : ""}</td>${names(p.labels)}</tr>`).join("");
  const borrowed = o.borrowed.map((t) => `<tr><td><code>${esc(t.name)}</code>${t.comment ? `<br><small>${esc(t.comment)}</small>` : ""}</td>${names(t.labels)}</tr>`).join("");
  const shapes = o.shapes.map((s) => `<section class="shape" id="${anchor(s.name)}"><h3><code>${esc(s.name)}</code>${
    s.target ? ` <small>for every <code>${esc(s.target)}</code></small>` : " <small>used by other shapes</small>"}</h3>
    <table><tr><th>Path</th><th>Rule</th><th>When it is broken</th></tr>${s.rules.map((r) =>
      `<tr><td><code>${esc(r.path)}</code></td><td>${esc(r.rule)}</td><td><small>${esc(r.message)}</small></td></tr>`).join("")}</table></section>`).join("");
  const schemes = o.schemes.map((s) => `<section id="${anchor(s.name)}"><h3>${esc(s.labels.en || s.fallback.en || s.name)} <small><code>${esc(s.name)}</code>, ${s.concepts.length} concepts</small></h3>
    <table>${head}${s.concepts.map((c) => `<tr><td style="padding-left:${0.5 + c.depth * 1.25}rem"><code>${esc(c.name)}</code>${
      c.alt.length ? `<br><small>also ${esc(c.alt.join(", "))}</small>` : ""}</td>${names(c.labels)}</tr>`).join("")}</table></section>`).join("");
  const prefixes = Object.entries(o.prefixes).sort().map(([p, iri]) => `<tr><td><code>${esc(p)}:</code></td><td><code>${esc(iri)}</code></td></tr>`).join("");
  return `
<p class="lead">${esc(o.meta.description || "")}</p>
<p class="meta">Version ${esc(o.meta.version || "—")} · <code>${esc(o.meta.iri || "")}</code> · ${o.classes.length} classes, ${o.properties.length} properties, ${o.shapes.length} shapes, ${o.schemes.length} concept schemes ·
  Turtle: ${o.files.map((f) => `<a href="${esc(f)}">${esc(f)}</a>`).join(", ")}</p>
<p>${esc(t.ontology_scope)}</p>
<nav class="toc"><a href="#classes">Classes</a><a href="#properties">Properties</a><a href="#borrowed">Borrowed terms</a><a href="#shapes">Rules (SHACL)</a><a href="#concepts">Concepts (SKOS)</a><a href="#prefixes">Prefixes</a></nav>
<h2 id="classes">Classes</h2><table>${head}${classes}</table>
<h2 id="properties">Properties</h2><table>${head}${props}</table>
<h2 id="borrowed">Borrowed terms</h2><p>${esc(t.borrowed)}</p><table>${head}${borrowed}</table>
<h2 id="shapes">Rules (SHACL)</h2><p>${esc(t.shapes)}</p>${shapes}
<h2 id="concepts">Concepts (SKOS)</h2><p>${esc(t.concepts)}</p>${schemes}
<h2 id="prefixes">Prefixes</h2><table>${prefixes}</table>`;
}

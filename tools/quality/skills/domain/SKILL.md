---
name: domain
description: Use before creating, changing, reviewing, or planning documents under project-wide or feature-owned domain docs, including bounded-context truth, write-model ownership, invariants, derived state, or published domain language. Requires explicit ownership of domain truth, separation from application orchestration and persistence shape, and source-backed evidence.
---

# Domain

## Overview

Use this skill whenever a task defines or changes durable domain truth:
bounded-context ownership, write models, invariants, derived state, published
language, or consistency boundaries.

In the closed project-doc taxonomy, `domain` is one of six canonical types and
normally lives under:

- `docs/project/domain/` for cross-feature or shared domain truth
- `docs/<feature>/domain/` for feature-owned domain truth

This is the SaltMarcher repo-local copy of the workspace skill. SaltMarcher standards still win when they are more
specific, and source evidence plus agent-instruction references come from repo-local skills and the global reference mirror.

Use `$source-references` when external sources or local evidence influence the
domain work. Use `$agent-instruction-engineering` when the work edits
`AGENTS.md`, `SKILL.md`, `agents/openai.yaml`, or other agent-facing
instruction surfaces.

## Required Workflow

### 1. Classify The Domain Surface

Before writing or reviewing, identify the primary domain document type:

- Domain Model: canonical context truth, ownership, invariants, and derived
  state
- Published Language Note: explicit public carrier or vocabulary surface for a
  context
- Domain Migration Note: current versus target domain truth during a migration,
  kept inside the owning domain document

If a document mixes several surfaces, split it or make the canonical owner
explicit.

### 2. Ground In Existing Domain Truth

Before proposing content:

- read the nearest repo documentation standard, domain-layer standard,
  neighboring domain docs, and code-adjacent documents
- identify the current source of truth for the context
- separate current state, target state, and open questions
- use `$source-references` before relying on external sources
- cite local repo files directly; cite preserved external sources through the
  global reference mirror

Do not replace repo-local domain language with generic architecture wording when
the repo already has precise context terms.

### 3. Make Domain Truth Explicit

Every domain document must define:

- the bounded context or feature role
- what the context owns and does not own
- published or external language when the context exposes one
- application-boundary translation when orchestration is separate from domain
  truth
- current state versus target state when migration is in progress
- write model versus derived or runtime state
- aggregate roots, core objects, or equivalent domain centers
- mutation entrypoints or commands when relevant
- invariants
- consistency boundaries
- source references

### 4. Keep Domain Separate From Neighboring Spec Surfaces

Domain documents define business truth and invariants. They do not own system
topology, payload compatibility, or rollout sequencing.

- put user-visible behavior and acceptance criteria into `requirements`
- put system boundaries, views, and architecture rationale into `architecture`
- put payload, schema, and persistence compatibility semantics into `contract`
- put temporary sequencing, rollout notes, and qualification planning into
  `delivery`
- put traceability, qualification methods, and durable proof ownership into
  `verification`

Link to neighboring owners instead of restating their full content.

### 5. Use Explicit Hardness Carefully

Use precise requirement language only when the level matters:

- `MUST`: required invariant or ownership rule
- `SHOULD`: expected default with a reasoned deviation path
- `MAY`: optional capability or extension point

Do not describe review-only expectations as if they were mechanically enforced
unless the exact gate is named elsewhere.

## Review Checklist

When reviewing domain work, flag:

- missing ownership, write model, or invariant definitions
- derived or runtime state described as durable truth
- published language missing even though the context exports public carriers
- application orchestration described as if it were the domain model itself
- persistence tables or adapters treated as the canonical owner of business
  meaning
- architecture or product-behavior content dominating the domain file
- external-source claims without a preserved local source
- duplicate or conflicting domain truth across files

## References

- Source selection: `/home/aaron/Schreibtisch/projects/references/domain-skill/source-map.md`
- Review and authoring criteria: `/home/aaron/Schreibtisch/projects/references/domain-skill/domain-checklist.md`
- Compact document templates: `/home/aaron/Schreibtisch/projects/references/domain-skill/domain-templates.md`
- Local project examples: `/home/aaron/Schreibtisch/projects/references/domain-skill/local-project-evidence.md`

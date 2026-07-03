---
name: verification
description: Use before creating, changing, reviewing, or planning documents under project-wide or feature-owned verification docs, including qualification plans, verification strategies, traceability matrices, evidence inventories, or proof-owned acceptance documents. Requires explicit proof ownership, named verification methods, honest distinction between mechanical and review-owned coverage, and separation from requirements, architecture, contract, domain, and delivery truth.
---

# Verification

## Overview

Use this skill whenever a task defines or changes durable verification truth:
qualification methods, proof routes, traceability, evidence ownership, or
coverage of required obligations.

In the closed project-doc taxonomy, `verification` is one of six canonical
types and normally lives under:

- `docs/project/verification/` for project-wide proof and qualification truth
- `docs/<feature>/verification/` for feature-owned proof and qualification
  truth

This is the SaltMarcher repo-local copy of the workspace skill. SaltMarcher standards still win when they are more
specific, and source evidence plus agent-instruction references come from repo-local skills and the global reference mirror.

Use `$source-references` when external sources or local evidence influence the
verification work. Use `$agent-instruction-engineering` when the work edits
`AGENTS.md`, `SKILL.md`, `agents/openai.yaml`, or other agent-facing
instruction surfaces.

## Required Workflow

### 1. Classify The Verification Surface

Before writing or reviewing, identify the primary verification document type:

- Verification Strategy: how a feature or project proves compliance
- Qualification Plan: milestone or release proof route and exit criteria
- Traceability Matrix: mapping source statements to proof routes
- Evidence Inventory: named retained proof artifacts and their owners

If a document mixes several surfaces, split it or make the canonical owner
explicit.

### 2. Ground In Existing Truth

Before proposing content:

- read the nearest repo documentation standard and the source documents being
  verified
- identify the current proof owner and the intended audience
- separate durable proof truth from temporary rollout notes
- use `$source-references` before relying on external sources
- cite local repo files directly; cite preserved external sources through the
  global reference mirror

Do not invent new requirement or architecture language inside a verification
document.

### 3. Make Proof Ownership Explicit

Every verification document must define:

- purpose
- verified source documents or source statements
- scope boundary and explicit non-rules
- verification methods
- pass or fail criteria
- traceability or mapping to source obligations
- evidence ownership when retained artifacts matter
- known gaps, review-owned proof, or deferred qualification
- source references

### 4. Keep Verification Separate From Neighboring Spec Surfaces

Verification documents define how compliance is proven. They do not redefine
what the product, system, contract, or domain means.

- put behavior and acceptance obligations into `requirements`
- put boundaries, decisions, and quality-shaping structure into `architecture`
- put payload, protocol, and persistence semantics into `contract`
- put business truth, invariants, and derived-state ownership into `domain`
- put rollout sequencing and migration steps into `delivery`

Link to neighboring owners instead of restating their full content.

### 5. Use Explicit Proof Language

Be precise about the strength of the proof route:

- `Mechanically Enforced`: blocked by a named task, tool, or gate
- `Review-Owned`: checked by human review, inspection, or checklist
- `Qualified`: passed through the named proof route for the stated scope
- `Candidate`: proposed proof route that is not yet adopted

Do not claim proof unless the verifying mechanism or review route is named.

## Review Checklist

When reviewing verification work, flag:

- missing source document ownership or proof scope
- verification routes that do not identify a concrete method
- pass/fail criteria that are vague or not observable
- traceability that is too loose to audit
- delivery sequencing presented as if it were proof
- requirements, contract, domain, or architecture truth rewritten in the
  verification file
- external-source claims without a preserved local source
- stronger proof claims than the named gate or review actually provides

## References

- Source selection: `/home/aaron/Schreibtisch/projects/references/verification-skill/source-map.md`
- Review and authoring criteria: `/home/aaron/Schreibtisch/projects/references/verification-skill/verification-checklist.md`
- Compact document templates: `/home/aaron/Schreibtisch/projects/references/verification-skill/verification-templates.md`
- Local project examples: `/home/aaron/Schreibtisch/projects/references/verification-skill/local-project-evidence.md`

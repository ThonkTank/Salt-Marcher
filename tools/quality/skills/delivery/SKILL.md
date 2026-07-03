---
name: delivery
description: Use before creating, changing, reviewing, or planning documents under project-wide or feature-owned delivery docs, including rollout notes, phased implementation sequencing, temporary delivery guidance, migration plans, or parity plans. Requires explicit temporary status, clear links to neighboring canonical specs, and separation from architecture, contract, requirements, domain, and verification truth.
---

# Delivery

## Overview

Use this skill whenever a task defines or changes temporary delivery truth:
rollout order, phased implementation notes, migration sequencing, parity
steps, or open delivery risks and questions.

In the closed project-doc taxonomy, `delivery` is one of six canonical types
and normally lives under:

- `docs/project/delivery/` for project-wide rollout or migration sequencing
- `docs/<feature>/delivery/` for feature-owned rollout or parity sequencing

This is the SaltMarcher repo-local copy of the workspace skill. SaltMarcher standards still win when they are more
specific, and source evidence plus agent-instruction references come from repo-local skills and the global reference mirror.

Use `$source-references` when external sources or local evidence influence the
delivery work. Use `$agent-instruction-engineering` when the work edits
`AGENTS.md`, `SKILL.md`, `agents/openai.yaml`, or other agent-facing
instruction surfaces.

## Required Workflow

### 1. Classify The Delivery Surface

Before writing or reviewing, identify the primary delivery document type:

- Delivery Notes: temporary rollout shape, phases, and risks
- Migration Or Parity Plan: temporary sequencing for bringing behavior or data
  into line with an approved target

If a document mixes several surfaces, split it or make the canonical owner
explicit.

### 2. Ground In Existing Truth

Before proposing content:

- read the nearest repo documentation standard, current requirements,
  architecture docs, ADRs, contracts, and existing delivery notes
- identify the approved current state and the intended next state
- separate current foundation, recommended next steps, and open questions
- use `$source-references` before relying on external sources
- cite local repo files directly; cite preserved external sources through the
  global reference mirror

Do not treat a temporary delivery note as permission to redefine a neighboring
source of truth.

### 3. Make Delivery Notes Actionable But Temporary

Every delivery document must define:

- why this delivery note exists
- the temporary scope boundary
- current foundation
- recommended rollout or phasing
- risks, blockers, or dependencies
- milestone-only verification expectations when relevant
- open delivery questions
- references to the neighboring canonical specs

### 4. Keep Delivery Separate From Long-Lived Spec Surfaces

Delivery documents are temporary implementation and rollout guidance.

- put user-visible behavior and acceptance criteria into `requirements`
- put stable system boundaries and rationale into `architecture`
- put payload, schema, and persistence semantics into `contract`
- put write-model truth, invariants, and derived state into `domain`
- put durable qualification methods, traceability, and proof routes into
  `verification`

If a delivery note starts acting as the only canonical source for the feature,
split it.

### 5. Use Explicit Status Language

Be clear about provisional versus adopted content.

- use `Current foundation` for already-landed truth
- use `Recommended rollout` or `Next step` for intended sequence
- use `Open delivery question` for undecided items

Do not describe temporary sequencing as if it were a permanent rule.

## Review Checklist

When reviewing delivery work, flag:

- missing current foundation, risks, or next-step clarity
- temporary notes presented as stable requirements or architecture
- contract or persistence semantics embedded without a named owner
- durable verification truth embedded without a named owner
- no indication of why the note is temporary
- no links to neighboring canonical specs
- external-source claims without a preserved local source

## References

- Source selection: `/home/aaron/Schreibtisch/projects/references/delivery-skill/source-map.md`
- Review and authoring criteria: `/home/aaron/Schreibtisch/projects/references/delivery-skill/delivery-checklist.md`
- Compact document templates: `/home/aaron/Schreibtisch/projects/references/delivery-skill/delivery-templates.md`
- Local project examples: `/home/aaron/Schreibtisch/projects/references/delivery-skill/local-project-evidence.md`

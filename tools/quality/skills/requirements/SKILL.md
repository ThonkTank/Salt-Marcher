---
name: requirements
description: Use before creating, changing, reviewing, or planning documents under project-wide or feature-owned requirements docs, including canonical feature-behavior specifications and other requirement owners. Requires clear user-facing scope, explicit current-vs-target behavior, concrete acceptance criteria, and separation from contracts, architecture, domain, delivery planning, and verification.
---

# Requirements

## Overview

Use this skill whenever a document is the canonical source of truth for
feature behavior, user-visible flows, expected capabilities, or acceptance
criteria.

In the closed project-doc taxonomy, `requirements` is one of six canonical
types and normally lives under:

- `docs/project/requirements/` for project-wide behavioral obligations
- `docs/<feature>/requirements/` for feature-owned behavior truth

This is the SaltMarcher repo-local copy of the workspace skill. Repo-local documentation standards still decide document
placement and naming, but the authoring and review discipline for feature
requirements comes from this skill.

Use `$source-references` when external sources or local evidence influence the
requirements. Use `$agent-instruction-engineering` when the work edits
agent-facing instruction artifacts.

Do not use this skill for architecture specifications, ADRs, API or data
contracts, persistence contracts, domain truth documents, quality-requirement
documents that belong to architecture, delivery plans, or verification plans
unless the file is actually the canonical owner of feature requirements.

## Required Workflow

### 1. Confirm The Document Is A Requirements Surface

Use this skill for:

- documents under `docs/project/requirements/`
- documents under `docs/<feature>/requirements/`
- migrated legacy `SPEC.md`-style feature requirement documents until the repo
  finishes moving them into the `docs/` tree
- user-facing behavior specifications with flows and acceptance criteria

Do not keep mixed ownership. If a document also tries to own:

- architecture views, boundaries, or decisions
- API or schema semantics
- persistence contracts or migration rules
- domain write-model truth or invariants
- temporary delivery sequencing
- verification traceability or qualification proof

split the content or link to the canonical owner.

### 2. Ground In Existing Truth

Before editing:

- read the nearest repo documentation standard and existing feature docs
- identify the canonical owner and intended audience
- separate current state, target behavior, and open questions
- use `$source-references` before relying on external sources
- cite local repo files directly and preserved external sources through the
  global reference mirror

Do not invent a new feature vocabulary when the repo already has stable terms.

### 3. Define Requirements, Not Implementation

A feature requirements document must define:

- goal and non-goals
- users or affected consumers
- scope and ownership boundary
- material constraints and assumptions when they affect the behavior
- current state when it matters for migration or drift
- target behavior
- primary user flows or scenario sequences
- expected capabilities, visible states, and meaningful error or empty states
- persistence or contract impact only as outward consequences
- concrete acceptance criteria
- open questions, deferred concerns, and references

When the project needs a fuller requirements artifact, also make explicit:

- glossary or term definitions where ambiguity would be costly
- verification notes for each important `MUST`
- traceability links to upstream needs or downstream tests when required by the
  repo or domain

Write the observable behavior, not the implementation recipe. User stories may
explain the `why`, but the document must still define the concrete `what`.

### 4. Keep Acceptance Criteria Concrete

Acceptance criteria must be:

- clear and unambiguous
- outcome-focused rather than implementation-focused
- objectively testable
- measurable when the behavior can be quantified
- independent enough to fail separately when practical

Every `MUST` needs a verification route or pass or fail criterion.

### 5. Use Explicit Hardness Carefully

Use precise requirement language only when the hardness matters:

- `MUST`: required behavior or constraint
- `SHOULD`: expected default with a reasoned deviation path
- `MAY`: optional capability

Use these words in all caps only when you intend the normative meaning.

Do not describe review-only expectations as if they were build-blocking. Do not
blur feature requirements with architecture enforcement claims.

## Review Checklist

When reviewing a feature requirements document, flag:

- missing goal, non-goals, owner, or source of truth
- current state and target state mixed together
- missing users, flows, visible states, or acceptance criteria
- acceptance criteria that are vague, subjective, or not testable
- contract semantics, domain truth, or architecture decisions embedded without a
  clear owner
- persistence details that redefine the canonical persistence contract
- implementation callchains replacing user-visible behavior
- external claims without preserved local sources
- duplicated or conflicting feature truth across files

## References

- Source selection: `/home/aaron/Schreibtisch/projects/references/requirements-skill/source-map.md`
- Review and authoring criteria: `/home/aaron/Schreibtisch/projects/references/requirements-skill/requirements-checklist.md`
- Compact document templates: `/home/aaron/Schreibtisch/projects/references/requirements-skill/requirements-templates.md`

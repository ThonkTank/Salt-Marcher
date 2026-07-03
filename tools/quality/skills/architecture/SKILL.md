---
name: architecture
description: Use before creating, changing, reviewing, or planning documents under project-wide or feature-owned architecture docs, including architecture standards, architecture specifications, architecture overviews, ADRs, architecture rule coverage, or architecture-significant quality requirements. Requires stakeholder-and-concern-driven views, explicit boundaries and rationale, honest enforcement language, and source-backed evidence.
---

# Architecture

## Overview

Use this skill whenever a task defines or changes durable architecture truth:
system shape, boundaries, dependency direction, views, architecture decisions,
quality-driving constraints, or architecture enforcement coverage.

In the closed project-doc taxonomy, `architecture` is one of six canonical
types and normally lives under:

- `docs/project/architecture/` for cross-feature or repo-wide architecture truth
- `docs/<feature>/architecture/` for feature-owned architecture truth

This is the SaltMarcher repo-local copy of the workspace skill. SaltMarcher standards still win when they are more
specific, and source evidence plus agent-instruction references come from repo-local skills and the global reference mirror.

Use `$source-references` when external sources or local evidence influence the
architecture work. Use `$agent-instruction-engineering` when the work edits
`AGENTS.md`, `SKILL.md`, `agents/openai.yaml`, or other agent-facing
instruction surfaces.

## Required Workflow

### 1. Classify The Architecture Surface

Before writing or reviewing, identify the primary architecture document type:

- Architecture Standard: reusable architecture rule for one topic
- Architecture Specification: stakeholder-facing description of one system,
  subsystem, or feature architecture
- Architecture Overview: entrypoint map of the system shape and major
  boundaries
- ADR: one architecture decision, its context, rationale, and consequences
- Architecture Coverage: inventory of mechanically enforced, candidate, or
  review-owned architecture rules
- Architecture Quality Requirement: measurable quality scenario or quality goal
  that materially shapes the architecture

If a document mixes several surfaces, split it or make the canonical owner
explicit.

### 2. Ground In Existing Architecture Truth

Before proposing content:

- read the nearest repo documentation standard, architecture overview, ADRs,
  architecture standards, quality requirements, and coverage documents
- identify the current source of truth for the topic
- separate current state, target state, and open questions
- use `$source-references` before relying on external sources
- cite local repo files directly; cite preserved external sources through the
  global reference mirror

Do not replace repo-local architecture vocabulary with generic process language
when the repo already has precise terms.

### 3. Make The Architecture Description Stakeholder-Driven

Every architecture document must define the entity of interest and enough
context for a reader to understand why the description exists.

Architecture work must make explicit:

- stakeholders or primary consumers
- concerns the document answers
- scope boundary and ownership
- current state versus target state
- constraints and dependencies
- chosen views and why those views answer the concerns
- boundaries, allowed seams, and forbidden shortcuts
- important relationships, interfaces, and dependency direction
- decisions, rationale, and rejected or superseded alternatives
- quality attributes or quality scenarios when they drive the shape
- enforcement owner, review owner, or verification route
- source references

### 4. Keep Architecture Separate From Neighboring Spec Surfaces

Architecture documents define structure, responsibilities, seams, and
decisions. They do not own product behavior, domain truth, or wire semantics.

- put user-visible behavior, acceptance criteria, and feature scope into
  `requirements`
- put payload shapes, validation rules, persistence semantics, and compatibility
  details into `contract`
- put write-model truth, invariants, derived state, and bounded domain language
  into `domain`
- put temporary rollout sequencing and open delivery risks into `delivery`
- put qualification methods, traceability, and proof ownership into
  `verification`
- keep architecture diagrams and views aligned with the governing textual
  boundary rules; diagrams are supporting evidence, not the only definition

If a document starts carrying both architecture and requirements or both
architecture and contract semantics, split it.

### 5. Use Explicit Hardness And Honest Enforcement

Use precise requirement language:

- `MUST`: required; implementation is non-compliant without it
- `SHOULD`: expected default; deviations need a documented reason
- `MAY`: optional capability
- `Candidate`: proposed but not yet adopted
- `Review-Owned`: checked by human review, not a build gate
- `Mechanically Enforced`: blocked by a named tool, task, or check

Do not claim enforcement unless the enforcing mechanism is named.

## Review Checklist

When reviewing architecture work, flag:

- missing entity of interest, stakeholders, concerns, or chosen views
- current state and target state blurred together
- boundary rules without explicit ownership or dependency direction
- diagrams without scope, labels, or textual interpretation
- architecture claims without named decisions, rationale, or tradeoffs
- quality goals without measurable or reviewable criteria
- enforcement claims without a named gate
- product behavior, domain truth, or payload semantics embedded in architecture
  truth
- external-source claims without a preserved local source
- duplicate or conflicting architecture truth across documents

## References

- Source selection: `/home/aaron/Schreibtisch/projects/references/architecture-skill/source-map.md`
- Review and authoring criteria: `/home/aaron/Schreibtisch/projects/references/architecture-skill/architecture-checklist.md`
- Compact document templates: `/home/aaron/Schreibtisch/projects/references/architecture-skill/architecture-templates.md`
- Local project examples: `/home/aaron/Schreibtisch/projects/references/architecture-skill/local-project-evidence.md`

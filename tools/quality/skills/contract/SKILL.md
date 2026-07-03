---
name: contract
description: Use before creating, changing, reviewing, or planning documents under project-wide or feature-owned contract docs, including API, message, schema, persistence, or feature-boundary contracts. Requires explicit ownership, compatibility, validation, error behavior, versioning or migration rules, and a clean separation from requirements and architecture documents.
---

# Contract

## Overview

Use this skill whenever the primary job is to define or review interface
semantics at a boundary: HTTP APIs, message contracts, payload schemas,
persistence contracts, or feature-scoped technical boundary contracts.

In the closed project-doc taxonomy, `contract` is one of six canonical types
and normally lives under:

- `docs/project/contract/` for project-wide or shared boundary truth
- `docs/<feature>/contract/` for feature-owned boundary truth

This is the SaltMarcher repo-local copy of the workspace skill. SaltMarcher standards still win when they are more
specific, and source evidence plus agent-instruction references come from repo-local skills and the global reference mirror.

Use `$source-references` when external sources or local evidence influence the
contract. Use `$agent-instruction-engineering` when the contract work also edits
`AGENTS.md`, `SKILL.md`, `agents/openai.yaml`, or other agent-facing
instruction artifacts.

## Covered Documents

Use this skill for:

- HTTP or RPC API contracts
- message, event, command, or stream contracts
- schema and payload contracts
- persistence contracts
- feature-scoped boundary contracts under `docs/<feature>/contract/`

Do not use this skill as the primary workflow for:

- requirements documents that define product obligations, traceability, or
  acceptance targets
- architecture documents that define stakeholders, concerns, views, decisions,
  or rationale
- domain truth documents that define write models, invariants, or derived state
- delivery plans, verification plans, ADRs, or user-facing feature specs unless the task is
  specifically about the contract slice inside them

If a document mixes several surfaces, split it or make the canonical owner
explicit.

## Required Workflow

### 1. Classify The Contract Surface

Before writing or reviewing, identify the contract type:

- HTTP Or RPC Contract: operations, requests, responses, parameters, media
  types, security, and reusable components
- Message Contract: channels, operations, messages, sender or receiver
  perspective, protocol bindings, and delivery semantics
- Schema Contract: payload shape, required versus optional fields, identifiers,
  references, dialects, meta-schema expectations, and constraints
- Persistence Contract: stored truth, schema ownership, migration,
  consistency, and adapter-facing semantics
- Feature Boundary Contract: a technical seam spanning multiple roots of one
  feature without becoming a feature requirements or architecture document

If the real primary question is "what behavior is required", route to
`$requirements` and the requirements sources. If the real primary question is
"why the system is shaped this way", route to `$architecture` and the
architecture sources.

### 2. Ground In Existing Truth

Before proposing content:

- read the nearest repo documentation standard, existing contract owner, and
  code-adjacent documents
- identify the current source of truth for the boundary
- separate current state, target changes, and open questions
- use `$source-references` before relying on external sources
- cite local repo files directly; cite preserved external sources through the
  global reference mirror

Do not replace repo-local contract language with generic process wording when
the repo already has precise boundary terms.

### 3. Make The Contract Decision-Complete

Every contract must define:

- purpose
- owners and consumers
- scope boundary and explicit non-rules
- the contract surface itself
- compatibility expectations
- validation rules
- error behavior
- versioning or migration expectations
- verification notes or review ownership
- source references

Also define the contract-specific details that the boundary needs:

- HTTP or RPC contracts: operations, inputs, outputs, reusable components,
  media types, and security assumptions
- message contracts: channels, operations, message shapes, delivery
  expectations, and bindings
- schema contracts: required versus optional fields, identifiers or references,
  dialect or meta-schema assumptions, and machine-checkable constraints
- persistence contracts: stored truth versus derived or runtime state, schema
  ownership, and consistency expectations
- feature boundary contracts: what the seam owns, what it does not own, and how
  neighboring owners connect to it

### 4. Preserve Contract Boundaries

Contracts describe interface semantics at a boundary. They must not quietly
become a substitute for other document types.

- do not turn a contract into a requirements document with user flows, product
  goals, or traceability matrices
- do not turn a contract into an architecture document with stakeholders,
  concerns, views, decision rationale, or system-wide topology
- do not turn a contract into a domain document that treats aggregates,
  invariants, or business meaning as schema-owned by default
- do not leave consumers to infer required versus optional fields, error cases,
  or compatibility rules from examples alone

Link to neighboring requirements or architecture documents instead of restating
their full content.

### 5. Use Explicit Hardness

Use precise requirement language:

- `MUST`: required; implementation is non-compliant without it
- `SHOULD`: expected default; deviations need a documented reason
- `MAY`: optional capability
- `Candidate`: proposed but not yet adopted
- `Review-Owned`: checked by human review, not a build gate
- `Mechanically Enforced`: blocked by a named tool, task, or check

Do not claim enforcement unless the enforcing mechanism is named. Do not use
soft words such as "clean", "simple", "robust", or "proper" without concrete
contract criteria.

## Review Checklist

When reviewing a contract, flag:

- missing metadata, owner, source of truth, or consumer
- missing compatibility, validation, error behavior, or versioning
- required and optional fields not distinguished
- schema, binding, or message semantics left implicit
- stored truth mixed with derived or runtime state
- architecture, domain, or requirements content dominating a contract file
- "enforced" claims without a named gate
- external-source claims without a preserved global source
- duplicate or conflicting truth across contract owners

## References

- Source selection: `/home/aaron/Schreibtisch/projects/references/contract-skill/source-map.md`
- Contract templates: `/home/aaron/Schreibtisch/projects/references/contract-skill/contract-templates.md`
- Contract review criteria: `/home/aaron/Schreibtisch/projects/references/contract-skill/contract-checklist.md`
- Local project evidence: `/home/aaron/Schreibtisch/projects/references/local-project-evidence.md`

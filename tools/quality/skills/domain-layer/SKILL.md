---
name: domain-layer
description: Use before planning, implementing, refactoring, or reviewing anything under `src/domain/**`, including `*ApplicationService.java`, `api/`, `application/`, `entity/`, `service/`, `valueobject/`, `repository/`, and adjacent `README.md`, `SPEC.md`, `DOMAIN.md`, and `DELIVERY.md`. This skill is supporting guidance only; the canonical source of truth is `docs/architecture/standards/domain-layer.md`.
---

# Domain Layer

## Overview

Use this skill to keep domain-layer work aligned with the canonical
domain-layer standard.

This skill is not the source of truth. If it conflicts with
`docs/architecture/standards/domain-layer.md`, follow the standard.

## Use This Skill For

- any file under `src/domain/**`
- any `*ApplicationService.java`
- any `api/`, `application/`, `entity/`, `service/`, `valueobject/`, or
  `repository/` package in the domain layer
- any `README.md`, `SPEC.md`, `DOMAIN.md`, or `DELIVERY.md` that defines or
  reviews a domain feature

## Working Heuristics

Before changing domain code:

1. Classify the feature as `domain-model` or `read/query` if the feature docs
   do not already make that explicit.
2. Assign each touched type one primary role:
   `application service`, `api`, `application`, `entity`, `aggregate root`,
   `service`, `valueobject`, or `repository`.
3. Check whether the behavior belongs on an aggregate, entity, or value object
   before placing it in `application/` or `service/`.
4. Check mutation boundaries. External mutation must enter through the owning
   aggregate root.
5. Check cross-feature access. Below the view layer, access goes only through
   foreign application services and foreign `api/` records.

## Role Reminders

### `*ApplicationService.java`

- public backend boundary of one feature
- thin coordination only
- not a composition root

### `application/`

- use-case orchestration and internal application services
- coordinates domain objects; does not replace them

### `entity/`

- identity-bearing objects and aggregate roots
- owns state-coupled behavior and invariants

### `service/`

- true domain services only
- stateless business logic that belongs to no single aggregate, entity, or
  value object

### `valueobject/`

- immutable identity-free domain concepts
- owns value-local validation and normalization

### `repository/`

- domain-owned contracts over canonical truth
- not a bucket for arbitrary external adapters

### `api/`

- exported commands, queries, results, and snapshots
- carriers only, not invariant owners

## Review Focus

When reviewing domain-layer work, look for:

- rich behavior moving into aggregates, entities, and value objects instead of
  procedural coordinators
- thin application services without hidden adapter composition
- proper separation between `application/` and true `service/`
- aggregate-root-only mutation boundaries
- read/query features staying free of owned domain policy

## References

- [Domain Layer Standard](../../../../docs/architecture/standards/domain-layer.md)
- [AGENTS.md](../../../../AGENTS.md)

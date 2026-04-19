---
name: domain-layer
description: Use before planning, implementing, refactoring, or reviewing anything under `src/domain/**`, including root `*ApplicationService.java`, carrier-only `api/`, `application/`, named domain modules, and adjacent `README.md`, `SPEC.md`, `DOMAIN.md`, and `DELIVERY.md`. This skill is supporting guidance only; the canonical source of truth is `docs/standards/domain-layer.md`.
---

# Domain Layer

## Overview

Use this skill to keep domain-layer work aligned with the canonical
domain-layer standard.

This skill is not the source of truth. If it conflicts with
`docs/standards/domain-layer.md`, follow the standard.

## Use This Skill For

- any file under `src/domain/**`
- any root `*ApplicationService.java`
- any `api/`, `application/`, or named domain module package
- any `README.md`, `SPEC.md`, `DOMAIN.md`, or `DELIVERY.md` that defines or
  reviews a domain feature

## Working Heuristics

Before changing domain code:

1. Read the feature's `DOMAIN.md` and confirm its context type.
2. Treat the root `<Feature>ApplicationService` as the only callable public
   client boundary for that feature.
3. Treat `api/` as carrier-only: commands, queries, results, snapshots,
   statuses, enums, and sealed carrier abstractions.
4. Assign each internal type to `application/` coordination or to a named
   domain module expressed in the ubiquitous language.
5. Check whether behavior belongs on an aggregate, entity, value object, or
   domain service before placing it in `application/`.
6. Check mutation boundaries. External mutation must enter through the owning
   aggregate root when the context has a write model.
7. Check cross-feature access. Below the view layer, access goes only through
   foreign root application services and foreign `api/` carriers.

## Role Reminders

### `*ApplicationService.java`

- exactly one callable public backend boundary of one feature
- accepts commands and queries in domain terms
- thin coordination only
- not a composition root for infrastructure

### `api/`

- exported boundary carriers only
- records, enums, or sealed carrier abstractions
- not a home for service, facade, repository, port, factory, locator, gateway,
  or invariant-owning contracts

### `application/`

- use-case orchestration and internal application coordination
- coordinates domain objects and domain-owned contracts
- does not replace rich domain behavior

### Named Domain Modules

- cohesive domain concepts in the ubiquitous language
- may contain entities, aggregate roots, value objects, repository contracts,
  domain services, factories, specifications, and events as needed
- must not be generic technical role buckets such as `entity/`, `service/`,
  `valueobject/`, `repository/`, or `query/`

## Review Focus

When reviewing domain-layer work, look for:

- a single callable root application-service boundary per feature
- carrier-only `api/` packages
- rich behavior moving into aggregates, entities, value objects, and domain
  services instead of procedural coordinators
- thin application services without hidden adapter composition
- aggregate-root-only mutation boundaries
- supporting read-model contexts staying free of owned domain policy

## References

- [Domain Layer Standard](../../../../docs/standards/domain-layer.md)
- [AGENTS.md](../../../../AGENTS.md)

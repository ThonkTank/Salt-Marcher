---
name: domain-layer
description: Use before planning, implementing, refactoring, or reviewing anything under `src/domain/**` or adjacent context docs (`README.md`, `SPEC.md`, `DOMAIN.md`, `DELIVERY.md`). Supporting guidance only; the canonical source of truth is `docs/standards/domain-layer.md`.
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
- any `published/`, `application/`, domain-concept module, or module
  role package
- any `README.md`, `SPEC.md`, `DOMAIN.md`, or `DELIVERY.md` that defines or
  reviews a domain context

## Working Heuristics

Before changing domain code:

1. Read the context's `DOMAIN.md` and confirm its `Context Role:`.
2. Treat the root `<Context>ApplicationService` as the only callable public
   client boundary for that context.
3. Treat `published/` as carrier-only published language: commands, queries,
   results, IDs, snapshots, statuses, enums, and sealed carrier abstractions.
4. Keep `application/` to use-case orchestration. Direct Java files are named
   `*UseCase`.
5. Assign each internal type to a domain-concept module and an explicit
   role package: `aggregate`, `entity`, `value`, `policy`, `port`,
   `factory`, `service`, `event`, or `specification`.
6. Check whether behavior belongs on an aggregate, entity, value object,
   policy, factory, domain service, or specification before placing it in
   `application/`.
7. Check mutation boundaries. External mutation must enter through the owning
   aggregate root when the context has a write model.
8. Check published-language access. Named domain modules must not import any
   `src.domain.*.published.*` carriers; root/application boundaries translate
   those carriers before entering the model.
9. Check cross-context access. Below the view layer, access goes only through
   foreign root application services and foreign `published/` carriers.
10. Reject `src/domain/mapcore/**`; shared render input belongs in the view
   layer, while domain dungeon map/world facts belong to `dungeon/published`.

## Role Reminders

### `*ApplicationService.java`

- exactly one callable public backend boundary of one context
- accepts commands and queries in domain terms
- returns `published/` carriers
- thin coordination only
- not a composition root for infrastructure

### `published/`

- exported published-language carriers only
- records, enums, or sealed carrier abstractions
- not a home for service, facade, repository, port, factory, locator, gateway,
  policy, or invariant-owning contracts
- not a home for render layers, styles, canvas cells, widget state, or display
  selections

### `application/`

- use-case orchestration and internal application coordination
- direct Java files are named `*UseCase.java`
- coordinates domain objects, domain-owned outbound ports, and allowed foreign
  application services
- does not replace rich domain behavior
- generic `*Operations` coordinator buckets are migration debt

### `port/`

- outbound interfaces required by the domain core
- write-model persistence ports may end with `Repository`
- read-only lookup, catalog, or search ports may end with `Lookup`, `Catalog`,
  or `Search`
- not a home for data adapter classes, records, schemas, gateways, runtime
  registration, SQL, filesystem, network, or JavaFX types

### Domain Modules And Role Packages

- direct domain module names are concepts in the ubiquitous language
- Java files inside a domain module live under a tactical role package
- `aggregate/` contains aggregate roots only
- `entity/` contains identity-bearing child entities
- `value/` contains immutable value objects and enums
- `policy/` contains stateless domain policies and rules
- `port/` contains domain-owned outbound port interfaces
- `factory/`, `service/`, `event/`, and `specification/` are used only when
  the corresponding tactical role exists
- domain modules must not import any `src.domain.*.published.*` carriers

## Review Focus

When reviewing domain-layer work, look for:

- a single callable root application-service boundary per context
- carrier-only `published/` packages
- `Context Role:` declarations matching the domain-layer standard
- role subpackages under every named domain module
- no direct Java files under named domain modules
- no `published/` imports from named domain modules
- no `repository/`, `query/`, `gateway/`, `adapter/`, `model/`,
  or `mapper/` role packages under domain modules
- ports stated in domain language without data-source, shell, JavaFX, SQL,
  filesystem, network, or runtime-registration terms
- rich behavior moving into aggregates, entities, values, policies, factories,
  specifications, or domain services instead of procedural coordinators
- thin application use cases without hidden adapter composition
- aggregate-root-only mutation boundaries
- no `src/domain/mapcore/**`

## References

- [Domain Layer Standard](../../../../docs/standards/domain-layer.md)
- [Agent Instruction Standard](../../../../docs/standards/agent-instructions.md)
- [AGENTS.md](../../../../AGENTS.md)

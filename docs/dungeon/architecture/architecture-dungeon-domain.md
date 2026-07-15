Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-15
Source of Truth: Dungeon-specific domain architecture, model-family ownership,
and dependency direction below `src/domain/dungeon/**`.

# Dungeon Domain Architecture

## Purpose

This document owns the feature-specific architecture of the Dungeon domain.
It explains how Dungeon domain code is structured inside the project-wide
[Source Architecture](../../project/architecture/source-architecture.md).

It does not own Dungeon business truth, editor behavior, persistence shape, or
proof rows. Those live in the neighboring domain, requirements, contract, and
verification documents.

## Current And Target State

Current state:

- `DungeonMap` is the aggregate root and mutation boundary for one authored map.
- Authored dungeon truth lives under `dungeon/model/core/**`.
- Neutral editor session/application seams and travel runtime state live under
  `dungeon/model/runtime/**`; migrated Dungeon Editor interaction/session
  workflows live under `src/features/dungeon/runtime/**`.
- Stable topology refs are map-owned and reused by rooms, corridors, doors,
  corridor anchors, stairs, transitions, handles, and labels.
- Search and write-model persistence are separate outbound contracts.
- Stable editor handle and projection affordance facts for cluster labels, true
  corners, and wall-run midpoints remain domain-neutral facts derived from
  `DungeonMap` truth. Migrated pointer interpretation, draft sessions, and
  transient interaction workflows are feature-runtime-owned. The view may apply
  selection-dependent visibility and hit indexing, but it must not reinterpret
  corridor, door, or cluster geometry facts into new authoritative edit handles.

Target state:

- floor, wall, path, door, room, cluster, corridor, stair, transition, and
  topology behavior live in self-managed core owners inside the `DungeonMap`
  aggregate boundary
- topology repair, split or merge behavior, identity preservation, and derived
  rebuild rules stay in the dungeon domain and move to the deepest owning core
  object
- editor and travel runtime consume core dungeon truth while authored
  persistence stays framed by `DungeonMap`
- map-owned topology remains the behavioral owner instead of leaking into
  view, data, runtime-session, persistence-adapter, or projection layers

## Model Families

Model family: `core`

`core` owns authored dungeon truth and mutation behavior. Its packages form a
one-way ownership ladder:

- `model/core/geometry` owns pure immutable geometry, topology values, and
  spatial rules
- `model/core/component` owns smallest authored parts with local invariants,
  local mutation, and binding or deletion rules
- `model/core/structure` owns composed authored structures and
  cross-component behavior; structure objects own room, cluster, corridor,
  stair, transition, door, wall, path, and topology-affecting local mutation
  policy inside the aggregate boundary
- `model/core/graph` owns read-only relationship queries and derivations
  between authored structures
- `model/core/projection` owns render-neutral derived read facts only

`DungeonMap` remains the owner of stable topology identity, aggregate
transaction policy, revision, and map-wide cross-owner coordination. Lower
layers must not depend on higher layers for authored meaning. Graph and
projection code may describe core structures but must not persist or mutate
them.

Model family: `runtime`

`runtime` owns domain-neutral editor/session seams and travel state over core
truth:

- `model/runtime/editor/session` owns the neutral editor session values and
  application surface that apply selection, tool, overlay, projection, preview,
  and published-session effects over authored dungeon facts
- migrated Dungeon Editor pointer interpretation, transient on-map interaction
  objects, draft workflows, and runtime composition are owned by
  `src/features/dungeon/runtime/**`; the domain runtime must not recreate that
  feature-runtime orchestration under `model/runtime/editor/**`
- `model/runtime/travel/session` owns travel-session state over core truth and
  party-owned position facts
- `model/runtime/travel/projection` owns derived travel read facts

`runtime` must never own authored dungeon truth. Runtime may load and project
core facts, but it must not persist dungeon structure or own authored rooms,
corridors, stairs, transitions, topology, or derived rebuild policy.

## Boundary Rules

- Application services remain thin family-scoped boundaries and route work to
  the owning use case or model family.
- Use cases may open aggregate transactions, call owning core or runtime
  objects, save through repositories, and publish typed results.
- View code owns rendering, hit-test presentation, styling, and passive map
  content models; it must not become the source of authored dungeon meaning.
- Data code owns storage mechanics and adapters; it must not own domain
  topology, recompute, validation, or derived rebuild rules.
- Feature-runtime preview and interaction state may stage editor intent over
  domain facts, but preview state never mutates authored truth before an
  explicit domain mutation commits.
- Do not introduce new `*Logic`, `*Service`, `*Manager`, generic interface, or
  base-class names to preserve old placement. Move behavior to the owning core
  structure, component, runtime state, repository, or use case.

## Verification And Review

Architecture compliance is review-owned unless a retained project-wide outcome
gate explicitly names the rule. Documentation-only changes to this document use:

```bash
./gradlew checkDocumentationEnforcement --console=plain
```

Model-family behavior is traced in
[Dungeon Core Model Invariants](../verification/verification-dungeon-core-model-invariants.md).
Editor behavior is traced through
[Dungeon Editor-Wide Invariants](../verification/verification-dungeon-editor-wide-invariants.md)
and the tool-specific editor catalogs.

## References

- [Dungeon Feature Docs](../README.md)
- [Dungeon Domain Model](../domain/domain-dungeon.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Persistence Contract](../contract/contract-dungeon-persistence.md)
- [Dungeon Core Model Invariants](../verification/verification-dungeon-core-model-invariants.md)
- [Dungeon Editor-Wide Invariants](../verification/verification-dungeon-editor-wide-invariants.md)

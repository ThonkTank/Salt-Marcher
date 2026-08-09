# ADR 0001: Shared Encounter Composition And Preset Ownership

Status: accepted, 2026-08-08

## Context

Scene and Session previously carried parallel generator policy and catalog
adaptation. That made preset identity, role rules, stock behavior, ranking, and
audit hashes drift independently. Wire contracts also risked becoming a home
for product data.

## Decision

The installation owns the revisioned Generator Config V3 registry and explicit
Campaign assignments. The system preset is an offline-generated checked-in
artifact. Contract modules own schemas and types; product data and matrix
helpers live outside the wire contract.

Scene and Session call one pure, streaming composition selector through a
narrow CR/XP/capacity catalog. Session publishes its composition abstractly;
Scene materializes the same blocks against concrete source stock. One
canonical serialization supplies every config fingerprint.

## Consequences

Preset save and Campaign assignment are separate commands. Selector changes
are tested once and shared by both consumers. Runtime selection no longer
depends on the role-band/pattern source tables. Scene adapters must establish
exact capacity before selection and may not weaken a selected block.

The canonical behavioral detail is in
[Encounter Generation Requirements](../../../encounter/requirements/requirements-encounter-generation.md).

# ADR 0002: Persist Explicit Combat Partitions

Status: accepted, 2026-08-08

## Context

Inferring individual/mob behavior from technical row-ID suffixes coupled
display naming, reconciliation, and persistence. Reinforcement and restart
behavior could silently change when the current mob threshold changed.

## Decision

Every monster source persists its Scene entry provenance and an explicit
`individual` or `mob` partition kind. Prepare also pins the effective preset
ID/revision, canonical config hash, and mob threshold. Reconciliation is a pure
policy over explicit source fields; row IDs are never parsed.

Combat is separated into pure partition/reconciliation policy, pure state
reduction/projection, a SQLite repository which alone owns SQL and memento
serialization, and a thin Live Play orchestrator.

## Consequences

Restart reproduces the exact prepared partition. A surviving mob absorbs new
members, surviving individuals remain individual, and threshold-based
repartitioning happens only after no prior source survives. Repository schema
changes cannot leak into orchestration code.

The normative rules are in
[Encounter Generation Requirements](../../../encounter/requirements/requirements-encounter-generation.md#combat-consumption).

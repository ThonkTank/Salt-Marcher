Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Session-generation language, ownership, and invariants.

# Session Generation Domain

## Context Role

Context Name: SessionGeneration

The context owns versioned generator rules, immutable reference-data identity,
session generation requests, deterministic intermediate decisions, generated
Encounter slots, generated Treasure/Loot truth, audits, and formatted output.
It does not own Party membership, creature truth, saved Encounter rosters, or
the authored Session Planner timeline.

## Core Model

- `GenerationRequest` carries level counts, encounter-day fraction, optional
  Encounter count, seed, ruleset, and locale.
- `GenerationResult` carries the calculated session context, Encounter plans,
  Treasure and Loot results, audit results, formatted text, and data hash.
- Encounter slots identify role, CR, quantity, and unit XP; they do not identify
  a creature until Encounter resolves them through creature truth.

## Invariants

- The Encounter target sum equals the session XP target.
- Generation contains exactly one selected plan per target or fails its audit.
- IDs and table order are stable within one reference-data version.
- Magic items contribute zero CP and do not consume Treasure value.
- A result is applicable only when every hard audit passes.
- `sheet-v1` uses explicit positive modulo and no volatile random source.

## Consistency

One generation call produces one immutable result. Session application is a
separate cross-context workflow: Encounter first imports resolved rosters, then
Session Planner replaces only its owned timeline and references.

## References

- `resources/sessiongeneration/sheet-v1/manifest.json`
- `docs/sessiongeneration/contract/contract-session-generation.md`

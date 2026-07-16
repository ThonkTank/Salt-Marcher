Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Observable Session Generation behavior, adopted reference-rule
parity, and acceptance criteria.

# Session Generation Requirements

## Goal And Scope

Session Generation MUST let a Session Planner user create a reproducible,
reviewable preview of encounter targets, encounter compositions, and rewards,
then apply that exact preview to the current session through the owning feature
boundaries.

The affected user is a game master preparing an authored Session Planner
record. Session Generation owns the generated proposal. Session Planner owns
the preview interaction and applied session references; Encounter owns saved
encounter plans.

## Non-Goals

- editing party membership, creature truth, or saved Encounter plans
- replacing the existing Encounter builder and its runtime generator
- making generated output authoritative before the user applies it
- exposing a ruleset selector or ruleset-version label in the UI
- reproducing spreadsheet row identities or exact selected candidates, items,
  containers, monetary totals, or final formatted text
- importing or preserving proof-of-concept generation data

## Inputs And User Flow

1. Session Planner resolves the current session participants to counts per
   level and supplies the adventure-day fraction, optional encounter count,
   and seed.
2. The user requests generation without leaving the Session Planner surface.
3. Generation runs without blocking the JavaFX thread. The existing session
   remains usable while the request is pending.
4. Success shows one structured preview containing encounter targets,
   generated encounter summaries, rewards, warnings, and audit outcome. The UI
   MUST NOT show a ruleset label.
5. The preview is not applied automatically. Session Planner locks Apply when
   the preview fingerprint no longer matches the current generation inputs.
6. The user regenerates after a stale lock or applies the still-current
   preview. Apply imports all generated encounters through Encounter's atomic
   generated-origin operation, then records the returned encounter-plan and
   generated-reward references in one Session Planner mutation.
7. Failure leaves both the authored session and the last stable preview
   unchanged and shows an actionable status.

An empty party is a visible invalid-input state. An omitted encounter count
activates deterministic automatic calculation; an explicit value MUST be from
1 through 10. Party levels MUST be from 1 through 20, player counts MUST be
non-negative, the total player count MUST be positive, and the adventure-day
fraction MUST be non-negative.

## Adopted Rule-Parity Profile

The target adopts the executed rule groups documented in sections 3 through 15
of the preserved reference as the `saltmarcher-v1` calculation profile, with
the explicit acceptance boundary below. This is behavioral rule parity, not a
spreadsheet row-selection or seeded-output compatibility promise.

The implementation MUST preserve these behavioral rule groups:

- normalize the request, retain the explicit seed, calculate party count,
  daily XP, session XP, interpolated average level, gold pools, magic targets,
  treasure count, and non-magic slots as specified by the reference
- allocate encounter targets so their exact sum equals session XP; use the
  reference medium-to-deadly weighting and assign rounding remainder to the
  last target
- build role-banded CR blocks and one-, two-, or three-role patterns, use the
  effective-monster-count multiplier, rank by absolute target delta with
  stable tie-breaking, and make the seeded choice among the best eligible
  candidates
- retain the position-based EASY, MEDIUM, HARD, and DEADLY labels and the
  reference bossiness ordering
- preserve normal versus overstock budgets, reward-channel caps, theme and
  magic distribution, descending slot allocation, dynamic per-line budget,
  role proportions, candidate tolerances, contextual bulk behavior, coin,
  adorned, useful, flavor, magic, enspelled, curse, packing, and formatting
  rules
- use positive modulo semantics, stable explicit ordering, and deterministic
  selection; no volatile random source may influence a run
- preserve documented fallbacks as typed warnings where the reference still
  produces output; a missing encounter candidate or failing hard invariant
  makes the preview non-applicable
- run the per-generation hard invariants and budget tolerances from reference
  section 15 before publishing an applicable result

Catalog content is SaltMarcher-owned. Rule parity does not require importing
the spreadsheet's exact active rows or their row order. The engine applies the
adopted rules to the active, versioned SaltMarcher catalog and therefore MAY
use its own stable keyed entropy and MAY select different candidates, loot,
magic items, or containers. The spreadsheet's per-cell seed multipliers and
exact selected rows are explicitly outside compatibility; deterministic
selection, distribution, caps, tolerances, and hard invariants remain required.

## Golden Acceptance Boundary

For the preserved input of two level-3 players, two level-4 players, adventure
day fraction `0.6`, explicit encounter count `3`, and seed `179974`, the only
Golden Master output required by this feature is:

```text
encounterTargets = [680, 1000, 1800]
```

Exact encounter candidates or CR compositions, selected loot items, container
assignments, reward totals, and formatted text are explicitly not Golden
parity requirements.

## Visible States And Errors

- `idle`: no preview exists
- `generating`: the request is in flight and Apply is unavailable
- `ready`: all hard audits pass and Apply is available
- `stale`: a preview remains readable, but Apply is locked until regeneration
- `invalid`: input validation failed
- `failed`: the catalog, generation, or storage operation failed without
  replacing stable state

Warnings MUST remain visible with the preview and MUST NOT be represented as
successful hard audits. A hard audit failure MUST prevent Apply.

## Acceptance Criteria

- the generation call and stored-result load are non-blocking typed operations
- the same normalized request, engine semantics, and catalog snapshot produce
  the same structured result apart from persistence identity and timestamps
- encounter targets sum exactly to session XP
- generated results retain seed, engine version, catalog version, catalog
  content hash, structured audits, and stable generation identity
- a preview never mutates Session Planner or Encounter truth before Apply
- changing any fingerprint input locks Apply while leaving the stale preview
  visible
- Apply never imports a partial encounter batch
- the UI contains no ruleset selector or ruleset-version label
- the Golden input produces exactly `[680, 1000, 1800]` as its target list;
  no exact item, container, candidate, or text snapshot is required

## Verification Notes

Every `MUST` above is review-owned until a production-route test names it.
Determinism is checked by repeated equal requests; parity is checked at stage
boundaries, and the Golden acceptance checks only the target list declared
above.

## Sources

- Readable owner-provided reference:
  `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- Preserved original recorded by that reference:
  `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
- Original locator: `local-owner-provided document`, snapshot 2026-07-16
- [Session Planner Requirements](../../sessionplanner/requirements/requirements-session-planner.md)
- [Encounter Requirements](../../encounter/requirements/requirements-encounter.md)

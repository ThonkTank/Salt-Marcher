Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Observable Session Planner Encounter-and-Loot generation behavior.

# Session Generation Requirements

## Goal

The Session Planner provides one compact generator that derives a reproducible
Encounter-and-Loot proposal from the session participants, encounter-day share,
optional Encounter count, and explicit seed.

## User Flow

1. The user opens a persisted session with at least one resolvable participant.
2. The user keeps the automatic Encounter count or enters a value from 1 to 10,
   enters a non-negative seed, and requests a preview.
3. The preview shows XP target, CR and role composition, reward placement, loot,
   audit status, ruleset, seed, and data hash without changing the session.
4. Apply remains disabled when a hard audit fails.
5. After confirmation, SaltMarcher resolves exact-CR creatures, saves the
   Encounter plans, and replaces the current scene timeline and loot entries.

## Required Behavior

- The initial ruleset MUST be `sheet-v1` and preserve its observed quirks.
- Identical request and reference-data hash MUST produce identical content.
- Generation MUST use session-local participants, not mutate Party membership,
  and reject a session without resolvable participant levels.
- Generated Quest and Environment rewards MUST remain visible as encounter-free
  scenes; Encounter rewards MUST remain attached to their generated scene.
- Applying MUST preserve session ID, name, participants, and encounter-day share.
- Applying MUST clear former scenes, rests, and loot references but MUST NOT
  delete their foreign saved Encounter plans.
- An unresolved exact CR slot MUST prevent partial Session replacement.

## Non-Goals

- editing the reference corpus from the Session Planner;
- silently correcting `sheet-v1` probability, value, or formatting behavior;
- making Session Planner own monster rosters or generated loot truth;
- deleting saved Encounter plans displaced from a session.

## Acceptance

- Seed `179974`, levels `{3:2, 4:2}`, share `0.6`, and three Encounters produce
  targets `680/1000/1800` and selected XP `700/1000/1875`.
- The reference import proves all table counts and the source content hash.
- Preview causes no Session or Encounter write.
- Apply is retry-safe and produces no duplicate generated Encounter plans.
- `./gradlew check` passes; visible behavior remains owner-accepted manually.

## References

- `resources/sessiongeneration/sheet-v1/manifest.json`
- `docs/sessionplanner/requirements/requirements-session-planner.md`
- `docs/encounter/domain/domain-encounter.md`

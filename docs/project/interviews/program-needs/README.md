Status: Active
Owner: Aaron
Last Reviewed: 2026-07-22
Source of Truth: Routing, evidence boundary, and coverage order for the
program-wide SaltMarcher needs interview.

# Program Needs Interview Series

## Purpose

This series establishes the complete needs baseline for SaltMarcher's local GM
core before any further greenfield architecture or current-state comparison.
It interviews end-to-end GM workflows rather than assuming today's feature or
module boundaries are the correct product decomposition.

The German transcripts are evidence. Only explicitly confirmed interpretations
may enter the English
[Program Capability Requirements](../../requirements/requirements-program-capabilities.md).
Neither the transcripts nor the draft requirements define architecture,
contracts, persistence, source layout, or delivery order.

## Confirmed Interview Rules

- The binding horizon is the complete local GM core product. Player-operated,
  remote-play, and other distant extensions remain parked separately.
- Previously confirmed vision and verbatim owner answers remain evidence.
  Existing feature requirements, architecture, and code are discovery prompts,
  not target constraints.
- Discovery proceeds breadth-first across the whole GM lifecycle, then deepens
  only gaps, conflicts, cross-capability operations, and quality-driving cases.
- Each turn asks a small block of three to five concrete, related questions.
- Each complete workflow receives a compact owner-confirmed interpretation
  before it enters the draft program requirements.
- A final owner confirmation is required before the program requirements become
  `Active Target` or architecture work resumes.

## Workflow Coverage Order

The headings below are interview routes, not presumed feature boundaries.

1. Campaign foundation, Party, reusable reference knowledge, and authored World
   knowledge
2. Session, Scene, Encounter, reward, weather, music, and note preparation
3. Running Scenes, combat, lookup, notes, time, weather, music, improvisation,
   and passive presentation during table play
4. Dungeon, Hex, travel, position, events, perception, and optional Actor
   Autonomy during campaign-time progression
5. Encounter and session follow-up, awarded possessions, progression, World
   consequences, history, and corrections
6. Campaign switching, restart, import, export, reference refresh, backup,
   restore, recovery, and other local data-lifecycle needs
7. Cross-workflow completeness, failure semantics, scale, responsiveness,
   modular change, removal, replacement, and extension scenarios

## Evidence

- [Foundation And Coverage 2026-07-22](2026-07-22-foundation-and-coverage.md)
- [Goal Interview 2026-07-10](../2026-07-10-goal-interview.md)
- [Dungeon Needs Interview 2026-07-20](../2026-07-20-dungeon-needs-interview.md)

## Completion Rule

The interview is complete only when every capability suggested by confirmed
vision, roadmap, prior owner evidence, and the current product inventory is
confirmed, explicitly excluded, or parked; every confirmed capability appears
in an end-to-end GM workflow; and no unresolved product decision blocks later
technical-needs derivation.

## References

- [Project Vision](../../vision.md)
- [Documentation Standard](../../documentation.md)
- [Project Interviews](../README.md)

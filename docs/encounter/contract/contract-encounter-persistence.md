Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Persistence path and schema ownership rules for the
`encounter` feature.

# Encounter Persistence

This document is normative for the `encounter` feature's saved-plan
persistence path.

## Root Contract

- `src/data/encounter/EncounterServiceContribution.java` is the root service
  entrypoint for encounter persistence.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers the exported root application service through the
  shell-owned service registry, `shell.api.ServiceRegistry`.
- The exported encounter runtime surface is `EncounterApplicationService.class`.
- Domain ports, repositories, gateways, mappers, and schema classes remain
  implementation details and must not be registered as runtime services.
- View assembly code reads saved-plan behavior only through
  `ShellRuntimeContext.services()`.

## Mandatory Schema

- `src/data/encounter/model/EncounterPersistenceSchema.java` is the canonical
  in-code schema declaration for the feature.
- The schema owns:
  - `saved_encounter_plans`
  - `saved_encounter_plan_creatures`
- `saved_encounter_plans` stores plan identity, display name, generated label,
  and timestamps.
- `saved_encounter_plan_creatures` stores ordered creature identity and
  quantity rows. Creature identity references the creature catalog; the
  encounter feature does not duplicate statblocks.

## Current Mapping

Encounter persistence stores only saved encounter-plan roster truth. It does
not persist:

- generated-alternative lists
- active generator filters
- initiative values
- combat HP or turn order
- defeated-result state
- loot or XP-award resolution

The data layer maps SQLite rows through source-local encounter records into
`EncounterPlan` aggregate values. Creature detail display is reloaded through
the creatures application service when a plan is opened.

## Validation And Error Behavior

- encounter-plan writes MUST reject empty or malformed roster rows instead of
  silently persisting partial encounter truth
- generated alternatives, initiative state, combat HP, result state, and loot
  state MUST be rejected from the persistence payload because they are explicit
  non-persisted runtime state
- schema-readiness and storage failures MUST surface through encounter-owned
  published result statuses rather than leaking SQLite exceptions to the view
  layer

## Stability Rules

- Adding encounter persistence must not require feature-specific bootstrap
  wiring.
- The `EncounterPlanRepository` write port remains a data-owned collaborator
  injected into `EncounterApplicationService`.
- Saved-plan storage remains encounter-owned even when generated plans are
  built from party, creatures, or encounter-table source data.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject persisted fields for generated alternatives, initiative,
  combat HP, result state, and loot state.
- Review must reject runtime-service exports other than
  `EncounterApplicationService.class`.

## References

- [Encounter Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/domain/domain-encounter.md:1)
- [Encounter Feature Spec](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/requirements/requirements-encounter.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)

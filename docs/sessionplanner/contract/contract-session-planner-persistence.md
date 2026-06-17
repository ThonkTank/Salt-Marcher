Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-06
Source of Truth: Persistence path, reference rules, and error behavior for the
`sessionplanner` session record.

# Session Planner Persistence Contract

## Purpose

This contract defines the persisted storage boundary for the `sessionplanner`
feature.

Current state:

- `sessionplanner` now owns its own data feature under
  `src/data/sessionplanner/**`
- the current implementation persists multiple session records with stable
  session identity, user-visible display names, and a current-session pointer
- the current implementation exposes create/open/rename/delete session catalog
  operations through the planner-owned public boundary

Target state:

- `sessionplanner` keeps persisting its own session record without storing
  foreign domain internals

## Root Contract

- `src/data/sessionplanner/SessionPlannerServiceContribution.java` is the
  root service entrypoint for the feature.
- Bootstrap discovers it generically under `src/data/<feature>/`.
- The contribution registers the exported root application service through the
  shell-owned service registry, `shell.api.ServiceRegistry`.
- The exported planner runtime surfaces are
  `SessionPlannerApplicationService.class` for write workflows,
  `SessionPlannerCurrentSessionModel.class`,
  `SessionPlannerParticipantsModel.class`,
  `SessionPlannerEncountersModel.class`, and
  `SessionPlannerStatePanelModel.class` for read-only observation.
- Domain ports, repositories, gateways, mappers, and schema classes remain
  implementation details and must not be registered as runtime services.
- View assembly code reads planner behavior only through
  `ShellRuntimeContext.services()`.

## Stored Truth

The persisted session record stores only sessionplanner-owned truth:

- stable session identity
- user-visible session display name
- session-local participant references to party characters
- exact `encounterDays` planning input
- ordered references to encounter-owned saved plans
- per-encounter budget percentages or equivalent planner-owned allocation data
- selected encounter context
- session-local rests, placeholders, and planner status or selection truth

The session record does not persist:

- party membership truth
- party character details beyond stable references
- encounter rosters or copied encounter creature rows
- creature statblocks or creature lifecycle truth
- loot-object internals or fake gold-budget fields

## Reference Rules

- party characters are stored only as stable session participant references
- encounter attachments are stored only as stable references to
  encounter-owned saved plans
- foreign truth must be re-read through the owning public boundary when a
  session is opened
- session-owned ordering, allocations, rests, placeholders, and selection
  state remain in sessionplanner persistence even when foreign source data is
  reloaded

## Validation And Error Behavior

- session-plan writes MUST reject malformed session identity, participant
  reference, encounter reference, or allocation payloads instead of silently
  persisting partial planner truth
- `encounterDays` MUST be stored as an exact decimal value, not a lossy
  floating-point approximation
- persistence payloads MUST reject copied foreign rosters, character detail,
  creature detail, and loot internals
- storage and schema failures MUST surface through sessionplanner-owned
  published result statuses instead of leaking adapter exceptions to the view
  layer
- failed writes MUST keep the last stable planner-owned current session state
  visible instead of publishing a half-persisted mutation

## Stability Rules

- Adding planner persistence must not require feature-specific bootstrap
  wiring outside the normal `src/data/<feature>/` contribution path
- `SessionPlanRepository` remains a planner-owned outbound collaborator
  beneath the planner-owned `SessionPlannerRuntimeRepository` injected into
  `SessionPlannerApplicationService`
- sessionplanner persistence stays the canonical home for session-owned
  allocations and selection state even when later workflows trigger encounter
  or loot mutations through foreign boundaries
- the current pointer model identifies the active persisted session and does
  not collapse the persisted catalog back to a single-session domain limit

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject persisted fields that duplicate encounter rosters, party
  character internals, creature detail, or loot internals.
- Review must reject runtime-service exports other than
  `SessionPlannerApplicationService.class`,
  `SessionPlannerCurrentSessionModel.class`,
  `SessionPlannerParticipantsModel.class`,
  `SessionPlannerEncountersModel.class`, and
  `SessionPlannerStatePanelModel.class`.

## References

- [Session Planner Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/domain/domain-session-planner.md:1)
- [Session Planner Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/architecture/architecture-session-planner.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)

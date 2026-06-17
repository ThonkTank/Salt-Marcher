Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-10
Source of Truth: Feature architecture, owning boundaries, and allowed seams
for the session planner session record and planning workspace.

# Session Planner Architecture

## Purpose

This specification defines the target architecture for the Session Planner
feature as a persisted session owner.

It owns:

- the shell entrypoint and slot usage
- the session planner application-service boundary
- the session-owned persistence boundary
- the allowed party and encounter dependency seams
- the rule that gold planning stays explicit placeholder state until a real
  owning rule exists

It does not own party progression rules, encounter-plan roster truth,
creature-detail truth, or loot truth.

## Feature Topology

- `src/view/leftbartabs/sessionplanner/SessionPlannerContribution`
  registers the left-bar tab
- `SessionPlannerBinder`
  owns shell lookup, role instantiation, listener wiring, and slot binding
- `SessionPlannerContributionModel`
  owns the observable planner projection surface
- `SessionPlannerIntentHandler`
  interprets planner controls and timeline events
- passive `SessionPlannerControlsView` and `SessionPlannerMainView`
  render the controls pane and the planning timeline
- `src/domain/sessionplanner/SessionPlannerApplicationService`
  is the only planner backend boundary exposed to the view layer
- the exported read-only planner observation surfaces are:
  `SessionPlannerCurrentSessionModel`,
  `SessionPlannerParticipantsModel`,
  `SessionPlannerEncountersModel`, and
  `SessionPlannerStatePanelModel`
- `src/domain/sessionplanner/model/session/SessionPlan`
  is the authored aggregate root for persisted session truth
- `src/data/sessionplanner/SessionPlannerServiceContribution.java`
  is the target feature-owned runtime entrypoint for planner persistence and
  service registration

Current state:

- the current implementation now uses `SessionPlan` plus
  `src/domain/sessionplanner/model/session/usecase/*UseCase.java` under
  planner-owned session repositories and canonical load/save session use cases
- `SessionPlannerApplicationService` now exposes focused planner workflows
  instead of one generic apply-command bag
- `src/data/sessionplanner/SessionPlannerServiceContribution.java` now owns
  planner registration, repository assembly, and read-only foreign-facts
  adapter assembly
- the current planner binder reads the four published planner read models
  directly from the runtime service registry instead of loading readback
  through the root service
- the current planner persistence stores multiple session records with a
  user-visible session name, a current-session pointer, and explicit
  create/open/rename/delete controls

Target state:

- `SessionPlannerApplicationService` is command-only and stays a thin
  orchestrator over a richer session domain model and one runtime repository
  port
- published planner readback is exported directly as four feature-owned
  models, not through the root service

## Dependency Rules

- the planner view layer may depend only on shell contracts, its own
  contribution roles, the `SessionPlannerApplicationService`, and the
  planner-owned published planner read models
- `SessionPlannerApplicationService` may depend only on planner-owned ports,
  planner-owned use cases, and planner-owned published carriers
- session participant facts must enter through the party public boundary
- encounter summaries and budget facts must enter through the encounter public
  boundary
- the planner must not import creature services, encounter repositories, party
  repositories, or foreign data adapters directly
- the planner data feature may adapt `PartyApplicationService`,
  `EncounterApplicationService`, and encounter-owned `published/*Model`
  handles only behind planner-owned read-only facts ports
- the planner may persist only session-owned references, allocations, and
  selection state
- gold placeholder state must not pretend that a computed gold budget exists

## Slot Model

- the planner is one `LEFT_BAR` runtime contribution
- it binds `COCKPIT_CONTROLS` for planning summary and imports
- it binds `COCKPIT_MAIN` for encounter order, rest placement, and loot
  placeholders
- it reserves `COCKPIT_STATE` for preparatory read-only session state context

## Session Record Model

- `SessionPlan` is authored session-owned truth, not transient-only workspace
  state
- the planner aggregate owns participant references, encounter-day assumptions,
  ordered session-encounter references, per-encounter budget allocations,
  selected encounter, placed rests, loot placeholders, and session-local
  status feedback
- foreign domains remain foreign:
  `party` owns character truth, `encounter` owns encounter-plan rosters,
  `creatures` owns statblocks, and later `loot` owns loot internals
- the view layer observes planner state through one read-only snapshot model
- the planner binder resolves that read-only model directly from the runtime
  registry instead of asking the root to load it
- mutations enter through explicit planner workflows, not through mutable view
  state or direct foreign application-service calls from the view layer
- the current persistence model keeps a persisted session list plus a current
  pointer used by the planner workspace

## Verification Notes

- the `sessionplanner` context-role contract and the canonical context map are
  `Mechanically Enforced` by `./gradlew checkDomainContextEnforcement`
- broader feature-boundary and role placement remain partly `Review-Owned`
  until the view, domain, and data harnesses gain dedicated session-planner
  knowledge

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Session Planner Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/contract/contract-session-planner-persistence.md:1)
- [Session Planner Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/requirements/requirements-session-planner.md:1)

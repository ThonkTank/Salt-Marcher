Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
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
- `SessionPlannerViewModel`
  owns the observable planner projection surface, widget-token lookup, scene
  drafts, and setup state
- passive `SessionPlannerControlsView`, `SessionPlannerTimelineMainView`, and
  `SessionPlannerStateView` render controls, planning timeline, and state panel
- `src/domain/sessionplanner/SessionPlannerApplicationService`
  is the only planner backend command boundary exposed to the view layer
- the exported read-only planner observation surfaces are:
  `SessionPlannerCurrentSessionModel`,
  `SessionPlannerCatalogModel`,
  `SessionPlannerParticipantsModel`,
  `SessionPlannerSceneTimelineModel`, and
  `SessionPlannerStatePanelModel`
- `src/domain/sessionplanner/model/session/SessionPlan`
  is the authored aggregate root for persisted session truth
- `src/data/sessionplanner/SessionPlannerServiceContribution.java`
  registers planner persistence; domain service registration is owned by
  `src/domain/sessionplanner/SessionPlannerServiceContribution.java`

Current state:

- the current implementation now uses `SessionPlan` under the planner-owned
  session repository and root-service load/save logic
- `SessionPlannerApplicationService` exposes focused planner workflows instead
  of one generic apply-command bag or split service facades
- `src/domain/sessionplanner/SessionPlannerServiceContribution.java` owns
  planner command/read-model registration and read-only foreign-facts adapter
  assembly
- `src/data/sessionplanner/SessionPlannerServiceContribution.java` owns only
  planner repository registration
- the current planner binder reads the published planner read models
  directly from the runtime service registry instead of loading readback
  through the root service
- the current planner persistence stores multiple session records with a
  user-visible session name, a current-session pointer, and explicit
  create/open/rename/delete controls

Target state:

- `SessionPlannerApplicationService` is command-only and stays a thin
  orchestrator over `SessionPlan`, one runtime repository port, foreign public
  read seams, and one shared published-state owner
- published planner readback is exported directly as feature-owned models, not
  through the root service

## Dependency Rules

- the planner view layer may depend only on shell contracts, its own
  contribution roles, the `SessionPlannerApplicationService`, and the
  planner-owned published planner read models
- `SessionPlannerApplicationService` may depend only on the planner repository
  seam, planner-owned fact carriers, foreign public read seams, and
  planner-owned published carriers
- session participant facts must enter through the party public boundary
- encounter summaries and budget facts must enter through the encounter public
  boundary
- the planner must not import creature services, encounter repositories, party
  repositories, or foreign data adapters directly
- the planner domain assembly may adapt `PartyApplicationService`,
  `EncounterApplicationService`, and foreign `published/*Model` handles only
  through planner-owned fact carriers
- the planner may persist only session-owned references, allocations, and
  selection state
- gold placeholder state must not pretend that a computed gold budget exists

## Slot Model

- the planner is one `LEFT_BAR` runtime contribution
- it binds `COCKPIT_CONTROLS` for planning summary and imports
- it binds `COCKPIT_MAIN` for compact setup input, scene order, rest placement,
  and loot placeholders
- it reserves `COCKPIT_STATE` for preparatory read-only session state context

## Session Record Model

- `SessionPlan` is authored session-owned truth, not transient-only workspace
  state
- the planner aggregate owns participant references, encounter-day assumptions,
  ordered session scenes, optional encounter-plan references, per-scene budget
  allocations, selected scene, placed rests, loot placeholders, and session-local
  status feedback
- foreign domains remain foreign:
  `party` owns character truth, `encounter` owns encounter-plan rosters,
  `creatures` owns statblocks, and later `loot` owns loot internals
- the view layer observes planner state through one read-only snapshot model
- the planner binder resolves planner read-only models directly from the runtime
  registry instead of asking the root to load it
- mutations enter through explicit planner workflows, not through mutable view
  state or direct foreign application-service calls from the view layer
- the current persistence model keeps a persisted session list plus a current
  pointer used by the planner workspace

## Verification Notes

- documentation-only edits use `./gradlew checkDocumentationEnforcement
  --console=plain`
- broader feature-boundary and placement questions remain review-owned until
  the migration ledger starts the sessionplanner area and its behavior harness
  inventory is closed

## References

- [Architecture Migration Roadmap](docs/project/architecture/architecture-migration-roadmap.md:1)
- [Layering Architecture Standard](docs/project/architecture/patterns/layering-architecture.md:1)
- [Session Planner Persistence Contract](docs/sessionplanner/contract/contract-session-planner-persistence.md:1)
- [Session Planner Requirements](docs/sessionplanner/requirements/requirements-session-planner.md:1)

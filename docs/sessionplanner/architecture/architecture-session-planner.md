Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Feature architecture, owning boundaries, and allowed seams
for the session planner workspace.

# Session Planner Architecture

## Purpose

This specification defines the first open architecture for the Session Planner
feature.

It owns:

- the shell entrypoint and slot usage
- the session planner runtime-service boundary
- the allowed party and encounter dependency seams
- the rule that gold planning stays explicit placeholder state until a real
  owning rule exists

It does not own party progression rules, encounter-plan persistence, or
creature-detail truth.

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
  owns the transient planner session
- `src/data/encounter/EncounterServiceContribution`
  currently registers the planner runtime service because the feature owns no
  persistence adapter of its own in the first iteration

## Dependency Rules

- the planner view layer may depend only on shell contracts, its own
  contribution roles, and the `SessionPlannerApplicationService`
- `SessionPlannerApplicationService` may depend only on
  `PartyApplicationService` and `EncounterApplicationService`
- saved encounter-plan budget data must enter through the encounter public
  boundary
- the planner must not import creature services, encounter repositories, or
  data adapters directly
- gold placeholder state must not pretend that a computed gold budget exists

## Slot Model

- the planner is one `LEFT_BAR` runtime contribution
- it binds `COCKPIT_CONTROLS` for planning summary and imports
- it binds `COCKPIT_MAIN` for encounter order, rest placement, and loot
  placeholders
- it does not claim `COCKPIT_STATE` in this first iteration

## Runtime Session Model

- planner state is transient domain-owned runtime state
- the planner runtime service owns imported encounter cards, placed rests, loot
  placeholders, and status feedback
- the view layer observes planner state through one read-only snapshot model
- mutations enter through explicit planner commands, not through mutable view
  state

## Verification Notes

- build correctness is currently `Mechanically Enforced` by `compileJava` and
  `build`
- feature-boundary and role placement remain partly `Review-Owned` until the
  view and domain harnesses gain dedicated session-planner knowledge

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Session Planner Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/requirements/requirements-session-planner.md:1)

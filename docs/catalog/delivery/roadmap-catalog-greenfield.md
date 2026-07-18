Status: Temporary Migration
Owner: Catalog Feature
Last Reviewed: 2026-07-18
Source of Truth: Ordered migration milestones, deletion gates, and current
migration position for the Catalog greenfield replacement.

# Catalog Greenfield Roadmap

## Purpose

This roadmap replaces the shipped JavaFX-owned Catalog orchestration with the
durable application-centered target in the Catalog requirements and
architecture. It owns temporary sequence and deletion gates, not user-visible
behavior or permanent architecture. It is deleted after M5 closes every legacy
boundary named below.

The migration preserves accepted Catalog behavior while replacing internal
types, packages, state models, and composition seams without compatibility
obligation.

## Authoritative Facts

- One `Katalog` tab exposes Monster, Items, Encounter, NPCs, Fraktionen, Orte,
  and Encounter-Tabellen.
- Section switching preserves filters, selection, paging, and unfinished input.
- Details open without implicitly changing Encounter or Scene state.
- Encounter and Scene changes require explicit named actions.
- Monster filters also constrain Encounter generation; Encounter tuning remains
  outside Catalog.
- Scene activity cannot replace the visible Monster query lifecycle.
- Internal Java types and package forms have no compatibility obligation while
  all production consumers move within this roadmap.

## Target Outcome

The completed Catalog has:

- one application-owned workspace and immutable state publication path
- one controller per independent section lifecycle, with a shared World
  Reference controller for NPCs, factions, and locations
- one result-state vocabulary and stable-id selection model
- one passive JavaFX workspace and shared table scaffold
- typed per-section provider dependencies and semantic outward routes
- Encounter-owned canonical pool-filter truth and no Catalog tuning dependency
- explicit subscription cleanup and stale-request rejection
- no legacy World Planner workspace binding, broad callback bag, no-op route,
  or JavaFX-owned provider orchestration

Catalog remains part of the local modular monolith. The roadmap adds no Catalog
domain, persistence, remote service, Gradle module, or dynamic plugin system.

## Surface Disposition

| Current surface | Decision | Migration consequence |
| --- | --- | --- |
| `CatalogWorkspace`, `CatalogSectionId`, persistent section roots | Adapt | Retain the behavior inside the application-owned lifecycle. |
| Foreign immutable APIs and models | Adopt | Consume only through provider APIs or typed routes. |
| `CatalogDataSources` and `CatalogActionRoutes` | Reject | Replace with grouped providers and semantic routes. |
| `CatalogContribution` provider orchestration | Reject | Move use cases into section controllers. |
| Monster controls/content models | Replace | Publish one Monster section state without tuning fields. |
| Items and saved-Encounter section-local orchestration | Replace | Adopt common result, lifecycle, and table behavior. |
| Generic reference selection by object equality | Reject | Preserve selection by stable provider id. |
| World Planner Inspector editors | Adopt | Retain as provider-owned Inspector content. |
| World Planner full workspace binding | Reject | Delete after World Reference migration. |
| Existing production UI tests | Adapt | Keep behavioral proof while replacing structural assumptions. |

## Compatibility Budget

M1 may introduce exactly one package-private `LegacyCatalogBindingAdapter` to
render the existing Catalog views from the new application seam while later
sections migrate.

- It has no public API and no new production caller beyond `CatalogFeature`.
- It may not introduce nullable providers, no-op actions, or duplicate durable
  state.
- M2 through M4 remove the legacy surfaces it wraps.
- M5 deletes the adapter and mechanically rejects its return.

No other compatibility layer may survive a milestone boundary.

## Milestone Dependency Order

```text
M0 Target Lock And Documentation
  -> M1 Application Seam And Lifecycle
      -> M2 Monster Vertical Slice
          -> M3 Items And Saved Encounters
              -> M4 World References And Encounter Tables
                  -> M5 Convergence, Legacy Deletion, And Acceptance
```

## Current Migration Position

- Current foundation: M0 through M4 are merged. PR #516 completed the seven
  native section renderers, moved World Reference and Encounter Table work into
  application controllers, and deleted the obsolete World Planner workspace
  while retaining its provider-owned Inspector/editor path.
- Current milestone: M5 has a locally green technical candidate in draft PR
  #517. It deletes `LegacyCatalogBindingAdapter`, removes presentation-owned
  section lifecycle work and no-op interaction fallbacks, makes application
  controllers own activation and initial loading, models paging as an explicit
  optional scaffold capability, and adds target-architecture enforcement.
  `./gradlew architectureTest`, `./gradlew check`, desktop installation, and
  diff whitespace proof are green after the final technical diff.
- Remaining gates: complete the independent post-M5 review cycle, repair and
  re-prove any findings, obtain owner visual and interaction acceptance, merge
  PR #517 with required CI green, then delete this temporary roadmap and its
  Catalog README link in a documentation cleanup PR.

## Delivery Rules

Every implementation milestone must:

1. preserve the runnable production Catalog and pass `./gradlew check`
2. move at least one real production path to the target application seam
3. delete replaced code in the same milestone unless it is explicitly covered
   by the single compatibility budget
4. keep JavaFX passive and provider truth in its owning feature
5. add production-route proof for changed observable behavior
6. finish with a literal green desktop install after the full check

## M0: Target Lock And Documentation

### Deliver

- keep Catalog requirements limited to observable behavior and acceptance
- replace the presentation-only architecture with the application-centered
  target, boundaries, decisions, and enforcement ownership
- route the temporary migration only from the Catalog README
- establish this roadmap as the sole migration status and sequencing owner

### Exit Gate

- no durable Catalog document calls the feature a presentation-only aggregator
- requirements contain no package, application-layer, persistence-owner, or
  provider-implementation decisions
- architecture defines application ownership, provider boundaries, state,
  lifecycle, concurrency, and rejected alternatives
- every legacy surface named by M1 through M5 has one deletion milestone
- documentation whitespace proof is green

## M1: Application Seam And Lifecycle

### Deliver

- add `CatalogFeature.create(CatalogProviders, CatalogRoutes)`
- add `CatalogWorkspaceController`, immutable workspace publication, and typed
  activation, deactivation, and close behavior
- define `CatalogResultState<Row>` and the section-specific state wrappers
- define grouped required providers and semantic Inspector, Encounter, and
  Scene routes
- introduce the single permitted `LegacyCatalogBindingAdapter`
- move subscription ownership and current-snapshot application out of JavaFX

### Exit Gate

- one application-owned lifecycle drives the production Catalog binding
- activate/deactivate cycles balance every provider subscription
- no stale request can publish after deactivation or a newer revision
- the visible Catalog remains behaviorally unchanged

### Delete

- direct subscription ownership from `CatalogContribution`
- constructor-triggered provider refresh work in JavaFX-facing models
- nullable required World Reference providers in the new seam

## M2: Monster Vertical Slice

### Deliver

- move Monster query, filter draft, sort, page, selection, and request revision
  into `MonsterCatalogController`
- introduce `CatalogTableScaffold` with Monster as its first production adopter
- make Creature Inspector opening one atomic typed route
- map visible Monster filters to Encounter pool-filter commands and readback
- retain the separate creature reference-index lifecycle used outside Catalog

### Exit Gate

- Monster rows and selection derive from one application state revision
- late query results cannot replace newer rows
- filter changes update visible results and Encounter pool filters without
  changing tuning
- Scene refresh cannot alter Monster state

### Delete

- Catalog tuning sliders, projections, preview subscriptions, and input fields
- the old Monster `CatalogViewModel`, controls content state, and main content
  state after their final production consumer moves
- the two-step global Creature detail selection plus Inspector race

## M3: Items And Saved Encounters

### Deliver

- move Items filters, validation, query revision, paging, and detail loading to
  `ItemsCatalogController`
- publish all Items result states through the common result vocabulary
- move saved-plan state and confirmation intent to
  `SavedEncounterCatalogController`
- adopt the shared table scaffold and stable-id selection in both sections

### Exit Gate

- Items I/O remains off the JavaFX thread and every result status is visible
- stale Item page or detail results cannot replace newer requests
- saved-plan replacement requires confirmation exactly when requested by
  Encounter
- switching sections preserves both section states

### Delete

- `ItemsCatalogSection` query and Inspector orchestration
- `SavedEncounterCatalogSection` provider subscription and command orchestration
- their bespoke table, status, and paging implementations

## M4: World References And Encounter Tables

### Deliver

- publish separate NPC, faction, and location states from one
  `WorldReferenceCatalogController`
- preserve selection by stable NPC, faction, and location ids
- migrate Encounter Tables to `EncounterTableCatalogController`
- route create, Inspector, Encounter-source, Scene-member, and Scene-location
  intents through semantic routes
- keep World Planner validation and editor content provider-owned

### Exit Gate

- loading, empty, and failed provider snapshots remain distinguishable;
  unavailable is represented only when an owning provider can express it
- refreshing labels or relationships preserves a still-present selection
- default row opening changes only Inspector content
- every explicit handoff reaches exactly its named destination

### Delete

- generic reference selection by object equality
- JavaFX-owned reference label joins and handoff commands
- the old World Planner controls/main/state workspace binding and unused views

## M5: Convergence, Legacy Deletion, And Acceptance

### Deliver

- move all remaining views to the application state and shared JavaFX scaffold
- simplify application composition to grouped providers and semantic routes
- close architecture, lifecycle, async, UI, and handoff proof gaps
- complete owner visual and interaction acceptance

### Exit Gate

- zero JavaFX-owned provider queries, subscriptions, or cross-feature commands
- zero Catalog imports from foreign implementation packages
- all seven sections use the common state and interaction contract
- `./gradlew check` and desktop install are green after the final deletion diff
- owner approves the complete Catalog behavior

### Delete

- `LegacyCatalogBindingAdapter`
- `CatalogDataSources`, `CatalogActionRoutes`, compatibility constructors, and
  no-op action fallbacks
- obsolete section frames, content models, input events, and duplicate chrome
- this roadmap and its README link after the migration merge

## Risks And Dependencies

- Monster filters serve both browsing and Encounter generation; M2 must prove
  both routes rather than treating one as a projection detail.
- Provider snapshot models have different error vocabularies; controllers map
  them to Catalog status without erasing provider diagnostics.
- The current shell has activation hooks but no general disposal API. M1 must
  close the Catalog component from application lifecycle as well as deactivate
  the active binding.
- Existing tests encode current JavaFX structure. Each milestone preserves the
  behavioral oracle while deleting assertions that require retired internals.

## References

- [Catalog Requirements](../requirements/requirements-catalog.md)
- [Catalog Architecture](../architecture/architecture-catalog.md)
- [Catalog Feature Index](../README.md)
- [Documentation Standard](../../project/documentation.md)

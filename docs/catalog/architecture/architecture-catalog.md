Status: Active Target
Owner: Catalog Feature
Last Reviewed: 2026-07-18
Source of Truth: Catalog application ownership, presentation boundary, and
dependency direction.

# Catalog Architecture

## Entity, Stakeholders, And Concerns

Catalog is the application capability for finding, evaluating, and explicitly
handing reference content to another active workspace. GMs need one predictable
reference surface during preparation and table play. Feature maintainers need
provider truth and validation to remain cohesive. UI maintainers need one state
and lifecycle model rather than separate section-specific orchestration stacks.

The primary concerns are responsive asynchronous lookup, stable workspace
state, explicit side effects, provider independence, consistent presentation,
and complete retirement of the current JavaFX-owned orchestration.

## Target Topology

```text
features/catalog/
├── application/
│   ├── CatalogWorkspaceController
│   ├── monster/MonsterCatalogController
│   ├── items/ItemsCatalogController
│   ├── encounters/SavedEncounterCatalogController
│   ├── world/WorldReferenceCatalogController
│   └── tables/EncounterTableCatalogController
├── adapter/javafx/
│   ├── CatalogContribution
│   ├── CatalogWorkspaceView
│   ├── CatalogSectionHost
│   └── CatalogTableScaffold
└── CatalogFeature
```

Catalog owns an application and JavaFX role. It owns no domain or persistence
role because it defines no durable business truth and stores no reference
records.

## Application Ownership

`CatalogWorkspaceController` owns the active section, the lifetime of every
section controller, and immutable workspace publication. It delegates queries
and actions to the controller that owns the selected section; it does not
contain provider-specific filter or mapping logic.

Every section controller owns:

- its Catalog-specific query and draft state
- its request revision and current result projection
- stable selection identity, sort, and paging where applicable
- translation between user intents and provider APIs or typed outward routes
- activation, deactivation, and subscription cleanup

`WorldReferenceCatalogController` may serve the NPC, faction, and location
sections because they share one provider snapshot and lifecycle. Their
published section states remain distinct.

Every section publishes an immutable `CatalogResultState<Row>` with a typed
status covering loading, ready, empty, invalid input, unavailable, and failed
outcomes. A section-specific state wraps that result together with its filters,
selection id, page, and unfinished input. JavaFX properties and nodes do not
cross into application state.

## Provider And Action Boundaries

`CatalogFeature.create(CatalogProviders, CatalogRoutes)` is the feature-root
composition entry point. `CatalogProviders` groups required dependencies by
section as `MonsterProviders`, `ItemsProviders`, `SavedEncounterProviders`,
`WorldReferenceProviders`, and `EncounterTableProviders`. Required providers
are never nullable and have no no-op fallback.

`CatalogRoutes` groups semantic outward capabilities:

- `CreatureInspectorRoute`
- `ItemInspectorRoute`
- `WorldInspectorRoutes`
- `EncounterHandoff`
- `SceneHandoff`

Catalog application code may consume foreign feature APIs. It MUST NOT import a
foreign domain, application, composition root, JavaFX adapter, or persistence
adapter. Provider-owned Inspector content is supplied through the typed routes;
Catalog does not rebuild foreign editors.

Creature details load and open through one route so a global detail selection
and Inspector push cannot race. Encounter and Scene changes occur only through
explicit handoff intents.

## Monster Query And Encounter Filters

Catalog owns the visible Monster query draft. It sends the query to the
creature catalog provider and maps the relevant filter values to an Encounter
pool-filter command. Encounter owns the canonical generation-filter truth and
publishes readback when it changes elsewhere.

Catalog never reads or writes Encounter tuning. Difficulty, balance, amount,
and diversity remain Encounter-owned inputs and presentation.

Catalog page queries remain independent from the creature reference index used
by Scene and World Planner. A Scene or World Planner refresh therefore cannot
replace the Catalog's visible page lifecycle.

## JavaFX Boundary

The JavaFX adapter renders immutable application state and translates raw
control events into application intents. It performs no provider query,
cross-feature command coordination, or subscription ownership.

`CatalogTableScaffold` owns shared header, result status, table behavior,
stable-id selection, optional paging, keyboard interaction, accessibility, and
the action-column layout. Section renderers supply columns, filters, and the
available typed actions. The seven section roots remain alive for the active
Catalog binding so switching sections does not discard local view state.

`CatalogControlsScaffold` owns the fixed toolbar, responsive filter and chip
wrapping, feedback placement, and bounded controls height.
`CatalogControlKit` is the only Catalog owner for constructing and assigning
visual roles to section tabs, search inputs, labeled selections, sort controls,
and actions. Labels are rendered by the interactive control, not by adjacent
layout nodes. `CatalogMultiSelect` owns the one reusable checkable filter
popup. `CatalogTableScaffold` obtains paging and row actions from the same kit.

`CatalogSection.controls()` returns the concrete scaffold instead of an
arbitrary JavaFX root. Section renderers retain typed control references for
state rendering and intent translation, but they neither style those controls
nor construct parallel control layouts. These Catalog-specific presentation
primitives remain in the Catalog JavaFX adapter; they do not justify a
feature-neutral dynamic form or filter schema.

## Lifecycle And Concurrency

Activating Catalog registers provider subscriptions and applies each current
snapshot before accepting later publications. Deactivating Catalog unregisters
subscriptions, invalidates in-flight request generations, and retains immutable
workspace state for later reactivation. Closing the Catalog component releases
all remaining resources.

Persistence- or file-backed provider calls remain non-blocking. Each request
captures a local revision; a result may publish only when its revision is still
current. Application publication uses the feature-neutral UI dispatcher before
the JavaFX adapter mutates controls.

## Decisions And Rejected Alternatives

- A JavaFX-only aggregator is rejected because Catalog already owns query,
  lifecycle, projection, and handoff use cases.
- A Catalog domain or copied provider database is rejected because it would
  duplicate provider truth and introduce synchronization invariants without a
  user need.
- A dynamic section plugin registry is rejected because seven statically known
  sections do not justify discovery or runtime extension machinery.
- Broad data-source and callback bags are rejected because they hide per-section
  dependencies and permit silent no-op behavior.
- Long-lived compatibility adapters are rejected. The migration may retain one
  internal adapter only under the deletion budget owned by the delivery
  roadmap.

## Enforcement And Verification Ownership

`architectureTest` mechanically enforces valid feature roles, foreign API-only
dependencies, the shared control kit and control/table scaffolds for all seven
sections, and the absence of JavaFX dependencies from Catalog application
code. UI behavior tests own the seven-section workspace, measured control
rhythm, inside-label composition, responsive result space, state preservation,
stable-id selection, visible result states, and explicit handoff behavior.
Lifecycle tests own balanced subscription and request invalidation behavior.
Final visual and interaction acceptance remains owner manual testing.

## References

- [Catalog Requirements](../requirements/requirements-catalog.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
- [Feature Boundaries](../../project/architecture/patterns/feature-boundaries.md)
- [Shell Layer](../../project/architecture/patterns/shell-layer.md)

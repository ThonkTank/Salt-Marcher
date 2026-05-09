Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-04
Source of Truth: Complete invariant catalog for the reusable `*ContentModel`
role itself in `src/view/slotcontent/**`.

# View ContentModel Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
reusable `*ContentModel` role itself.

Architectural truth for reusable `*ContentModel` lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
This document owns only ContentModel-local enforcement inventory and current
mechanical drift.

It answers three questions for every reusable `*ContentModel` surface:

- what the role MUST or MAY contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own reusable-unit role count or required-existence
rules, passive `View` read or mutation rules, Binder-owned runtime-service
lookup, or `IntentHandler` / `*ViewInputEvent` / legacy `*PublishedEvent`
protocol rules. Those stay in the neighboring role-enforcement documents and
in the view-layer and layering standards.

Merged focused bundle entrypoint:

- `./gradlew checkViewContentModelEnforcement --rerun-tasks --console=plain`
  runs the focused reusable `ContentModel` bundle. Reusable-unit role-shape
  topology enters transitively through `./gradlew checkViewLayerEnforcement`.
  Canonical compile-side blocking behavior remains at `./gradlew compileJava`;
  aggregate blocking behavior enters `./gradlew checkArchitecture` and
  `./gradlew check` through this focused role task.

## Invariant Catalog

### Role Shape

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contentmodel-reusable-role-shape` | Enforced | every reusable projection-model role file in `src/view/slotcontent/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` and `./gradlew checkViewContentModelEnforcement` | A reusable `slotcontent/**` projection-model role uses the reusable role shape `*ContentModel.java` rather than active-root `*ContributionModel.java` or legacy `*ViewModel.java`, `*PresentationModel.java`, or `*Projector.java` files. |

The target reusable-slotcontent architecture uses exactly one `*ContentModel`
per reusable unit. That `ContentModel` owns component-specific presentation
state and component-specific presentation logic for its own reusable unit so
the active-root `*ContributionModel` can orchestrate child components instead
of becoming a component-level god-model. Reusable `*ContentModel`s do not pair
with reusable local `*IntentHandler`s in the target architecture.

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contentmodel-observable-bindable-projection-surface` | Review-Owned | every reusable `*ContentModel.java` under `src/view/**` | none | none | A `ContentModel` is a bindable observable projection surface, not a service, adapter, or imperative workflow owner. |
| `view-contentmodel-render-relevant-state-scope` | Review-Owned | every reusable `*ContentModel.java` under `src/view/**` | none | none | A `ContentModel` may contain the reusable render-relevant state of its own `slotcontent/**` unit, such as text, render data, labels, and enablement facts that its passive `View` surface renders. |
| `view-contentmodel-input-relevant-state-when-root-interpretation-needs-it` | Review-Owned | every reusable `*ContentModel.java` whose active-root `IntentHandler` needs local facts to interpret a reused `*ViewInputEvent` | none | none | A `ContentModel` may contain local input-relevant facts such as selections, active tools, hovered targets, and comparable component-local interpretation state when the same-root active `IntentHandler` needs those facts to interpret that reusable unit's `*ViewInputEvent`. |
| `view-contentmodel-render-ready-component-state` | Review-Owned | every reusable `*ContentModel.java` under `src/view/**` | none | none | A `ContentModel` may own render-ready, hit-ready, label, geometry, ordering, and comparable presentation facts for its own reusable `View` when that keeps the View flat and direct instead of reconstructing those facts at render time. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contentmodel-no-nested-input-or-command-carriers` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelFlatSurface` | `./gradlew compileJava` | A `ContentModel` does not declare nested `*Intent`, `*Input`, `*Request`, `*Command`, `*Query`, `*Operation`, or `*Edit` carrier types. |
| `view-contentmodel-no-published-to-published-translation` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelPublishedTranslationBoundary` | `./gradlew compileJava` | A `ContentModel` does not construct domain `published/**` carriers. Read-side normalization and projection publication stay in the owning application-service or runtime projection boundary instead of inside the view layer. |
| `view-contentmodel-no-request-or-orchestration-state` | Review-Owned | every reusable `*ContentModel.java` under `src/view/**` | none | none | A `ContentModel` does not contain request fields, command carriers, service handles, shell contracts, or deep orchestration state. Hidden workflow channels do not belong to a flat observable projection surface. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contentmodel-read-side-and-local-support-direct-boundary-only` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewContentModelEnforcement` | A `ContentModel` communicates directly only with read-side domain `published/**` carriers, JavaFX beans or collections, and allowed same-surface local value/support types. In target architecture that includes owning the listener-side reaction for any component-local `published/*Model` readback it projects. |
| `view-contentmodel-no-shell-data-bootstrap-or-applicationservice-communication` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewContentModelEnforcement` | A `ContentModel` does not communicate directly with `shell/**`, `bootstrap/**`, `src/data/**`, or root `*ApplicationService` boundaries. |
| `view-contentmodel-no-domain-internal-or-write-side-communication` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewContentModelEnforcement` | A `ContentModel` does not communicate directly with domain internals or with write-side `published/**` carrier families such as `*Command`, `*Query`, `*Operation`, or `*Edit`. Domain reach stays read-side only. |
| `view-contentmodel-no-foreign-view-role-or-foreign-unit-communication` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewContentModelEnforcement` | A `ContentModel` does not communicate directly with `*Contribution`, `*Binder`, `*IntentHandler`, `*View`, `*ViewInputEvent`, `*PublishedEvent`, `*InspectorEntry`, or foreign view-unit role families. |
| `view-contentmodel-dungeonmap-runtime-context-projection-only` | Enforced | `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java` | Error Prone `DungeonMapContentModelProjectionBoundary` | `./gradlew compileJava` | This is an explicit feature-scoped exception inside the shared View ContentModel checker surface: `DungeonMapContentModel` consumes only the runtime-context map projection carriers (`DungeonEditorMapProjectionSnapshot` and `TravelDungeonMapProjectionSnapshot`) rather than raw dungeon editor or travel map surface families such as `DungeonEditorSurface`, `DungeonEditorMapSnapshot`, `DungeonEditorPreview`, `TravelDungeonSurface`, or `TravelDungeonMapSnapshot`. |
| `view-contentmodel-no-separate-presentation-event-or-callback-protocol` | Review-Owned | every reusable `*ContentModel.java` under `src/view/**` | none | none | A `ContentModel` exposes observable state only. It does not grow separate presentation-event, callback, acknowledgement, or presenter-style communication APIs. |

## Candidate

- mechanizing broader size or responsibility heuristics for view-owned state
  bags after the hard published-translation and dungeon-map projection
  boundaries above
- mechanizing broader prepared-scene and prepared-hit candidate detection for
  reusable shared primitives once the report-only view-layer refactor surface
  has stabilized

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)

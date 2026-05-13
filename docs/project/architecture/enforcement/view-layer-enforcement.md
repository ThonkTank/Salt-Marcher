Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-13
Source of Truth: Layer-wide enforcement inventory for cross-role topology and
current mechanical drift in `src/view/**` that is not owned by one specific
view role document.

# View Layer Enforcement

## Goal

This document owns only the layer-wide enforcement inventory for `src/view/**`
that is not owned by one specific view role document.

It answers three questions for `src/view/**`:

- what the layer MUST contain
- what the layer MUST NOT contain
- which direct communication seams MAY and MUST NOT exist inside the layer
  itself and at its documented backend boundary

Canonical view-layer architecture truth lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
Role-local API, payload-shape, and dependency-detail rules live only in the
neighboring `view-*.md` enforcement documents. Repository-wide cross-layer
rules stay in `layering-architecture-enforcement.md`. This file is a routing
surface for current layer-wide proof and drift only, not a second architecture
owner.

Focused bundle entrypoint:

- `./gradlew checkViewEnforcement --console=plain` runs the currently
  active closed-world view-layer topology checks. The focused role tasks
  `checkViewEnforcement`, `checkViewEnforcement`,
  `checkViewEnforcement`, `checkViewEnforcement`,
  `checkViewEnforcement`, `checkViewEnforcement`,
  and `checkViewEnforcement` consume that same topology proof
  transitively before their compile-bound role checks run. `checkViewEnforcement`,
  `check`, and `build` include the same layer-focused proof surface
  transitively.

Rows below are interpreted only relative to the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
Where current gates lag that owner, the row names that drift explicitly.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-active-root-file-role-allowlist` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewTopologyPerimeterRules`; build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Active roots may contain only documented top-level role files: `*Contribution`, `*Binder`, exactly one aggregate `*ContributionModel`, optional `*IntentHandler`, passive `*View`, same-stem `*ContentModel`, and same-stem `*ViewInputEvent` only for interactive Views. |
| `view-layer-active-root-contribution-count` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Each active root defines exactly one `*Contribution.java`. |
| `view-layer-active-root-binder-count` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Each active root defines exactly one `*Binder.java`. |
| `view-layer-active-root-contributionmodel-count` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Each active root defines exactly one aggregate `*ContributionModel.java`. |
| `view-layer-active-root-view-required` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Each active root defines at least one passive `*View.java` surface. |
| `view-layer-view-contentmodel-same-stem-required` | Enforced | every passive `*View.java` under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Every passive `*View` must have exactly one co-located same-stem `*ContentModel.java`, and every `*ContentModel.java` must belong to exactly one same-stem passive `*View.java`. |
| `view-layer-active-root-intenthandler-max-one` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Each active root may define at most one local `*IntentHandler.java`. |
| `view-layer-interactive-active-root-views-own-local-same-stem-viewinputevent-and-intenthandler` | Enforced | every interactive same-root passive `*View` surface inside an active root | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Each interactive passive same-root `*View` owns exactly one same-stem local `*ViewInputEvent.java`, and that interactive local unit also owns a local `*IntentHandler`. |
| `view-layer-active-root-no-publishedevent-role` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewTopologyPerimeterRules`; build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Active roots do not define top-level `*PublishedEvent.java` files. |
| `view-layer-slotcontent-file-role-allowlist` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewTopologyPerimeterRules`; build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Reusable `slotcontent/**` units may contain only the documented top-level role files, only in the documented direct-file reusable layout, and rename or move bypasses block directly as foreign directory, depth, or role-form violations. |
| `view-layer-slotcontent-contentmodel-max-one` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Each reusable unit defines exactly one same-stem `*ContentModel.java` for its one passive `*View.java`. |
| `view-layer-slotcontent-reusable-unit-shape` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules`; build-harness `ViewTopologyPerimeterRules` | `./gradlew checkViewEnforcement` | Each reusable unit defines exactly one top-level `*View.java`, exactly one same-stem `*ContentModel.java`, and a same-stem `*ViewInputEvent.java` only when that reusable View is interactive, with no foreign top-level roles. |
| `view-layer-slotcontent-no-local-intenthandler-interpretation-role` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules`; build-harness `ViewTopologyPerimeterRules` | `./gradlew checkViewEnforcement` | Reusable `slotcontent/**` units do not define local `*IntentHandler.java` role files. |
| `view-layer-slotcontent-no-reusable-publishedevent-or-inspector-role` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules`; build-harness `ViewTopologyPerimeterRules` | `./gradlew checkViewEnforcement` | Reusable `slotcontent/**` units do not define top-level `*PublishedEvent.java` or `*InspectorEntry.java` files. |
| `view-layer-slotcontent-no-support-carrier-role-family` | Enforced | every reusable `slotcontent/**` unit under `src/view/**`, including `slotcontent/primitives/**` | build-harness `ViewTopologyPerimeterRules` | `./gradlew checkViewEnforcement` | Reusable `slotcontent/**` units, including `slotcontent/primitives/**`, do not define primitive-only support-carrier families such as `*Scene`, `*PointerEvent`, `*Signal`, or `*Support`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-slotcontent-no-contribution` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Reusable `slotcontent/**` units do not define `*Contribution.java`. |
| `view-layer-slotcontent-no-binder` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Reusable `slotcontent/**` units do not define `*Binder.java`. |
| `view-layer-slotcontent-no-contributionmodel` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Reusable `slotcontent/**` units do not define active-root `*ContributionModel.java` files. |
| `view-layer-primitives-single-technical-view-root` | Enforced | every reusable `slotcontent/primitives/**` unit under `src/view/**` | build-harness `ViewTopologyPerimeterRules`; build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | `slotcontent/primitives/**` is enforced as the same closed reusable three-role unit shape as every other reusable `slotcontent/**` bucket. |
| `view-layer-primitives-no-non-technical-role-files` | Enforced | every reusable `slotcontent/primitives/**` unit under `src/view/**` | build-harness `ViewTopologyPerimeterRules` | `./gradlew checkViewEnforcement` | `slotcontent/primitives/**` does not admit primitive-only top-level carrier roles or any other foreign role files. |
| `view-layer-no-non-role-bearing-standalone-files` | Enforced | every top-level file under an active root or reusable `slotcontent/**` unit inside `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | The view layer does not grow non-role-bearing standalone files. The correct owner for displaced view logic is defined only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1), not by ad hoc new top-level helpers. |
| `view-layer-no-direct-applicationservice-result-to-viewstate-readback` | Enforced Elsewhere | every Binder-owned readback path from a root `*ApplicationService` into a local `*ContributionModel`, `*ContentModel`, or passive `*View` | Error Prone `ViewBinderApplicationServiceReadback` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | Domain-backed view state and domain-owned feedback do not arrive as any `ApplicationService` return value. Binders use root `*ApplicationService` boundaries only for command publication; the readback source stays a direct same-context read-side `published/*Model` runtime service consumed through `current()` and `subscribe(...)` only. |
| `view-layer-no-responsibility-expansion-when-intenthandler-is-absent` | Review-Owned | every reusable `slotcontent/**` unit and every non-interactive active-root unit without a local `*IntentHandler` | none | none | The absence of a reusable local `*IntentHandler` does not expand passive `View` responsibilities; reusable interpretation belongs in the same-root active handler, and non-interactive active-root units stay passive instead of parking interpretation, callback mutation, or write-side publication in the view surface. |
| `view-layer-no-responsibility-expansion-when-contentmodel-is-absent` | Review-Owned | every passive `*View` that still lacks a same-stem `*ContentModel` during migration | none | none | Missing same-stem ContentModel ownership must still be judged against the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1); migration debt does not authorize improvised replacement roles, helper spillover, or View-owned projection logic. |
| `view-layer-slotcontent-reuse-only` | Review-Owned | every reusable `slotcontent/**` unit under `src/view/**` | none | none | `slotcontent/**` is reserved for genuinely reusable generic components and is not used to hide feature-specific one-off units behind a generic path. |
| `view-layer-no-reverse-reuse-dependency-direction` | Review-Owned | every dependency or inheritance edge between feature-specific view roots, reusable `slotcontent/**`, and `slotcontent/primitives/**` | none | none | Reuse direction stays one-way: contribution-specific code may depend on reusable `slotcontent/**`, reusable `slotcontent/**` may depend on `slotcontent/primitives/**`, and the reverse direction does not appear. |
| `view-layer-no-legacy-view-role-buckets` | Enforced | every active or reusable unit under `src/view/**` | build-harness `ViewTopologyPerimeterRules`; build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Legacy `*ViewModel`, `*PresentationModel`, `*Projector`, component-local `View/`, `assembly/`, `Controller/`, `interactor/`, old `api/`, and other foreign role or directory forms are blocked as closed-world topology violations instead of falling through as tolerated legacy buckets. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-two-presentation-state-mutation-cycles-only` | Review-Owned | every path that can mutate presentation state inside an active root or reusable `slotcontent/**` unit | none | none | Presentation-state mutation rules are owned only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1). This row keeps the layer-wide review claim that no extra mutation protocol appears outside that owner. |
| `view-layer-viewinputevent-single-outbound-route` | Enforced Elsewhere | every interactive passive `*View` surface inside `src/view/**` | Error Prone `PassiveViewSurfaceBoundary`; Error Prone `ViewBinderViewInputEventWiring`; Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | The single outbound input route is defined only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1) and the neighboring `View`, `ViewInputEvent`, `Binder`, and `IntentHandler` enforcement docs. This row only aggregates the current proof surface. |
| `view-layer-view-contentmodel-bind-only` | Enforced Elsewhere | every passive `*View` surface inside `src/view/**` that receives prepared render state | Error Prone `PassiveViewSurfaceBoundary`; Error Prone `PassiveViewInteractionBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | Prepared render state enters a passive `View` only through its own same-stem `bind(SameStemContentModel)` route. Direct `ContributionModel` acquaintance, foreign `ContentModel` acquaintance, project-typed sink payloads, constructor-injected callback relays, and imperative render APIs are not part of the legal route. |
| `view-layer-no-direct-view-callback-protocols-beside-viewinputevent` | Enforced Elsewhere | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewSurfaceBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | This row aggregates current proof for the single passive-view callback route, including reusable primitive Views. The owner truth remains the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1). |
| `view-layer-no-passive-view-owned-semantic-state-or-pre-intenthandler-snapshot-collapse` | Enforced Elsewhere | every passive `*View.java` and same-stem top-level `*ViewInputEvent` construction path inside `src/view/**` | Error Prone `PassiveViewStateBoundary`; Error Prone `PassiveViewInteractionBoundary`; Error Prone `ViewInputEventSnapshotBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A passive `View` does not open a third local state or interpretation protocol by holding canonical semantic state bags, keeping extra project acquaintances, constructing same-root projection/write carriers, locally reshaping prepared data, or semantically collapsing raw UI state before the local `IntentHandler` interprets the same-stem `*ViewInputEvent` snapshot. |
| `view-layer-intenthandler-direct-applicationservice-write-seam` | Enforced Elsewhere | every active-root domain-write path that originates from `*ViewInputEvent` interpretation inside `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary`; Error Prone `ViewBinderApplicationSinkWiring`; Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | Domain writes leave the view layer only through direct active-root `IntentHandler -> *ApplicationService` calls. Binder-injected legacy outward-work sinks, active-root `PublishedEvent` callback seams, and `ViewInputEvent` carriers that mirror `PublishedEvent` write protocols are blocked. |
| `view-layer-no-direct-view-to-applicationservice-path` | Enforced Elsewhere | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewInteractionBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | Passive `View` surfaces do not communicate directly with root `*ApplicationService` boundaries. |
| `view-layer-no-direct-view-domain-connection-outside-write-and-readback-seams` | Enforced Elsewhere | every direct connection between `src/view/**` and `src/domain/**` | `view-binder-dependency-boundary`; `view-binder-no-legacy-intenthandler-write-sink-injection`; `view-intenthandler-root-applicationservice-boundary-surface`; `view-intenthandler-no-non-applicationservice-domain-dependencies`; `view-contributionmodel-read-side-only-direct-boundary`; `view-contentmodel-read-side-only-direct-boundary`; `view-viewinputevent-view-origin-and-intenthandler-target-only` | see neighboring owner docs and their listed entrypoints | The allowed view/domain seam is owned only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1) and the neighboring role-specific enforcement docs. This row records the current blocker surface for that contract. |
| `view-layer-fire-and-forget-full-snapshot-semantic-adequacy` | Review-Owned | every interactive local unit that uses `*ViewInputEvent` | none | none | The remaining judgment about whether a mechanically legal `*ViewInputEvent` is the one semantically adequate full technical snapshot for its surface stays review-owned. The blocker-owned part of the contract already forbids alternate callback routes, `PublishedEvent` mirror protocols, and pre-`IntentHandler` semantic collapse. |

## Candidate

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-slotcontent-genuine-reuse-diagnostic` | Candidate | every future reusable `slotcontent/**` unit under `src/view/**` | none | none | The quality stack could emit a dedicated blocker when a mechanically legal `slotcontent/**` unit is actually feature-specific and not genuinely reusable. |
| `view-layer-reuse-direction-mechanization` | Enforced | every compiled dependency edge between contribution-specific units, reusable `slotcontent/**`, and `slotcontent/primitives/**` | view-layer bundle jQAssistant `ViewLayerReuseDirection` | `./gradlew checkViewEnforcement` | Reusable `slotcontent/**` code does not depend back upward into feature-specific view roots, and primitive reusable code does not depend upward into feature-specific or non-primitive reusable units. |

## Review-Owned

- whether current layer-wide gate drift has been fully migrated to the owner
  rules in the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- whether a mechanically legal local split still keeps role ownership obvious
  instead of hiding view logic behind extra top-level files
- whether current legacy reusable-slotcontent roles and primitive-only
  exceptions still survive outside the owner target shape

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View ContributionModel Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-model-enforcement.md:1)
- [View ContentModel Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-content-model-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)

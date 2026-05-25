Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-13
Source of Truth: Complete invariant catalog for passive `*View` surfaces in
`src/view/**`, limited to constraints proven directly on `*View.java` files,
passive-`View`-owned FXML resources, or review-owned passive-`View`
semantics.

# View Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
passive `*View` role itself.

Architectural truth for passive `*View` lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
This document owns only passive-View-local enforcement inventory and current
mechanical drift.

It answers four questions for every passive `*View` surface:

- what the file MUST contain
- what the file MUST NOT contain
- with which direct seams the file MAY communicate
- which remaining passive-`View` semantics are still review-owned

This document does not own `*ViewInputEvent` carrier existence or shape,
Binder-installed wiring, `IntentHandler` entrypoint shape, or `*PublishedEvent`
routing. Those stay in the neighboring role documents.
It does own the passive-View-side claim that the only legal project-facing
outbound seam is the same-stem `*ViewInputEvent` route built by the `View`
itself, and that prepared render state enters only through the View's own
same-stem `ContentModel` rather than through foreign model acquaintance,
imperative render APIs, or callback/result protocols.

The rows below describe the current passive-View blocker surface directly.

## Enforced

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-view-fxml-controller-shape` | Enforced | only when a passive `View` is FXML-backed | Gradle `checkViewFxmlResources` | `./gradlew checkViewEnforcement` | FXML resources live under the documented `resources/view/**` roots, use `fx:controller` only on the root element, forbid inline scripts and script-style event handlers, and point to the matching passive `View` class in the matching package and resource path. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-view-dependency-boundary` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewInteractionBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | Passive `View` code references only JavaFX/JDK UI types, its own same-stem `*ContentModel`, its own same-stem `*ViewInputEvent` type, and same-surface local technical support. Direct acquaintance with `ContributionModel`, foreign `ContentModel`s, foreign `View`s, unknown same-package helper files, local `*PublishedEvent` families, domain/data types, shell, bootstrap, and backend seams is blocked. |
| `view-view-type-shape-boundary` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewSurfaceBoundary` | `./gradlew checkViewEnforcement` | A passive `View` is a concrete UI surface, not a project-View subclass, project-interface adapter, static utility bucket, or constructor-injected callback/model relay. |
| `view-view-no-local-semantic-state` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewStateBoundary` | `./gradlew checkViewEnforcement` | Passive `View` code does not hide mutable semantic state bags or extra project-acquaintance fields inside the `View`; reusable primitive Views are held to the same dumb-view rule as every other passive `View`. |
| `view-view-no-project-member-calls` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewInteractionBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A passive `View` does not invoke methods on or read members from project classes except its own same-stem `ContentModel` during `bind(...)`-owned rendering setup. The only other legal project-type interaction is construction of its own same-stem `*ViewInputEvent` snapshot. |
| `view-view-no-projection-carrier-construction` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewInteractionBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A passive `View` does not construct `ContentModel`, `ContributionModel`, projection-model support carriers, same-root `*PublishedEvent` carriers, or domain/data/application-service carriers. The only authored passive-View carrier construction that remains legal is its own same-stem `*ViewInputEvent` snapshot; prepared render or hit carriers belong in its same-stem `ContentModel` or upstream read-side projection instead. |
| `view-view-presentation-decision-leak` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewStateBoundary` | `./gradlew checkViewEnforcement` | Passive `View` code does not branch on same-root model-derived state while directly mutating shared widget presentation such as visibility, managed state, enablement, or shared labels. |
| `view-view-no-local-data-shaping` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewStateBoundary` | `./gradlew checkViewEnforcement` | Passive `View` code does not locally rebuild presentation facts through stream/collector/comparator sorting pipelines, JavaFX observable collection synthesis, or similar data-shaping APIs that belong in the owning model or readback path. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-view-input-api` | Enforced | every passive `View` that participates in the same-stem `*ViewInputEvent` protocol | Error Prone `PassiveViewSurfaceBoundary` | `./gradlew checkViewEnforcement` | An interactive passive `View` exposes exactly one outward input seam, `onViewInputEvent(Consumer<SameStemViewInputEvent>)`, does not misshape that seam, and does not subscribe to another top-level passive `View`'s `onViewInputEvent(...)` route. |
| `view-view-contentmodel-bind-shape` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewSurfaceBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A passive `View` exposes its prepared-state inbound surface as exactly one `bind(SameStemContentModel)` route. Direct `ContributionModel` APIs, foreign `ContentModel` APIs, project-typed sink payloads, constructor-injected callbacks, and imperative render methods are not part of the legal inbound surface. |
| `view-view-callback-seam-boundary` | Enforced | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewSurfaceBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | Passive `View`s expose no alternate outward callback or result seams beside the single `onViewInputEvent(...)` route, and no imperative public render API beside `bind(SameStemContentModel)`; reusable primitive Views are held to the same boundary as every other passive `View`. |

## Review-Owned

- whether a mechanically legal passive `View` is still too broad and should be
  split into clearer surfaces
- `view-view-name-shape`
  passive `View` files still follow the documented area-specific naming shape:
  `leftbartabs` use `*ControlsView`, `*MainView`, or `*StateView`;
  `dropdowns` use `*TopBarView`; `statetabs` use `*StateView`; reusable
  `slotcontent/**` including `slotcontent/primitives/**` use `*View`.
- `view-view-one-top-level-fragment`
  each passive `View` file still defines exactly one top-level passive `View`
  type rather than several peer fragments in one source file.
- `view-view-same-stem-contentmodel-shape`
  every passive `View` belongs to a co-located same-stem `ContentModel` pair;
  interactive Views also own exactly one same-stem `*ViewInputEvent`.
- `view-view-no-handler-business-meaning-expansion`
  a reusable passive `View` without a local `IntentHandler` still stays
  passive; it must not infer business meaning inside otherwise legal local
  presentation code while waiting for same-root interpretation.
- `view-view-no-contentmodel-projection-expansion`
  a passive `View` must not absorb projection or interpretation logic that
  belongs in its own same-stem `ContentModel`.
- `view-view-commandless-reactivity`
  passive `View`s react only through their own same-stem `ContentModel`; they
  do not receive presenter-style imperative commands as an alternate
  presentation protocol.
- `view-view-contentmodel-bind-semantic-adequacy`
  mechanically legal `bind(SameStemContentModel)` methods still represent a
  narrow render-only inbound surface instead of drifting into a second protocol
  for orchestration, request/acknowledgement, or partial semantic
  reconstruction.
- `view-view-local-viewinputevent-snapshot-authorship-residual`
  neighboring `ViewInputEvent` enforcement now blocks same-view helper
  reconstruction, forbidden model/domain dependencies, and same-view sentinel
  constants when a passive `View` constructs its same-stem top-level
  `*ViewInputEvent`; the remaining judgment about whether a mechanically legal
  snapshot still over-encodes or under-encodes local intent remains
  review-owned.
- `view-view-presentation-branching-locality`
  `PassiveViewStateBoundary` blocks the narrow proxy case where a passive
  `View` branches on same-root model-derived state while mutating shared widget
  presentation, but the broader semantic judgment about which rendering
  decisions should remain presentation-local still remains review-owned.

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)

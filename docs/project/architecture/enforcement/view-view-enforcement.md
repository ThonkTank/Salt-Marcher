Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-05
Source of Truth: Complete invariant catalog for passive `*View` surfaces in
`src/view/**`, limited to constraints proven directly on `*View.java` files,
passive-`View`-owned FXML resources, or review-owned passive-`View`
semantics.

# View Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
passive `*View` role itself.

It answers four questions for every passive `*View` surface:

- what the file MUST contain
- what the file MUST NOT contain
- with which direct seams the file MAY communicate
- which remaining passive-`View` semantics are still review-owned

This document does not own `*ViewInputEvent` carrier existence or shape,
Binder-installed wiring, `IntentHandler` entrypoint shape, or `*PublishedEvent`
routing. Those stay in the neighboring role documents.
It does own the passive-View-side claim that the outward input seam emits the
same-stem carrier built by the `View` itself rather than by a foreign role.

The target reusable-slotcontent architecture is uniform across
`slotcontent/**`, including `slotcontent/primitives/**`: every reusable unit is
`View + ViewInputEvent + ContentModel`. Some currently blocking passive-View
gates still encode the older technical-primitive exception; those rows below
describe current mechanical behavior, not target truth.

## Enforced

### Must Contain

| Invariant ID | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- |
| `view-view-name-shape` | every passive `*View.java` under `src/view/**` | jQAssistant `saltmarcher:PassiveViewName` | `./gradlew checkViewEnforcement` | Passive `View` files use the documented area-specific naming shape: `leftbartabs` use `*ControlsView`, `*MainView`, or `*StateView`; `dropdowns` use `*TopBarView`; `statetabs` use `*StateView`; reusable `slotcontent/**` including `slotcontent/primitives/**` use `*View`. |
| `view-view-one-top-level-fragment` | every passive `*View.java` under `src/view/**` | jQAssistant `saltmarcher:PassiveViewOneTopLevelTypePerFile` | `./gradlew checkViewEnforcement` | Each passive `View` file defines exactly one top-level passive `View` type rather than several peer fragments in one source file. |
| `view-view-fxml-controller-shape` | only when a passive `View` is FXML-backed | Gradle `checkViewFxmlResources` | `./gradlew checkViewEnforcement` | FXML resources live under the documented `resources/view/**` roots, use `fx:controller` only on the root element, forbid inline scripts and script-style event handlers, and point to the matching passive `View` class in the matching package and resource path. |

### Must Not Contain

| Invariant ID | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- |
| `view-view-dependency-boundary` | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewDependencyBoundaries`, ArchUnit `passiveViewsMustNotReachShellDomainDataOrBootstrap`, and jQAssistant `saltmarcher:PassiveViewAllowedDependencies` | `./gradlew checkViewEnforcement` | A passive `View` references only JavaFX UI APIs, its co-located observable `ContributionModel` or `ContentModel`, same-root or reused same-unit `*ViewInputEvent` types, and the documented passive reusable view seam. The current implementation still accepts same-surface support-value references because of the legacy primitive-support model; those support-carrier references are no longer target architecture. |
| `view-view-no-local-semantic-state` | every passive `*View.java` outside `src/view/slotcontent/primitives/**` | Error Prone `PassiveViewLocalStateBoundary` | `./gradlew checkViewEnforcement` | The current local-state gate blocks mutable semantic state bags for non-primitive passive `View`s. The target architecture requires the same dumb-view rule for reusable primitive Views too; the primitive exception is current mechanical drift. |
| `view-view-technical-primitive-boundary` | every passive `*View.java` under `src/view/slotcontent/primitives/**` | Error Prone `TechnicalPrimitiveViewBoundary` | `./gradlew checkViewEnforcement` | The current primitive-only boundary is a legacy blocker from the superseded technical-primitive architecture. It proves only that primitive Views stay technical under the old model; it does not prove the target reusable-slotcontent `View + ViewInputEvent + ContentModel` contract. |
| `view-view-model-read-api` | every passive `*View.java` that invokes methods on a co-located model | Error Prone `PassiveViewModelReadApis` | `./gradlew checkViewEnforcement` | Passive `View` code reads its co-located `ContributionModel` or `ContentModel` only through JavaFX observable or binding surfaces instead of imperative non-observable read APIs. |
| `view-view-no-model-mutation` | every passive `*View.java` that reaches its co-located model through JavaFX writable surfaces | Error Prone `PassiveViewModelMutationBoundary` | `./gradlew checkViewEnforcement` | Passive `View` code does not mutate its co-located `ContributionModel` or `ContentModel` through writable properties, writable values, or observable collections, maps, or sets returned by model accessors. |
| `view-view-no-projection-carrier-construction` | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewProjectionConstructionBoundary` | `./gradlew checkViewEnforcement` | A passive `View` does not construct same-root projection-model support carriers, same-root `*PublishedEvent` carriers, or domain/data/application-service carriers. The only authored passive-View carrier construction that remains legal is its own same-stem `*ViewInputEvent` snapshot; prepared render or hit carriers belong in models or upstream read-side projection instead. |
| `view-view-presentation-decision-leak` | every passive `*View.java` under `src/view/**` | Error Prone `ViewPresentationDecisionLeak` | `./gradlew checkViewEnforcement` | Passive `View` code does not branch on same-root model-derived state while directly mutating shared widget presentation such as visibility, managed state, enablement, or shared labels. |

### Communication Contract

| Invariant ID | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- |
| `view-view-input-api` | every passive `View` that participates in the same-stem `*ViewInputEvent` protocol | Error Prone `ViewInputEventApi` | `./gradlew checkViewEnforcement` | An interactive passive `View` exposes exactly one outward input seam, `onViewInputEvent(Consumer<SameStemViewInputEvent>)`, does not misshape that seam, and does not subscribe to another top-level passive `View`'s `onViewInputEvent(...)` route. |
| `view-view-callback-seam-boundary` | every passive `*View.java` outside `src/view/slotcontent/primitives/**` | Error Prone `PassiveViewCallbackSeamBoundary` and ArchUnit `passiveViewsWithoutLocalIntentHandlersOrViewInputEventsMustNotExposeCallbackSeams` | `./gradlew checkViewEnforcement` | The current callback gate cleanly enforces the single `onViewInputEvent(...)` route for non-primitive passive `View`s. The target architecture requires that same rule for reusable primitive Views too; their current technical-protocol exception is legacy drift. |

## Review-Owned

- whether a mechanically legal passive `View` is still too broad and should be
  split into clearer surfaces
- `view-view-reusable-slotcontent-three-role-shape`
  every reusable `slotcontent/**` passive `View` belongs to a unit that also
  owns exactly one same-stem `*ViewInputEvent` and exactly one same-unit
  `*ContentModel`; any additional top-level support-carrier or helper role is
  target-state migration debt until the gates catch up.
- `view-view-no-handler-business-meaning-expansion`
  a reusable passive `View` without a local `IntentHandler` still stays
  passive; it must not infer business meaning inside otherwise legal local
  presentation code while waiting for same-root interpretation.
- `view-view-no-contentmodel-reusable-projection-expansion`
  a reusable passive `View` must not absorb projection or interpretation logic
  that belongs in its own `ContentModel`, even when current gates still permit
  legacy primitive-support-carrier arrangements.
- `view-view-commandless-reactivity`
  passive `View`s react to model changes through bindings or listeners; they do
  not receive presenter-style imperative commands as an alternate presentation
  protocol.
- `view-view-local-viewinputevent-snapshot-authorship-residual`
  neighboring `ViewInputEvent` enforcement now blocks same-view helper
  reconstruction, forbidden model/domain dependencies, and same-view sentinel
  constants when a passive `View` constructs its same-stem top-level
  `*ViewInputEvent`; the remaining judgment about whether a mechanically legal
  snapshot still over-encodes or under-encodes local intent remains
  review-owned.
- `view-view-presentation-branching-locality`
  `ViewPresentationDecisionLeak` blocks the narrow proxy case where a passive
  `View` branches on same-root model-derived state while mutating shared widget
  presentation, but the broader semantic judgment about which rendering
  decisions should remain presentation-local still remains review-owned.

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)

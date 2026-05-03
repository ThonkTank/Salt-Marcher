Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
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
| `view-view-dependency-boundary` | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewDependencyBoundaries`, ArchUnit `passiveViewsMustNotReachShellDomainDataOrBootstrap`, and jQAssistant `saltmarcher:PassiveViewAllowedDependencies` | `./gradlew checkViewEnforcement` | A passive `View` references only JavaFX UI APIs, its co-located observable `ContributionModel` or `ContentModel`, same-root `*ViewInputEvent` types, same-surface support values, and the documented passive reusable view seam. It does not reference `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, `*PublishedEvent`, foreign roots, or foreign non-`View` role families. |
| `view-view-model-read-api` | every passive `*View.java` that invokes methods on a co-located model | Error Prone `PassiveViewModelReadApis` | `./gradlew checkViewEnforcement` | Passive `View` code reads its co-located `ContributionModel` or `ContentModel` only through JavaFX observable or binding surfaces instead of imperative non-observable read APIs. |
| `view-view-no-model-mutation` | every passive `*View.java` that reaches its co-located model through JavaFX writable surfaces | Error Prone `PassiveViewModelMutationBoundary` | `./gradlew checkViewEnforcement` | Passive `View` code does not mutate its co-located `ContributionModel` or `ContentModel` through writable properties, writable values, or observable collections, maps, or sets returned by model accessors. |
| `view-view-presentation-decision-leak` | every passive `*View.java` under `src/view/**` | Error Prone `ViewPresentationDecisionLeak` | `./gradlew checkViewEnforcement` | Passive `View` code does not branch on same-root model-derived state while directly mutating shared widget presentation such as visibility, managed state, enablement, or shared labels. |

### Communication Contract

| Invariant ID | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- |
| `view-view-input-api` | every passive `View` that participates in the same-stem `*ViewInputEvent` protocol | Error Prone `ViewInputEventApi` | `./gradlew checkViewEnforcement` | An interactive passive `View` exposes exactly one outward input seam, `onViewInputEvent(Consumer<SameStemViewInputEvent>)`, does not misshape that seam, and does not subscribe to another top-level passive `View`'s `onViewInputEvent(...)` route. |
| `view-view-callback-seam-boundary` | every passive `*View.java` outside the explicit low-level primitive allowlist | Error Prone `PassiveViewCallbackSeamBoundary` and ArchUnit `passiveViewsWithoutLocalIntentHandlersOrViewInputEventsMustNotExposeCallbackSeams` | `./gradlew checkViewEnforcement` | Outside the explicit low-level primitive allowlist, a passive `View` does not expose alternate callback, async-result, acknowledgement, or other result-bearing outward seams. Feature views and reusable `slotcontent.controls/**` views therefore must not keep legacy callback-setter APIs. If the `View` exposes an outward technical input seam at all, that seam is the documented `onViewInputEvent(Consumer<SameStemViewInputEvent>)` route. |

## Review-Owned

- whether a mechanically legal passive `View` is still too broad and should be
  split into clearer surfaces
- `view-view-no-handler-business-meaning-expansion`
  a passive `View` without a local `IntentHandler` still stays passive; it must
  not infer business meaning inside otherwise legal local presentation code.
- `view-view-no-contentmodel-reusable-projection-expansion`
  a reusable passive `View` without a local `ContentModel` stays passive and
  stateless rather than becoming a hidden place for reusable projection or
  interpretation logic.
- `view-view-commandless-reactivity`
  passive `View`s react to model changes through bindings or listeners; they do
  not receive presenter-style imperative commands as an alternate presentation
  protocol.
- `view-view-local-viewinputevent-snapshot-authorship`
  a mechanically legal passive `View` still authors its own same-stem
  `*ViewInputEvent` snapshot from current widget/raw-event state rather than
  delegating carrier construction to Binder, `IntentHandler`, or helper
  protocols, and does not fill the carrier with semantic fallback values that
  hide missing current UI state.
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

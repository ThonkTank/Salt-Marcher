Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Complete invariant catalog for cross-role topology, allowed
role families, reusable-unit boundaries, and the view-layer-local
communication model in `src/view/**`.

# View Layer Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the view
layer as one layer rather than for one specific role.

It answers three questions for `src/view/**`:

- what the layer MUST contain
- what the layer MUST NOT contain
- which direct communication seams MAY and MUST NOT exist inside the layer
  itself and at its documented backend boundary

Role-local API, payload-shape, and dependency-detail rules stay in the
neighboring `*Contribution`, `*Binder`, `*View`, `*IntentHandler`,
`*ContributionModel`, `*ContentModel`, `*ViewInputEvent`, `*PublishedEvent`,
and `*InspectorEntry` enforcement documents. Repository-wide cross-layer
topology and non-view-specific boundary rules stay in
`layering-architecture-enforcement.md`. This file catalogs only the invariants
that belong to the view layer as a layer and names where proof currently
lives.

Focused bundle entrypoint:

- `./gradlew checkViewLayerEnforcement --console=plain` runs the currently
  active view-layer topology checks. `checkArchitecture`, `check`, and
  `build` include the same layer-focused proof surface transitively, and some
  layer invariants below are enforced elsewhere by the neighboring role
  bundles.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-active-root-file-role-allowlist` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | An active view root contains only the documented view-layer role families: `*Contribution.java`, `*Binder.java`, `*ContributionModel.java`, optional `*IntentHandler.java`, one or more passive `*View.java` files, optional same-root `*ViewInputEvent.java` carriers, and optional same-root write-side `*PublishedEvent.java` carriers. |
| `view-layer-active-root-contribution-count` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each active root defines exactly one `*Contribution.java`. |
| `view-layer-active-root-binder-count` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each active root defines exactly one `*Binder.java`. |
| `view-layer-active-root-contributionmodel-count` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each active root defines exactly one aggregate `*ContributionModel.java`. |
| `view-layer-active-root-view-required` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each active root defines at least one passive `*View.java` surface. |
| `view-layer-active-root-intenthandler-max-one` | Enforced Elsewhere | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewIntentHandlerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkViewIntentHandlerEnforcement` | Each active root may define at most one local `*IntentHandler.java`. |
| `view-layer-interactive-active-root-views-own-local-same-stem-viewinputevent-and-intenthandler` | Enforced Elsewhere | every interactive same-root passive `*View` surface inside an active root | build-harness `ViewInputEventTopologyRules`; ArchUnit `interactiveViewsMustOwnSameStemViewInputEventsAndIntentHandlers`; ArchUnit `viewInputEventsMustBelongToInteractiveSameStemViews` | `./gradlew checkViewInputEventEnforcement` | Each interactive passive same-root `*View` owns exactly one same-stem local `*ViewInputEvent.java`, and that interactive local unit also owns a local `*IntentHandler`. |
| `view-layer-active-root-publishedevent-requires-local-intenthandler-and-write-seam-need` | Enforced Elsewhere | every active root that defines one or more same-root `*PublishedEvent.java` carriers | ArchUnit `publishedEventsMustBelongToLocalIntentHandlers`; ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew checkArchitecture` and `./gradlew checkViewPublishedEventEnforcement` | A same-root write-side `*PublishedEvent` may exist only in a local unit that also owns a matching local `*IntentHandler`; whether that write seam is genuinely needed remains explicitly review-owned. |
| `view-layer-slotcontent-file-role-allowlist` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | A reusable `slotcontent/**` unit contains only the documented reusable role families: passive `*View.java`, optional `*ContentModel.java`, optional `*IntentHandler.java`, optional same-unit `*ViewInputEvent.java`, optional same-unit `*PublishedEvent.java`, optional same-unit `*InspectorEntry.java`, and the allowed shared mapcanvas support carriers. |
| `view-layer-slotcontent-contentmodel-max-one` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each reusable `slotcontent/**` unit defines at most one local `*ContentModel.java`. |
| `view-layer-slotcontent-intenthandler-max-one` | Enforced Elsewhere | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewIntentHandlerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkViewIntentHandlerEnforcement` | Each reusable `slotcontent/**` unit may define at most one local `*IntentHandler.java`. |
| `view-layer-interactive-slotcontent-unit-owns-contentmodel-intenthandler-and-same-stem-viewinputevent` | Enforced Elsewhere | every interactive reusable `slotcontent/**` unit | build-harness `ViewLayerTopologyRules`; ArchUnit `interactiveSlotcontentViewsMustOwnExactlyOneContentModel`; build-harness `ViewInputEventTopologyRules`; ArchUnit `interactiveViewsMustOwnSameStemViewInputEventsAndIntentHandlers`; ArchUnit `viewInputEventsMustBelongToInteractiveSameStemViews` | `./gradlew checkViewLayerEnforcement` and `./gradlew checkViewInputEventEnforcement` | An interactive reusable unit owns exactly one `*ContentModel`, a local `*IntentHandler`, and the same-stem local `*ViewInputEvent` carrier set needed for its interactive passive `*View` surfaces. |
| `view-layer-inspectorentry-details-only-role-family` | Enforced Elsewhere | every `*InspectorEntry.java` under `src/view/**` | Error Prone `ViewInspectorEntryDependencyBoundary` | `./gradlew compileJava`, `./gradlew checkViewInspectorEntryEnforcement`, and `./gradlew checkArchitecture` | `*InspectorEntry.java` belongs only to reusable `slotcontent/details/**` units and is not an active-root or non-details reusable role family. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-active-root-no-contentmodel` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Active roots do not define reusable `*ContentModel.java` files. |
| `view-layer-slotcontent-no-contribution` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define `*Contribution.java`. |
| `view-layer-slotcontent-no-binder` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define `*Binder.java`. |
| `view-layer-slotcontent-no-contributionmodel` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define active-root `*ContributionModel.java` files. |
| `view-layer-no-non-role-bearing-standalone-files` | Enforced | every top-level file under an active root or reusable `slotcontent/**` unit inside `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | The view layer does not grow non-role-bearing standalone files; implementation details stay inside explicit role files or nested/private helper types. |
| `view-layer-no-interactive-unit-without-local-handler-and-viewinputevent-family` | Enforced Elsewhere | every interactive local view unit in an active root or reusable `slotcontent/**` unit | build-harness `ViewInputEventTopologyRules`; ArchUnit `interactiveViewsMustOwnSameStemViewInputEventsAndIntentHandlers`; ArchUnit `viewInputEventsMustBelongToInteractiveSameStemViews` | `./gradlew checkViewInputEventEnforcement` | An interactive local unit does not stay half-migrated: it does not expose interactive passive `View` surfaces without the required local `IntentHandler` and same-stem `*ViewInputEvent` family. |
| `view-layer-no-writeside-carrier-without-real-domain-write-seam-need` | Enforced Elsewhere | every local unit that defines a same-root or same-unit `*PublishedEvent` | Error Prone `ViewPublishedEventRequestSemantics`; Error Prone `ViewPublishedEventProducerOwnership` | `./gradlew compileJava`, `./gradlew checkViewPublishedEventEnforcement`, and `./gradlew checkArchitecture` | A `*PublishedEvent` is not introduced for read-only, query/preview/search/load, shell-only, or purely local-interaction flows. Request-style carrier semantics are mechanically rejected, and only the co-located `IntentHandler` may produce/publish the remaining legal write-side carriers. |
| `view-layer-no-direct-applicationservice-result-to-viewstate-readback` | Enforced Elsewhere | every Binder-owned readback path from a root `*ApplicationService` into a local `*ContributionModel`, `*ContentModel`, or passive `*View` | Error Prone `ViewBinderApplicationServiceReadback` | `./gradlew compileJava`, `./gradlew checkViewBinderEnforcement`, and `./gradlew checkArchitecture` | Domain-backed view state does not arrive as direct one-shot `ApplicationService` return values such as `*Result`, `*Snapshot`, `*Payload`, `*CalculationResult`, `*SearchResult`, or `*Preview` that the Binder copies into view-layer state. The readback source stays a same-context read-side `published/*Model` consumed through `current()` and `subscribe(...)` only. |
| `view-layer-no-responsibility-expansion-when-intenthandler-is-absent` | Review-Owned | every non-interactive local unit without a local `*IntentHandler` | none | none | The absence of an `*IntentHandler` does not expand passive `View` responsibilities; the unit stays passive instead of parking interpretation, callback mutation, or write-side publication in the view surface. |
| `view-layer-no-responsibility-expansion-when-contentmodel-is-absent` | Review-Owned | every reusable `slotcontent/**` unit without a local `*ContentModel` | none | none | The absence of a `*ContentModel` does not expand passive `View` or parent-model responsibilities; the reusable unit stays passive and stateless rather than becoming a hidden place for reusable projection logic. |
| `view-layer-slotcontent-reuse-only` | Review-Owned | every reusable `slotcontent/**` unit under `src/view/**` | none | none | `slotcontent/**` is reserved for genuinely reusable generic components and is not used to hide feature-specific one-off units behind a generic path. |
| `view-layer-no-reverse-reuse-dependency-direction` | Review-Owned | every dependency or inheritance edge between feature-specific view roots, reusable `slotcontent/**`, and `slotcontent/primitives/**` | none | none | Reuse direction stays one-way: contribution-specific code may depend on reusable `slotcontent/**`, reusable `slotcontent/**` may depend on `slotcontent/primitives/**`, and the reverse direction does not appear. |
| `view-layer-no-legacy-view-role-buckets` | Review-Owned | every active or reusable unit under `src/view/**` | none | none | Legacy `*ViewModel`, `*PresentationModel`, `*Projector`, component-local `View/`, `assembly/`, `Controller/`, `interactor/`, and old `api/` buckets remain migration debt and do not belong to the target view-layer shape. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-two-presentation-state-mutation-cycles-only` | Review-Owned | every path that can mutate presentation state inside an active root or reusable `slotcontent/**` unit | none | none | View-layer presentation state changes only through the documented local UI-state cycle or the documented domain-write roundtrip. No third local mutation protocol is introduced, especially no direct Binder-side result-to-view-state copy path from `*ApplicationService` responses. |
| `view-layer-viewinputevent-single-outbound-route` | Enforced Elsewhere | every interactive passive `*View` surface inside `src/view/**` | Error Prone `ViewInputEventApi`; Error Prone `PassiveViewCallbackSeamBoundary`; ArchUnit `passiveViewsWithoutLocalIntentHandlersOrViewInputEventsMustNotExposeCallbackSeams`; Error Prone `ViewBinderViewInputEventWiring`; Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava`, `./gradlew checkViewEnforcement`, `./gradlew checkViewBinderEnforcement`, and `./gradlew checkViewIntentHandlerEnforcement` | Outward communication from an interactive passive `View` stays on exactly one route: `onViewInputEvent(Consumer<SameStemViewInputEvent>)`, Binder forwarding of that exact carrier, and local `IntentHandler.consume(...)` as the only local interpretation target. |
| `view-layer-no-direct-view-callback-protocols-beside-viewinputevent` | Enforced Elsewhere | every passive `*View.java` under `src/view/**` outside the documented low-level technical-base allowlist | Error Prone `PassiveViewCallbackSeamBoundary`; Error Prone `ViewInputEventApi`; ArchUnit `passiveViewsWithoutLocalIntentHandlersOrViewInputEventsMustNotExposeCallbackSeams` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | Passive `View` surfaces do not expose alternate callback, async-result, acknowledgement, or presenter-style command seams beside the documented `*ViewInputEvent` route. |
| `view-layer-no-direct-intenthandler-to-applicationservice-communication` | Enforced Elsewhere | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerApplicationSinkBoundary`; ArchUnit `intentHandlersMustStayShellDomainAndDataFree` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewIntentHandlerEnforcement` | An `IntentHandler` does not communicate with root `*ApplicationService` boundaries, domain internals, or data directly. Backend communication stays out of the role. |
| `view-layer-publishedevent-binder-installed-write-seam-only` | Enforced Elsewhere | every domain-write publication path originating inside `src/view/**` | Error Prone `ViewPublishedEventProducerOwnership`; Error Prone `ViewBinderApplicationSinkWiring`; ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew compileJava`, `./gradlew checkArchitecture`, `./gradlew checkViewPublishedEventEnforcement`, and `./gradlew checkViewBinderEnforcement` | Domain-write publication leaves a local unit only as `IntentHandler -> PublishedEvent -> Binder-installed Consumer<PublishedEvent>`; the Binder owns translation of that carrier into a root `*ApplicationService` call that changes authoritative domain state. |
| `view-layer-no-direct-view-to-applicationservice-path` | Enforced Elsewhere | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewDependencyBoundaries`; ArchUnit `passiveViewsMustNotReachShellDomainDataOrBootstrap` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewEnforcement` | Passive `View` surfaces do not communicate directly with root `*ApplicationService` boundaries. |
| `view-layer-no-direct-view-domain-connection-outside-binder-owned-write-and-readback-seams` | Enforced Elsewhere | every direct connection between `src/view/**` and `src/domain/**` | `view-binder-dependency-boundary`; `view-binder-publishedevent-sink-injection-only`; `view-intenthandler-no-direct-backend-communication`; `view-contributionmodel-read-side-only-direct-boundary`; `view-contentmodel-read-side-only-direct-boundary`; `view-viewinputevent-view-origin-and-intenthandler-target-only` | see neighboring owner docs and their listed entrypoints | The view layer reaches the domain layer only through the documented Binder-owned write seam to root `*ApplicationService` boundaries and the Binder-owned readback seam from same-context root-domain `published/*Model` handles into local models. |
| `view-layer-fire-and-forget-full-snapshot-and-single-write-publication-semantics` | Review-Owned | every interactive local unit that uses `*ViewInputEvent` and every Binder-owned write sink that uses `*PublishedEvent` | none | none | The view layer keeps the documented semantics: local interactive input is one fire-and-forget full snapshot, local UI-only state stays local, write-side publication is one event to one root `*ApplicationService` entrypoint call, and no partial-bag, synchronous-acknowledgement, fan-out workflow, or direct response-copy protocol is introduced. |

## Candidate

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-explicit-non-role-bearing-file-diagnostic` | Candidate | every future illegal standalone file under `src/view/**` | none | none | The quality stack could emit a dedicated blocker for non-role-bearing standalone files instead of proving the same drift only through closed role allowlists. |
| `view-layer-slotcontent-genuine-reuse-diagnostic` | Candidate | every future reusable `slotcontent/**` unit under `src/view/**` | none | none | The quality stack could emit a dedicated blocker when a mechanically legal `slotcontent/**` unit is actually feature-specific and not genuinely reusable. |
| `view-layer-reuse-direction-mechanization` | Candidate | every future dependency or inheritance edge between contribution-specific units, reusable `slotcontent/**`, and `slotcontent/primitives/**` | none | none | The architecture stack could block reverse or sideways reuse edges directly instead of keeping the one-way reuse direction review-owned. |
| `view-layer-legacy-role-family-eradication` | Candidate | every future target-state cleanup of legacy `*ViewModel`, `*PresentationModel`, `*Projector`, `assembly/`, `Controller/`, `interactor/`, and old `api/` surfaces | none | none | The architecture stack could mechanically reject remaining legacy view-layer bucket families once the repo is ready to turn current migration debt into a hard blocker. |

## Review-Owned

- whether a mechanically legal split into several passive `*View` files inside
  one local unit is still understandable or should be simplified
- whether a reusable local unit really deserves its own `ContentModel` or
  remains effectively stateless
- whether a mechanically legal local `IntentHandler` still stays a thin
  interpretation role instead of becoming hidden workflow orchestration
- whether a root `*ApplicationService` surface that currently exposes only
  direct `*Result`/`*Snapshot`/`*Payload` responses should grow a read-side
  `published/*Model` handle before the view-layer hardcut can be fully
  mechanized

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View ContributionModel Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-model-enforcement.md:1)
- [View ContentModel Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-content-model-enforcement.md:1)
- [View InspectorEntry Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-inspector-entry-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)

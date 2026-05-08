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

The target reusable-slotcontent architecture is now one closed reusable-unit
shape everywhere under `slotcontent/**`, including `slotcontent/primitives/**`:
exactly one `*View.java`, exactly one same-stem `*ViewInputEvent.java`, and
exactly one `*ContentModel.java`. Input interpretation for those reused units
belongs only to the same-root active `*IntentHandler`. Some currently blocking
gates still encode the older primitive/support-carrier and reusable-local-
`IntentHandler` model. Those legacy gates are listed below as current
mechanical behavior, not as the canonical target shape.

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
| `view-layer-slotcontent-file-role-allowlist` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | The current topology gate still uses a broader legacy allowlist for reusable `slotcontent/**`: it blocks non-role-bearing files and active-root roles there, but it still admits local `*IntentHandler`, `*PublishedEvent`, `*InspectorEntry`, and primitive support-carrier families that are no longer part of the target architecture. |
| `view-layer-slotcontent-contentmodel-max-one` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | The current topology gate proves only that a reusable `slotcontent/**` unit defines at most one local `*ContentModel.java`. The target architecture is stricter and requires exactly one local `*ContentModel` in every reusable unit. |
| `view-layer-slotcontent-three-role-unit-shape` | Candidate | every reusable `slotcontent/**` unit under `src/view/**` | none | none | The target reusable-slotcontent unit defines exactly one passive `*View.java`, exactly one same-stem `*ViewInputEvent.java`, and exactly one `*ContentModel.java`, with no additional top-level roles. |
| `view-layer-slotcontent-no-local-intenthandler-interpretation-role` | Candidate | every reusable `slotcontent/**` unit under `src/view/**` | none | none | A reusable `slotcontent/**` unit does not define a local `*IntentHandler.java`; input interpretation for reused surfaces belongs only to the same-root active `*IntentHandler`. |
| `view-layer-slotcontent-no-reusable-publishedevent-or-inspector-role` | Candidate | every reusable `slotcontent/**` unit under `src/view/**` | none | none | A reusable `slotcontent/**` unit does not define reusable `*PublishedEvent.java` or `*InspectorEntry.java` roles in the target architecture. |
| `view-layer-slotcontent-no-support-carrier-role-family` | Candidate | every reusable `slotcontent/**` unit under `src/view/**`, including `slotcontent/primitives/**` | none | none | Reusable slotcontent units do not introduce top-level `*PointerEvent.java`, `*Scene.java`, `*Signal.java`, or `*Support.java` support-carrier roles; render-ready and input-ready state belongs in `*ContentModel` and same-stem `*ViewInputEvent`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-active-root-no-contentmodel` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Active roots do not define reusable `*ContentModel.java` files. |
| `view-layer-slotcontent-no-contribution` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define `*Contribution.java`. |
| `view-layer-slotcontent-no-binder` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define `*Binder.java`. |
| `view-layer-slotcontent-no-contributionmodel` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define active-root `*ContributionModel.java` files. |
| `view-layer-primitives-single-technical-view-root` | Enforced | every reusable `slotcontent/primitives/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | The current legacy topology gate still treats `slotcontent/primitives/**` as a special technical-base package and therefore proves only that one top-level `*View.java` exists there. That special package rule is not part of the target architecture. |
| `view-layer-primitives-no-non-technical-role-files` | Enforced | every reusable `slotcontent/primitives/**` unit under `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | The current legacy topology gate still rejects `*ContentModel`, `*IntentHandler`, `*ViewInputEvent`, `*PublishedEvent`, and `*InspectorEntry` inside `slotcontent/primitives/**` while admitting support-carrier suffix files there. That primitive-only split is now migration debt, not target truth. |
| `view-layer-no-non-role-bearing-standalone-files` | Enforced | every top-level file under an active root or reusable `slotcontent/**` unit inside `src/view/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | The view layer does not grow non-role-bearing standalone files; implementation details stay inside explicit role files or nested/private helper types. If a passive surface needs more projection or input preparation, that preparation moves into the owning `*ContributionModel`, `*ContentModel`, or upstream readback path instead of becoming a new top-level helper file. |
| `view-layer-no-interactive-unit-without-local-handler-and-viewinputevent-family` | Enforced Elsewhere | every interactive local view unit in an active root or reusable `slotcontent/**` unit | build-harness `ViewInputEventTopologyRules`; ArchUnit `interactiveViewsMustOwnSameStemViewInputEventsAndIntentHandlers`; ArchUnit `viewInputEventsMustBelongToInteractiveSameStemViews` | `./gradlew checkViewInputEventEnforcement` | The current gate family still treats every interactive local unit as owning both a local `IntentHandler` and a same-stem `*ViewInputEvent`. That is correct for active roots, but it is legacy drift for reusable `slotcontent/**`, where the target architecture keeps only `View + ViewInputEvent + ContentModel`. |
| `view-layer-no-writeside-carrier-without-real-domain-write-seam-need` | Enforced Elsewhere | every local unit that defines a same-root or same-unit `*PublishedEvent` | Error Prone `ViewPublishedEventRequestSemantics`; Error Prone `ViewPublishedEventProducerOwnership` | `./gradlew compileJava`, `./gradlew checkViewPublishedEventEnforcement`, and `./gradlew checkArchitecture` | A `*PublishedEvent` is not introduced for read-only, query/preview/search/load, shell-only, or purely local-interaction flows. Request-style carrier semantics are mechanically rejected, and only the co-located `IntentHandler` may produce/publish the remaining legal write-side carriers. |
| `view-layer-no-direct-applicationservice-result-to-viewstate-readback` | Enforced Elsewhere | every Binder-owned readback path from a root `*ApplicationService` into a local `*ContributionModel`, `*ContentModel`, or passive `*View` | Error Prone `ViewBinderApplicationServiceReadback` | `./gradlew compileJava`, `./gradlew checkViewBinderEnforcement`, and `./gradlew checkArchitecture` | Domain-backed view state and domain-owned feedback do not arrive as any `ApplicationService` return value. Binders use root `*ApplicationService` boundaries only for command publication; the readback source stays a direct same-context read-side `published/*Model` runtime service consumed through `current()` and `subscribe(...)` only. |
| `view-layer-no-responsibility-expansion-when-intenthandler-is-absent` | Review-Owned | every reusable `slotcontent/**` unit and every non-interactive active-root unit without a local `*IntentHandler` | none | none | The absence of a reusable local `*IntentHandler` does not expand passive `View` responsibilities; reusable interpretation belongs in the same-root active handler, and non-interactive active-root units stay passive instead of parking interpretation, callback mutation, or write-side publication in the view surface. |
| `view-layer-no-responsibility-expansion-when-contentmodel-is-absent` | Review-Owned | every reusable `slotcontent/**` unit that still lacks a local `*ContentModel` during migration | none | none | The target architecture requires a real reusable `*ContentModel`. Until the gates catch up, a missing `*ContentModel` must still not expand passive `View` or parent-model responsibilities; the right follow-up is a real `*ContentModel`, not helper logic under the View package. |
| `view-layer-slotcontent-reuse-only` | Review-Owned | every reusable `slotcontent/**` unit under `src/view/**` | none | none | `slotcontent/**` is reserved for genuinely reusable generic components and is not used to hide feature-specific one-off units behind a generic path. |
| `view-layer-no-reverse-reuse-dependency-direction` | Review-Owned | every dependency or inheritance edge between feature-specific view roots, reusable `slotcontent/**`, and `slotcontent/primitives/**` | none | none | Reuse direction stays one-way: contribution-specific code may depend on reusable `slotcontent/**`, reusable `slotcontent/**` may depend on `slotcontent/primitives/**`, and the reverse direction does not appear. |
| `view-layer-no-legacy-view-role-buckets` | Review-Owned | every active or reusable unit under `src/view/**` | none | none | Legacy `*ViewModel`, `*PresentationModel`, `*Projector`, component-local `View/`, `assembly/`, `Controller/`, `interactor/`, and old `api/` buckets remain migration debt and do not belong to the target view-layer shape. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-two-presentation-state-mutation-cycles-only` | Review-Owned | every path that can mutate presentation state inside an active root or reusable `slotcontent/**` unit | none | none | View-layer presentation state changes only through the documented local UI-state cycle or the documented domain-write roundtrip. No third local mutation protocol is introduced, especially no direct Binder-side result-to-view-state copy path from `*ApplicationService` responses. |
| `view-layer-viewinputevent-single-outbound-route` | Enforced Elsewhere | every interactive passive `*View` surface inside `src/view/**` | Error Prone `ViewInputEventApi`; Error Prone `PassiveViewCallbackSeamBoundary`; ArchUnit `passiveViewsWithoutLocalIntentHandlersOrViewInputEventsMustNotExposeCallbackSeams`; Error Prone `ViewBinderViewInputEventWiring`; Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava`, `./gradlew checkViewEnforcement`, `./gradlew checkViewBinderEnforcement`, and `./gradlew checkViewIntentHandlerEnforcement` | Outward communication from an interactive passive `View` stays on exactly one route: `onViewInputEvent(Consumer<SameStemViewInputEvent>)`, Binder forwarding of that exact carrier, and local `IntentHandler.consume(...)` as the only local interpretation target. |
| `view-layer-no-direct-view-callback-protocols-beside-viewinputevent` | Enforced Elsewhere | every passive `*View.java` under `src/view/**` outside `slotcontent/primitives/**` | Error Prone `PassiveViewCallbackSeamBoundary`; Error Prone `ViewInputEventApi`; ArchUnit `passiveViewsWithoutLocalIntentHandlersOrViewInputEventsMustNotExposeCallbackSeams` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | The current callback gate cleanly enforces the one-seam `*ViewInputEvent` route for non-primitive passive `View`s. The target architecture requires that same rule for reusable `slotcontent/primitives/**` too; the primitive exception is legacy drift. |
| `view-layer-no-passive-view-owned-semantic-state-or-pre-intenthandler-snapshot-collapse` | Enforced Elsewhere | every passive `*View.java` and same-stem top-level `*ViewInputEvent` construction path inside `src/view/**` | Error Prone `PassiveViewLocalStateBoundary`; Error Prone `PassiveViewProjectionConstructionBoundary`; Error Prone `ViewInputEventRawSnapshotBoundary` | `./gradlew compileJava`, `./gradlew checkViewEnforcement`, and `./gradlew checkViewInputEventEnforcement` | A passive `View` does not open a third local state or interpretation protocol by holding canonical semantic state bags, constructing same-root projection/write carriers, or semantically collapsing raw UI state before the local `IntentHandler` interprets the same-stem `*ViewInputEvent` snapshot. |
| `view-layer-primitives-technical-boundary-only` | Enforced Elsewhere | every passive `*View.java` under `src/view/slotcontent/primitives/**` | Error Prone `TechnicalPrimitiveViewBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | The current compile-time primitive boundary is a legacy blocker from the superseded technical-primitive architecture. It proves only that primitive Views stay technical under the old model; it does not prove the target reusable-slotcontent three-role contract. |
| `view-layer-no-direct-intenthandler-to-applicationservice-communication` | Enforced Elsewhere | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerApplicationSinkBoundary`; ArchUnit `intentHandlersMustStayShellDomainAndDataFree` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewIntentHandlerEnforcement` | An `IntentHandler` does not communicate with root `*ApplicationService` boundaries, domain internals, or data directly. Backend communication stays out of the role. |
| `view-layer-publishedevent-binder-installed-write-seam-only` | Enforced Elsewhere | every domain-write publication path originating inside `src/view/**` | Error Prone `ViewPublishedEventProducerOwnership`; Error Prone `ViewBinderApplicationSinkWiring`; ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew compileJava`, `./gradlew checkArchitecture`, `./gradlew checkViewPublishedEventEnforcement`, and `./gradlew checkViewBinderEnforcement` | Domain-write publication leaves a local unit only as `IntentHandler -> PublishedEvent -> Binder-installed Consumer<PublishedEvent>`; the Binder owns translation of that carrier into a root `*ApplicationService` call that changes authoritative domain state. |
| `view-layer-no-direct-view-to-applicationservice-path` | Enforced Elsewhere | every passive `*View.java` under `src/view/**` | Error Prone `PassiveViewDependencyBoundaries`; ArchUnit `passiveViewsMustNotReachShellDomainDataOrBootstrap` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewEnforcement` | Passive `View` surfaces do not communicate directly with root `*ApplicationService` boundaries. |
| `view-layer-no-direct-view-domain-connection-outside-binder-owned-write-and-readback-seams` | Enforced Elsewhere | every direct connection between `src/view/**` and `src/domain/**` | `view-binder-dependency-boundary`; `view-binder-publishedevent-sink-injection-only`; `view-intenthandler-no-direct-backend-communication`; `view-contributionmodel-read-side-only-direct-boundary`; `view-contentmodel-read-side-only-direct-boundary`; `view-viewinputevent-view-origin-and-intenthandler-target-only` | see neighboring owner docs and their listed entrypoints | The view layer reaches the domain layer only through the documented Binder-owned write seam to root `*ApplicationService` boundaries and the Binder-owned readback seam from same-context root-domain `published/*Model` handles into local models. |
| `view-layer-fire-and-forget-full-snapshot-and-single-write-publication-semantics` | Review-Owned | every interactive local unit that uses `*ViewInputEvent` and every Binder-owned write sink that uses `*PublishedEvent` | none | none | The view layer keeps the documented semantics: local interactive input is one fire-and-forget full snapshot, local UI-only state stays local, write-side publication is one event to one root `*ApplicationService` entrypoint call, and no partial-bag, synchronous-acknowledgement, fan-out workflow, or direct response-copy protocol is introduced. |

## Candidate

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-layer-shared-primitive-refactor-direction-candidate` | Candidate | shared technical primitives under `src/view/slotcontent/primitives/**` that keep several phase-specific outward seams or broad local scene/hit preparation | report-only PMD `ViewRefactorCandidateRule` | `./gradlew checkViewRefactorCandidates`; transitively through `./gradlew checkViewArchitecture`, `view-topology`, and staged `production-handoff` | This is a legacy diagnostic surface from the superseded technical-primitive architecture. It still reports old-mapcanvas-style primitive sprawl, but it is no longer the canonical reusable-slotcontent refactor direction and should be replaced or removed in the gate migration wave. |
| `view-layer-explicit-non-role-bearing-file-diagnostic` | Candidate | every future illegal standalone file under `src/view/**` | none | none | The quality stack could emit a dedicated blocker for non-role-bearing standalone files instead of proving the same drift only through closed role allowlists. |
| `view-layer-slotcontent-genuine-reuse-diagnostic` | Candidate | every future reusable `slotcontent/**` unit under `src/view/**` | none | none | The quality stack could emit a dedicated blocker when a mechanically legal `slotcontent/**` unit is actually feature-specific and not genuinely reusable. |
| `view-layer-reuse-direction-mechanization` | Candidate | every future dependency or inheritance edge between contribution-specific units, reusable `slotcontent/**`, and `slotcontent/primitives/**` | none | none | The architecture stack could block reverse or sideways reuse edges directly instead of keeping the one-way reuse direction review-owned. |
| `view-layer-legacy-role-family-eradication` | Candidate | every future target-state cleanup of legacy `*ViewModel`, `*PresentationModel`, `*Projector`, `assembly/`, `Controller/`, `interactor/`, and old `api/` surfaces | none | none | The architecture stack could mechanically reject remaining legacy view-layer bucket families once the repo is ready to turn current migration debt into a hard blocker. |

## Review-Owned

- whether a mechanically legal split into several passive `*View` files inside
  one local unit is still understandable or should be simplified
- whether a reusable local unit's `ContentModel` still stays component-local
  instead of becoming a second aggregate god-model
- whether current mechanically legal reusable `*IntentHandler`,
  `*PublishedEvent`, `*InspectorEntry`, or primitive support-carrier files
  have been fully migrated away from the target architecture yet
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

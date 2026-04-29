Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Mechanically enforced and review-owned invariants for
`*ViewInputEvent` carriers in `src/view/**`.

# ViewInputEvent Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*ViewInputEvent` role itself and for the event-specific cross-role
communication contract whose subject is that carrier.

It answers four questions for every `*ViewInputEvent` surface:

- when the carrier MAY and MUST exist
- what the carrier MAY contain
- what the carrier MUST NOT contain
- which local communication boundary the carrier itself is allowed to cross

This document does not own general `View`, `Binder`, or `IntentHandler`
dependency rules, naming rules, or non-`*ViewInputEvent` mutation semantics.
Those stay in the neighboring role documents.

## Invariant Catalog

### Must Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-local-intenthandler-required` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | build-harness `ViewInputEventTopologyRules`, ArchUnit `viewInputEventsMustBelongToInteractiveSameStemViews`, and ArchUnit `interactiveViewsMustOwnSameStemViewInputEventsAndIntentHandlers` | `./gradlew checkArchitecture` | A `*ViewInputEvent` may exist only inside a local interactive view unit that also defines a passive same-stem `*View` surface and a local `*IntentHandler`. |
| `view-viewinputevent-same-stem-local-belonging` | Enforced | every passive `*View.java` that participates in the `*ViewInputEvent` role and every `*ViewInputEvent.java` under `src/view/**` | ArchUnit `interactiveViewsMustOwnSameStemViewInputEventsAndIntentHandlers` and ArchUnit `viewInputEventsMustBelongToInteractiveSameStemViews` | `./gradlew checkArchitecture` | Each interactive passive `View` surface owns exactly one same-stem co-located `*ViewInputEvent.java`, and each carrier belongs only to its own same-stem local interactive `View` surface. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-top-level-record-shape` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | `*ViewInputEvent` carriers are top-level immutable `record` types rather than mutable classes or helper-shaped containers. |
| `view-viewinputevent-technical-payload-allowlist` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | `*ViewInputEvent` payloads stay within JDK value/container types, the allowed JavaFX technical input/value families (`javafx.event.*`, `javafx.geometry.*`, `javafx.scene.input.*`), and the carrier's own top-level or nested type boundary. |
| `view-viewinputevent-full-snapshot-semantic-adequacy` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | A mechanically legal carrier still represents the one full technical snapshot its local `IntentHandler` needs, rather than a partial bag that silently relies on hidden reads or follow-up callbacks. |
| `view-viewinputevent-technically-necessary-facts-only` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | The carrier contains only the technical facts needed for local intent interpretation, rather than speculative or convenience payload. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-no-foreign-view-role-references` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | A `*ViewInputEvent` does not reference foreign `src/view/**` role families such as `*View`, `*Binder`, `*ContributionModel`, `*ContentModel`, `*IntentHandler`, `*PublishedEvent`, legacy view-role buckets, or support files outside the carrier's own type boundary. |
| `view-viewinputevent-no-outer-layer-dependencies` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` and ArchUnit `viewInputEventsMustStayShellDomainDataAndServiceFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | A `*ViewInputEvent` does not depend on `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, or root `*ApplicationService` boundaries. |
| `view-viewinputevent-no-dead-snapshot-components` | Enforced | every record-shaped `*ViewInputEvent.java` with a co-located `IntentHandler.consume(...)` overload | ArchUnit `viewInputEventsMustNotDeclareDeadSnapshotComponents` | `./gradlew checkArchitecture` | Every top-level `*ViewInputEvent` record component is read somewhere by the co-located `IntentHandler.consume(...)` entrypoint instead of remaining dead carrier baggage. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-view-origin-and-intenthandler-target-only` | Enforced Elsewhere | every interactive same-stem `ViewInputEvent` seam inside `src/view/**` | Error Prone `ViewInputEventApi`, Error Prone `ViewBinderViewInputEventWiring`, and Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava`, `./gradlew checkViewEnforcement`, `./gradlew checkViewBinderEnforcement`, and `./gradlew checkViewIntentHandlerEnforcement` | A `*ViewInputEvent` leaves its own same-stem passive `View` only through `onViewInputEvent(Consumer<SameStemViewInputEvent>)`, the owning `Binder` forwards that exact carrier, and the only local target is the co-located `IntentHandler.consume(...)` entrypoint. |
| `view-viewinputevent-no-alternate-outbound-route` | Enforced Elsewhere | every passive `*View.java` that participates in the `*ViewInputEvent` protocol | Error Prone `PassiveViewCallbackSeamBoundary`, Error Prone `ViewInputEventApi`, and ArchUnit `passiveViewsWithoutLocalIntentHandlersOrViewInputEventsMustNotExposeCallbackSeams` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewEnforcement` | The `*ViewInputEvent` protocol does not branch into alternate callback, async-result, or acknowledgement seams; outward communication stays on the one documented input-event route. |
| `view-viewinputevent-fire-and-forget-full-snapshot-semantics` | Review-Owned | every interactive same-stem `ViewInputEvent` seam inside `src/view/**` | none | none | The legal route above is still used as one fire-and-forget full snapshot, not as presenter-style commands, ad-hoc partial event bags, or a protocol that expects synchronous technical acknowledgements. |

## Candidate

- classifying same-surface helper ownership more explicitly than the current
  own-type-boundary proof, if future legal helper shapes become necessary

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)

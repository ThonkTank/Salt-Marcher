Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Complete invariant catalog for the `*PublishedEvent` role
itself in `src/view/**`.

# PublishedEvent Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*PublishedEvent` role itself and for the event-specific cross-role write
contract whose subject is that carrier.

It answers four questions for every `*PublishedEvent` surface:

- when the carrier MAY exist
- what the carrier MUST contain
- what the carrier MUST NOT contain
- which direct communication boundary the carrier itself MAY cross

This document does not own general `View`, `Binder`, or `IntentHandler`
dependency rules, file-role topology, or non-`*PublishedEvent` mutation
semantics. Those stay in the neighboring role-enforcement documents and in the
view-layer and layering standards.

Unified focused bundle entrypoint:

- `./gradlew checkViewPublishedEventEnforcement --rerun-tasks --console=plain`
  runs the currently active PublishedEvent-focused Error Prone and ArchUnit
  checks through one root task. Canonical blocking behavior remains at
  `./gradlew compileJava` and `./gradlew checkArchitecture` as listed below.

## Invariant Catalog

### May Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-publishedevent-local-intenthandler-required` | Enforced | every `*PublishedEvent.java` under `src/view/**` | ArchUnit `publishedEventsMustBelongToLocalIntentHandlers` and `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew checkArchitecture` | A `*PublishedEvent` may exist only in a local unit that also owns exactly one matching local `*IntentHandler` with `onPublishedEventRequested(Consumer<SamePublishedEvent>)`. |
| `view-publishedevent-domain-write-seam-necessity` | Review-Owned | every local unit that defines a `*PublishedEvent` | none | none | A `*PublishedEvent` exists only when domain work really has to cross the `Binder -> *ApplicationService` seam. Read-only or purely local-interaction units do not define a write-side carrier. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-publishedevent-top-level-record-shape` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventBoundary` | `./gradlew compileJava` | `*PublishedEvent` carriers are top-level immutable `record` types rather than mutable classes or helper-shaped containers. |
| `view-publishedevent-same-surface-local-support-only` | Review-Owned | every `*PublishedEvent.java` under `src/view/**` | none | none | `*PublishedEvent` payload support stays local to the carrier surface itself: JDK value/container types plus same-surface local support only. The current gates prove the outer-layer and foreign-non-`PublishedEvent` bans below, but they do not yet fully prove the absence of foreign `*PublishedEvent` support types. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-publishedevent-no-outer-layer-dependencies` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventBoundary` and ArchUnit `publishedEventsMustStayShellDomainDataAndServiceFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | A `*PublishedEvent` does not depend on `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, `javafx/**`, or root `*ApplicationService` boundaries. |
| `view-publishedevent-no-foreign-non-publishedevent-view-roles` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventBoundary` | `./gradlew compileJava` | A `*PublishedEvent` does not depend on foreign non-`PublishedEvent` view-role families such as `*Contribution`, `*Binder`, `*ContributionModel`, `*ContentModel`, `*IntentHandler`, `*View`, `*ViewInputEvent`, or `*InspectorEntry`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-publishedevent-intenthandler-only-production-and-publication` | Enforced | every same-root top-level `*PublishedEvent` production or publication inside `src/view/**` | Error Prone `ViewPublishedEventProducerOwnership` | `./gradlew compileJava` | Outside the `*PublishedEvent` file's own constructor or static-factory implementation details, only the co-located `IntentHandler` may construct and publish top-level same-root `*PublishedEvent` carriers. |
| `view-publishedevent-binder-installed-same-root-consumer-sink-only` | Enforced Elsewhere | every domain-write publication seam for a same-root `*PublishedEvent` | Error Prone `ViewPublishedEventProducerOwnership` and Error Prone `ViewBinderApplicationSinkWiring` | `./gradlew compileJava`, `./gradlew checkViewPublishedEventEnforcement`, and `./gradlew checkViewBinderEnforcement` | A `*PublishedEvent` leaves its local `IntentHandler` only through a same-root `Consumer<*PublishedEvent>` sink seam that the local `Binder` installs. |
| `view-publishedevent-never-emitted-directly-by-view` | Enforced Elsewhere | every passive `*View` in a unit that defines a local `*PublishedEvent` | Error Prone `PassiveViewDependencyBoundaries`, ArchUnit `passiveViewsMustNotReachShellDomainDataOrBootstrap`, and jQAssistant `saltmarcher:PassiveViewAllowedDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewEnforcement` | Passive `View` surfaces stay `*PublishedEvent`-free and therefore never construct, hold, emit, or publish write-side carriers directly. |
| `view-publishedevent-single-root-applicationservice-call-per-publication` | Review-Owned | every Binder-owned sink that translates one published event into domain work | none | none | One publication of one `*PublishedEvent` becomes one root `*ApplicationService` entrypoint call rather than a hidden fan-out workflow. |
| `view-publishedevent-one-carrier-family-per-root-entrypoint` | Review-Owned | every same-root Binder/ApplicationService write seam fed by `*PublishedEvent` carriers | none | none | One root `*ApplicationService` entrypoint is fed by at most one same-root `*PublishedEvent` type. Needing several write-side carriers for one entrypoint is a modelling error. |

## Candidate

- mechanizing `view-publishedevent-same-surface-local-support-only` by
  rejecting foreign `*PublishedEvent` support contracts explicitly instead of
  inferring the gap from broader dependency bans
- mechanizing `view-publishedevent-one-carrier-family-per-root-entrypoint`
  after Binder-owned write sinks expose one stable carrier-to-entrypoint
  mapping shape

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)

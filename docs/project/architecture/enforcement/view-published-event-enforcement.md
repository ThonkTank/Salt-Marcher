Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Complete invariant catalog for the `*PublishedEvent` role
itself in `src/view/**`.

# PublishedEvent Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*PublishedEvent` role itself.

It answers four questions for every `*PublishedEvent` surface:

- when the carrier MAY exist
- what the carrier MAY contain
- what the carrier MUST NOT contain
- which local communication boundary the carrier itself MAY cross

This document does not own Binder-installed sink wiring, passive `View`
dependency rules, Binder-to-`*ApplicationService` translation semantics,
file-role topology, or non-`*PublishedEvent` mutation semantics. Those stay in
the neighboring role-enforcement documents and in the view-layer and layering
standards.

The target architecture keeps `*PublishedEvent` as an active-root write-seam
role only. Reusable `slotcontent/**` units do not own `*PublishedEvent`
families in the target model, even where current mechanical gates still admit
or discuss them.

Unified focused bundle entrypoint:

- `./gradlew checkViewPublishedEventEnforcement --rerun-tasks --console=plain`
  runs the currently active PublishedEvent-focused Error Prone and ArchUnit
  checks through one root task. Canonical blocking behavior remains at
  `./gradlew compileJava`, `./gradlew checkViewPublishedEventEnforcement`,
  and `./gradlew checkArchitecture` as listed below.

## Invariant Catalog

### May Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-publishedevent-local-intenthandler-required` | Enforced | every `*PublishedEvent.java` under `src/view/**` | ArchUnit `publishedEventsMustBelongToLocalIntentHandlers` | `./gradlew checkArchitecture` | A `*PublishedEvent` may exist only in a local unit that owns exactly one local `*IntentHandler` exposing `onPublishedEventRequested(Consumer<SamePublishedEvent>)` for that carrier family. In target architecture that local unit is an active root, not a reusable `slotcontent/**` unit. |
| `view-publishedevent-domain-write-seam-necessity` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventRequestSemantics`, together with Error Prone `ViewPublishedEventProducerOwnership` for production/publication ownership | `./gradlew compileJava`, `./gradlew checkViewPublishedEventEnforcement`, and `./gradlew checkArchitecture` | A `*PublishedEvent` exists only for authoritative outward work that roundtrips back through a read-side same-context `published/*Model`. Request-, query-, refresh-, search-, detail-open-, preview-, load-, and reset-style carrier semantics are mechanically rejected when they appear in carrier helper/factory methods, enum constants, or record-component names. |

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-publishedevent-top-level-record-shape` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventBoundary` | `./gradlew compileJava` | `*PublishedEvent` carriers are top-level immutable `record` types rather than mutable classes or helper-shaped containers. |
| `view-publishedevent-jdk-and-own-boundary-payload-allowlist` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventBoundary` | `./gradlew compileJava` | The mechanically accepted payload/support surface stays within documented JDK value/container types and the carrier's own top-level or nested type boundary. |
| `view-publishedevent-same-surface-local-support-only` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventBoundary` | `./gradlew compileJava` | `*PublishedEvent` payload support stays same-surface local only. Foreign `*PublishedEvent` support references are rejected even when they would otherwise look like legal carrier-shaped types. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-publishedevent-no-outer-layer-dependencies` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventBoundary` and ArchUnit `publishedEventsMustStayShellDomainDataAndServiceFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | A `*PublishedEvent` does not depend on `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, `javafx/**`, or root `*ApplicationService` boundaries. |
| `view-publishedevent-no-foreign-non-publishedevent-view-roles` | Enforced | every `*PublishedEvent.java` under `src/view/**` | Error Prone `ViewPublishedEventBoundary` | `./gradlew compileJava` | A `*PublishedEvent` does not depend on foreign non-`PublishedEvent` view-role families such as `*Contribution`, `*Binder`, `*ContributionModel`, `*ContentModel`, `*IntentHandler`, `*View`, `*ViewInputEvent`, or `*InspectorEntry`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-publishedevent-intenthandler-only-production-and-publication` | Enforced | every same-root top-level `*PublishedEvent` production or publication inside `src/view/**` | Error Prone `ViewPublishedEventProducerOwnership` | `./gradlew compileJava` | Outside the `*PublishedEvent` file's own constructor or static-factory implementation details, only the co-located `IntentHandler` may construct and publish top-level same-root `*PublishedEvent` carriers. Carrier ownership and carrier semantics are enforced separately; semantic request-style bans are owned by `ViewPublishedEventRequestSemantics`. |

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)

Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Mechanically enforced and review-owned invariants for
`*ViewInputEvent` carriers in `src/view/**`.

# ViewInputEvent Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*ViewInputEvent` role itself.

It answers four questions for every `*ViewInputEvent` surface:

- when the carrier MAY and MUST exist
- what the carrier MAY contain
- what the carrier MUST NOT contain
- which remaining carrier-local semantics are still review-owned

This document does not own passive `View` outward seam shape,
Binder-installed forwarding, `IntentHandler.consume(...)` entrypoint shape, or
alternate callback-route bans. Those stay in the neighboring role documents.

Unified focused bundle entrypoint:

- `./gradlew checkViewInputEventEnforcement --rerun-tasks --console=plain`
  runs the currently active ViewInputEvent-focused Error Prone, ArchUnit, and
  build-harness checks through one root task. Canonical blocking behavior
  remains at `./gradlew compileJava` and `./gradlew checkArchitecture` as
  listed below.

## Invariant Catalog

### May Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-local-intenthandler-required` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | build-harness `ViewInputEventTopologyRules`, ArchUnit `viewInputEventsMustBelongToInteractiveSameStemViews`, and ArchUnit `interactiveViewsMustOwnSameStemViewInputEventsAndIntentHandlers` | `./gradlew checkArchitecture` | A `*ViewInputEvent` may exist only inside a local interactive view unit that also defines a passive same-stem `*View` surface and a local `*IntentHandler`. |
| `view-viewinputevent-same-stem-local-belonging` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | ArchUnit `interactiveViewsMustOwnSameStemViewInputEventsAndIntentHandlers` and ArchUnit `viewInputEventsMustBelongToInteractiveSameStemViews` | `./gradlew checkArchitecture` | Each carrier belongs only to its own same-stem local interactive `View` surface. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-top-level-record-shape` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | `*ViewInputEvent` carriers are top-level immutable `record` types rather than mutable classes or helper-shaped containers. |
| `view-viewinputevent-allowed-technical-javafx-families-only` | Enforced | every `*ViewInputEvent.java` under `src/view/**` that references JavaFX types | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | If a `*ViewInputEvent` payload references JavaFX types, those references stay inside the allowed technical input/value families `javafx.event.*`, `javafx.geometry.*`, and `javafx.scene.input.*`. |
| `view-viewinputevent-full-snapshot-semantic-adequacy` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | A mechanically legal carrier still represents the one full technical snapshot its local `IntentHandler` needs, rather than a partial bag that silently relies on hidden reads or follow-up callbacks. |
| `view-viewinputevent-technically-necessary-facts-only` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | The carrier contains only the technical facts needed for local intent interpretation, rather than speculative or convenience payload. |
| `view-viewinputevent-same-surface-local-support-only` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | Non-JavaFX support typing stays local to the carrier surface itself instead of pulling in broad helper or infrastructure types that the current gates do not yet reject explicitly. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-no-foreign-view-role-references` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | A `*ViewInputEvent` does not reference foreign `src/view/**` role families such as `*View`, `*Binder`, `*ContributionModel`, `*ContentModel`, `*IntentHandler`, `*PublishedEvent`, legacy view-role buckets, or support files outside the carrier's own type boundary. |
| `view-viewinputevent-no-outer-layer-dependencies` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` and ArchUnit `viewInputEventsMustStayShellDomainDataAndServiceFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | A `*ViewInputEvent` does not depend on `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, or root `*ApplicationService` boundaries. |
| `view-viewinputevent-no-dead-snapshot-components` | Enforced | every record-shaped `*ViewInputEvent.java` with a co-located `IntentHandler.consume(...)` overload | ArchUnit `viewInputEventsMustNotDeclareDeadSnapshotComponents` | `./gradlew checkArchitecture` | Every top-level `*ViewInputEvent` record component is read somewhere by the co-located `IntentHandler.consume(...)` entrypoint instead of remaining dead carrier baggage. |

### Review-Owned Carrier Semantics

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-fire-and-forget-full-snapshot-semantics` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | The carrier is authored as one fire-and-forget full snapshot for its own surface, not as a presenter-style command, ad-hoc partial delta bag, or acknowledgement protocol. |

## Candidate

- mechanizing `view-viewinputevent-same-surface-local-support-only` by
  explicitly rejecting foreign non-view support contracts and view-irrelevant
  infrastructure types instead of leaving that boundary to review
- classifying same-surface helper ownership more explicitly than the current
  own-type-boundary proof if future legal helper shapes become necessary

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)

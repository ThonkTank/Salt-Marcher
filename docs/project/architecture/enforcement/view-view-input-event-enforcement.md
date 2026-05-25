Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-05
Source of Truth: Mechanically enforced and review-owned invariants for
`*ViewInputEvent` carriers in `src/view/**`.

# ViewInputEvent Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*ViewInputEvent` role itself.

Architectural truth for `*ViewInputEvent` lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
This document owns only carrier-local enforcement inventory and current
mechanical drift.

It answers four questions for every `*ViewInputEvent` surface:

- when the carrier MAY and MUST exist
- what the carrier MAY contain
- what the carrier MUST NOT contain
- which remaining carrier-local semantics are still review-owned

This document does not own passive `View` outward seam shape,
Binder-installed forwarding, `IntentHandler.consume(...)` entrypoint shape, or
alternate callback-route bans. Those stay in the neighboring role documents.
It does own the carrier-local rule that top-level `*ViewInputEvent` snapshot
construction belongs only to the same-stem passive `View`, never to Binder or
`IntentHandler` fallback code.

Technical diagnostic route:

- `./gradlew checkViewEnforcement --rerun-tasks --console=plain`
  runs the focused `ViewInputEvent` bundle. Carrier-existence and same-stem
  topology enters transitively through `./gradlew checkViewEnforcement`.
  Canonical compile-side blocking behavior remains at `./gradlew compileJava`;
  aggregate blocking behavior enters `./gradlew checkViewEnforcement` and
  `./gradlew check` through this focused role task.

## Invariant Catalog

### May Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-local-intenthandler-required` | Enforced | every same-root interactive `*View` plus same-stem `*ViewInputEvent` unit inside an active root | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` and `./gradlew checkViewEnforcement` | Every interactive same-root active-root `*View` owns exactly one same-stem local `*ViewInputEvent.java`, and that interactive local unit also owns a local `*IntentHandler.java`. |
| `view-viewinputevent-same-stem-local-belonging` | Enforced | every `*ViewInputEvent.java` under `src/view/**` and every passive `*View.java` under `src/view/**` that exposes `onViewInputEvent(...)` | build-harness `ViewLayerTopologyRules`; Error Prone `PassiveViewSurfaceBoundary` | `./gradlew checkViewEnforcement`, `./gradlew compileJava`, and `./gradlew checkViewEnforcement` | Each carrier belongs only to its own same-stem interactive `View` surface; orphan `*ViewInputEvent` files without a matching passive same-stem `*View` are rejected, and interactive passive `View` seams that point at an aggregate or foreign carrier are rejected too. |
| `view-viewinputevent-reusable-slotcontent-root-interpretation-owner` | Enforced Elsewhere | every reusable `slotcontent/**` `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewBinderViewInputEventWiring`; Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava`, `./gradlew checkViewEnforcement`, and `./gradlew checkViewEnforcement` | A reusable `slotcontent/**` `*ViewInputEvent` is interpreted only by the same-root active `*IntentHandler` that wires the reused View into its contribution. Reusable local handler roles or alternate callback targets are not part of the legal route. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-top-level-record-shape` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | `*ViewInputEvent` carriers are top-level immutable `record` types rather than mutable classes or helper-shaped containers. |
| `view-viewinputevent-no-top-level-helper-api` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | The top-level carrier stays a plain snapshot record and does not expose top-level helper or static-factory APIs. |
| `view-viewinputevent-jdk-only-carrier-payload` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | A `*ViewInputEvent` payload stays JDK-only. JavaFX event objects, JavaFX geometry/input carriers, widget references, listeners, and any other JavaFX types are illegal inside the carrier. |
| `view-viewinputevent-no-command-discriminator-shape` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | A `*ViewInputEvent` top-level record does not declare command-style discriminator components such as `source` or `action`, and it does not hide the same protocol behind nested `Source` or `Action` enums. |
| `view-viewinputevent-full-snapshot-semantic-adequacy` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | A mechanically legal carrier still represents the one full technical snapshot its owning interpretation path needs, rather than a partial bag that silently relies on hidden reads or follow-up callbacks. |
| `view-viewinputevent-technically-necessary-facts-only` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | The carrier contains only the technical facts needed for local intent interpretation, rather than speculative or convenience payload. |
| `view-viewinputevent-same-surface-local-support-only` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | Non-JavaFX support typing stays local to the carrier surface itself instead of pulling in broad helper or infrastructure types that the current gates do not yet reject explicitly. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-no-foreign-view-role-references` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | A `*ViewInputEvent` does not reference foreign `src/view/**` role families such as `*View`, `*Binder`, `*ContributionModel`, `*ContentModel`, `*IntentHandler`, `*PublishedEvent`, legacy view-role buckets, or support files outside the carrier's own type boundary. |
| `view-viewinputevent-no-publishedevent-protocol-coupling` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A `*ViewInputEvent` does not implement, extend, or otherwise couple itself to active-root `*PublishedEvent` mutation or callback protocol families. The carrier stays a View-owned raw snapshot, not a write-side protocol mirror. |
| `view-viewinputevent-no-outer-layer-dependencies` | Enforced | every `*ViewInputEvent.java` under `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A `*ViewInputEvent` does not depend on `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, or root `*ApplicationService` boundaries. |
| `view-viewinputevent-view-raw-snapshot-origin` | Enforced Elsewhere | every same-stem `*ViewInputEvent` construction path inside a passive `*View.java` | Error Prone `ViewInputEventSnapshotBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | The owning passive `View` constructs the carrier from current widget or raw event state. Private same-view `raw*` extraction helpers are accepted only as technical reads of that state; semantic helper reconstruction remains blocked. |
| `view-viewinputevent-no-nonview-top-level-production` | Enforced | every top-level `*ViewInputEvent` construction or top-level static `*ViewInputEvent` API call in `src/view/**` | Error Prone `ViewInputEventBoundary` | `./gradlew compileJava` | Top-level `*ViewInputEvent` carriers are constructed only by their same-stem passive `View`; Binder, `IntentHandler`, model, contribution, and foreign `View` code do not synthesize or factory-call those carriers. |
| `view-viewinputevent-no-pre-intenthandler-semantic-snapshot-reconstruction` | Enforced | every top-level same-stem `*ViewInputEvent` construction in a passive `*View.java` | Error Prone `ViewInputEventSnapshotBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | The same-stem passive `View` constructs its top-level `*ViewInputEvent` directly from current raw widget or raw event state rather than through same-view semantic helper methods, same-view sentinel constants, or hidden model/published/domain/data dependencies. |

### Review-Owned Carrier Semantics

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-viewinputevent-fire-and-forget-full-snapshot-semantics` | Review-Owned | every `*ViewInputEvent.java` under `src/view/**` | none | none | The carrier is authored as one fire-and-forget full snapshot for its own surface, not as a presenter-style command, ad-hoc partial delta bag, or acknowledgement protocol. The remaining judgment is about which JDK value facts belong in that snapshot, not about forwarding raw JavaFX objects downstream. |
| `view-viewinputevent-local-intenthandler-consume-overload-minimality` | Review-Owned | every same-root or reused-child `*ViewInputEvent` family interpreted by an active-root `*IntentHandler` | none | none | The active-root `IntentHandler` still exposes only the minimum focused `consume(...)` entrypoints it truly interprets instead of accreting technically legal but semantically redundant overloads. |
| `view-viewinputevent-no-dead-snapshot-components` | Review-Owned | every record-shaped `*ViewInputEvent.java` under `src/view/**` | none | none | A mechanically legal snapshot still avoids dead components even though the old co-located handler-consume checker was removed with the dedicated ViewInputEvent ArchUnit bundle. |

## Candidate

- mechanizing `view-viewinputevent-same-surface-local-support-only` by
  explicitly rejecting foreign non-view support contracts and view-irrelevant
  infrastructure types instead of leaving that boundary to review
- classifying same-surface helper ownership more explicitly than the current
  own-type-boundary diagnostic if future legal helper shapes become necessary

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)

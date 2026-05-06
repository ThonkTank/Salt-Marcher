Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Complete invariant catalog for the optional
`*IntentHandler` role itself in `src/view/**`.

# View IntentHandler Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
optional `*IntentHandler` role itself.

It answers five questions for every `*IntentHandler` surface:

- when the role MAY exist
- what the role MAY contain
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY expose

This document does not own passive `View` outward seam shape, `*ViewInputEvent`
carrier existence, same-stem belonging, or payload shape, `*PublishedEvent`
carrier shape or producer ownership, Binder-installed forwarding or sink
injection, or Binder-to-`*ApplicationService` translation. Those stay in the
neighboring role-enforcement documents and in the view-layer and layering
standards. This role therefore consumes documented same-stem carriers but does
not own or synthesize them.

Unified focused bundle entrypoint:

- `./gradlew checkViewIntentHandlerEnforcement --rerun-tasks --console=plain`
  runs the currently active IntentHandler-focused Error Prone, ArchUnit, and
  build-harness checks through one root task. Canonical blocking behavior
  remains at `./gradlew compileJava` and `./gradlew checkArchitecture` as
  listed below.

## Invariant Catalog

### May Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-active-root-count` | Enforced | every active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**` | build-harness `ViewIntentHandlerTopologyRules` | `./gradlew checkArchitecture` | Each active root may define at most one local `*IntentHandler.java`. |
| `view-intenthandler-slotcontent-count` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewIntentHandlerTopologyRules` | `./gradlew checkArchitecture` | Each reusable `slotcontent/**` unit may define at most one local `*IntentHandler.java`. |
| `view-intenthandler-local-input-interpretation-necessity` | Review-Owned | every local unit that defines a `*IntentHandler` | none | none | A local `*IntentHandler` exists only when the unit really owns local input interpretation. Fully passive units stay without a handler instead of parking non-essential orchestration behind a legal role file. |

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-colocated-model-dependency-only` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` | `./gradlew compileJava` | An `IntentHandler` may depend on a model role only through its own same-package `*ContributionModel` or `*ContentModel`. |
| `view-intenthandler-colocated-viewinputevent-dependency-only` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` and Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | An `IntentHandler` may depend on input carriers only through its own same-package `*ViewInputEvent` family and the required `consume(...)` seam that consumes such a carrier. |
| `view-intenthandler-optional-local-publishedevent-write-seam` | Enforced | every `*IntentHandler.java` that opens a Binder-mediated outward-work seam | Error Prone `ViewIntentHandlerDependencyBoundary` and ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew compileJava` and `./gradlew checkArchitecture` | When a local input interpretation must trigger a domain write, an `IntentHandler` may depend on a matching same-package `*PublishedEvent` family and expose that seam only through the exact `onPublishedEventRequested(Consumer<MatchingLocalPublishedEvent>)` contract. |
| `view-intenthandler-same-surface-local-support-only` | Review-Owned | every `*IntentHandler.java` under `src/view/**` | none | none | Beyond the allowed model and carrier families above, helper state and helper types stay local to the same handler surface instead of becoming hidden foreign-role or cross-unit coordination channels. |

### Must Contain

No additional role-local containment invariant is owned here beyond the
communication seam obligations documented below.

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-no-outer-layer-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` and ArchUnit `intentHandlersMustStayShellDomainAndDataFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | An `IntentHandler` does not depend on `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, or `javafx/**`. |
| `view-intenthandler-no-applicationservice-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerApplicationSinkBoundary` | `./gradlew compileJava` | An `IntentHandler` does not reference root `*ApplicationService` types directly. |
| `view-intenthandler-no-foreign-or-forbidden-view-role-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` | `./gradlew compileJava` | An `IntentHandler` does not depend on foreign view units or on forbidden view-role families beyond its own same-package model role, same-package `*ViewInputEvent`, same-package `*PublishedEvent`, and same-surface local support types. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-viewinputevent-consume-entrypoint` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | An `IntentHandler` exposes a fire-and-forget `void consume(SameRootViewInputEvent)` input seam. |
| `view-intenthandler-no-viewinputevent-discriminator-dispatch` | Enforced | every `consume(SameRootViewInputEvent)` overload in `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | `IntentHandler.consume(...)` derives meaning from concrete `*ViewInputEvent` snapshot fields instead of dispatching through `event.source()` or `event.action()` command discriminators. |
| `view-intenthandler-publishedevent-consumer-sink-contract` | Enforced | every `*IntentHandler.java` that exposes a Binder-mediated outward-work seam | ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew checkArchitecture` | If an `IntentHandler` exposes a Binder-mediated outward-work seam, that seam is `onPublishedEventRequested(Consumer<MatchingLocalPublishedEvent>)` for a matching same-package `*PublishedEvent` family; alternate non-private PublishedEvent sink or proxy methods are forbidden. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-thin-local-interpretation-semantics` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | A legal `IntentHandler` still stays a thin local input-interpretation role rather than becoming a hidden workflow coordinator. Purely local UI-only state such as selection, tool mode, open/closed flags, or comparable presentation facts may be written directly into the co-located model without growing a domain seam, while authoritative session or domain transitions still leave through one emitted `*PublishedEvent` instead of projection-model-driven command reconstruction. |
| `view-intenthandler-consume-surface-minimality` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | The legal `consume(...)` entrypoint set is still the minimum local interpretation surface instead of an accumulation of extra technically legal entrypoints and helper protocols. |
| `view-intenthandler-no-viewinputevent-fallback-synthesis` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | A legal `IntentHandler` does not synthesize fallback `*ViewInputEvent` instances or rebuild the carrier protocol internally beyond the now-mechanically-blocked `source/action` discriminator dispatch anti-pattern. |
| `view-intenthandler-local-view-effect-sink-necessity` | Review-Owned | every mechanically legal `*IntentHandler.java` that exposes a non-domain local effect sink | none | none | A legal local effect sink exists only for same-root passive-View effects that neither mutate projection state nor cross a domain boundary. Reset-, focus-, or viewport-style effects must stay local and must not be re-modeled as `PublishedEvent` or as projection-model request protocols. |
| `view-intenthandler-write-seam-necessity` | Review-Owned | every mechanically legal `*IntentHandler.java` that exposes `onPublishedEventRequested(...)` | none | none | A legal local published-event seam is used only when the interaction really needs Binder-mediated domain-write work rather than remaining presentation-local. Query/load/search/preview/reset/detail-open or shell/view-effect protocols do not justify a write seam. |

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)

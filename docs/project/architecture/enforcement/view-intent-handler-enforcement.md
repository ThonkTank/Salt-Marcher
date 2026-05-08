Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Complete invariant catalog for the active-root
`*IntentHandler` role itself in `src/view/**`.

# View IntentHandler Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
active-root `*IntentHandler` role itself.

Architectural truth for the active-root `*IntentHandler` role lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
This document owns only IntentHandler-local enforcement inventory and current
mechanical drift.

It answers five questions for every `*IntentHandler` surface:

- when the role MAY exist
- what the role MAY contain
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY expose

This document does not own passive `View` outward seam shape, `*ViewInputEvent`
carrier existence, same-stem belonging, or payload shape, legacy
`*PublishedEvent` carrier shape or producer ownership, Binder-installed
forwarding or sink injection, or the detailed root `*ApplicationService`
boundary contract itself. Those stay in the neighboring role-enforcement
documents and in the view-layer and layering standards. This role therefore
consumes documented same-stem carriers but does not own or synthesize them.

Where current gates still model reusable local handlers or Binder-mediated
`*PublishedEvent` write seams, the rows below call that out only as drift
relative to the View Layer Standard.

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
| `view-intenthandler-slotcontent-count` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewIntentHandlerTopologyRules` | `./gradlew checkArchitecture` | The current topology gate still permits at most one reusable local `*IntentHandler.java`. That is legacy gate behavior; target architecture forbids reusable local handlers entirely. |
| `view-intenthandler-local-input-interpretation-necessity` | Review-Owned | every active root that defines a `*IntentHandler` | none | none | An active-root `*IntentHandler` exists only when the contribution really owns input interpretation. Reusable `slotcontent/**` units stay without a handler instead of parking non-essential orchestration behind a legal role file. |

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-colocated-model-dependency-only` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` | `./gradlew compileJava` | The current gate proves only that an `IntentHandler` reaches model state through same-package `*ContributionModel` or `*ContentModel`. Target architecture is slightly broader: an active-root handler may read the same-root `*ContributionModel` and the reused child `*ContentModel`s that belong to the contribution it orchestrates. |
| `view-intenthandler-colocated-viewinputevent-dependency-only` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` and Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | The current gate proves only same-package `*ViewInputEvent` consumption. Target architecture is slightly broader: an active-root handler may also consume reused child `slotcontent/**` `*ViewInputEvent` families wired in by its Binder. |
| `view-intenthandler-optional-local-publishedevent-write-seam` | Enforced | every `*IntentHandler.java` that opens a Binder-mediated outward-work seam | Error Prone `ViewIntentHandlerDependencyBoundary` and ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew compileJava` and `./gradlew checkArchitecture` | The current mechanical stack still allows an `IntentHandler` to depend on a matching same-package `*PublishedEvent` family and expose that seam only through the exact `onPublishedEventRequested(Consumer<MatchingLocalPublishedEvent>)` contract. That is current gate behavior, not target architecture. |
| `view-intenthandler-same-surface-local-support-only` | Review-Owned | every `*IntentHandler.java` under `src/view/**` | none | none | Beyond the allowed model and carrier families above, helper state and helper types stay local to the same handler surface instead of becoming hidden foreign-role or cross-unit coordination channels. |

### Must Contain

No additional role-local containment invariant is owned here beyond the
communication seam obligations documented below.

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-no-outer-layer-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` and ArchUnit `intentHandlersMustStayShellDomainAndDataFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | An `IntentHandler` does not depend on `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, or `javafx/**`. |
| `view-intenthandler-no-applicationservice-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerApplicationSinkBoundary` | `./gradlew compileJava` | The current mechanical stack still rejects direct root `*ApplicationService` references from `IntentHandler`. That is current gate drift, not target architecture. |
| `view-intenthandler-no-foreign-or-forbidden-view-role-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` | `./gradlew compileJava` | The current gate forbids foreign view units and still limits legal view-role dependencies to same-package model, same-package `*ViewInputEvent`, same-package `*PublishedEvent`, and same-surface local support types. Target architecture is slightly broader because an active-root handler may also depend on reused child `*ContentModel` and reused child `*ViewInputEvent` families that belong to its contribution. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-viewinputevent-consume-entrypoint` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | An `IntentHandler` exposes one fire-and-forget `consume(...)` entrypoint per `*ViewInputEvent` family it interprets. The current gate family still proves only same-package consumption, while the target architecture also needs active-root entrypoints for reused `slotcontent/**` carriers. |
| `view-intenthandler-no-viewinputevent-discriminator-dispatch` | Enforced | every `consume(SameRootViewInputEvent)` overload in `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | `IntentHandler.consume(...)` derives meaning from concrete `*ViewInputEvent` snapshot fields instead of dispatching through `event.source()` or `event.action()` command discriminators. |
| `view-intenthandler-publishedevent-consumer-sink-contract` | Enforced | every `*IntentHandler.java` that exposes a Binder-mediated outward-work seam | ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew checkArchitecture` | If current mechanical code still exposes a Binder-mediated outward-work seam, that seam is `onPublishedEventRequested(Consumer<MatchingLocalPublishedEvent>)` for a matching same-package `*PublishedEvent` family; alternate non-private PublishedEvent sink or proxy methods are forbidden. This is legacy gate behavior, not target architecture. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-thin-local-interpretation-semantics` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | A legal active-root `IntentHandler` still stays a thin input-interpretation role rather than becoming a hidden workflow coordinator. Purely local UI-only state such as selection, tool mode, open/closed flags, or comparable presentation facts may be written directly into the same-root `ContributionModel` or reused child `ContentModel`s without growing a domain seam, while authoritative session or domain transitions leave through one focused root `*ApplicationService` call. |
| `view-intenthandler-consume-surface-minimality` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | The legal `consume(...)` entrypoint set is still the minimum local interpretation surface instead of an accumulation of extra technically legal entrypoints and helper protocols. |
| `view-intenthandler-no-viewinputevent-fallback-synthesis` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | A legal `IntentHandler` does not synthesize fallback `*ViewInputEvent` instances or rebuild the carrier protocol internally beyond the now-mechanically-blocked `source/action` discriminator dispatch anti-pattern. |
| `view-intenthandler-local-view-effect-sink-necessity` | Review-Owned | every mechanically legal `*IntentHandler.java` that exposes a non-domain local effect sink | none | none | A legal local effect sink exists only for same-root passive-View effects that neither mutate projection state nor cross a domain boundary. Reset-, focus-, or viewport-style effects must stay local and must not be re-modeled as `PublishedEvent` or as projection-model request protocols. |
| `view-intenthandler-write-seam-necessity` | Review-Owned | every mechanically legal `*IntentHandler.java` that still exposes a legacy outward write seam | none | none | If a mechanically legal `IntentHandler` still exposes a legacy outward write seam, that seam is justified only by real domain-write work rather than presentation-local behavior. Query/load/search/preview/reset/detail-open or shell/view-effect protocols do not justify a write seam. |

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)

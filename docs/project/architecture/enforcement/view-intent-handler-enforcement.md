Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Complete invariant catalog for the optional
`*IntentHandler` role itself in `src/view/**`.

# View IntentHandler Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*IntentHandler` role itself.

It answers four questions for every `*IntentHandler` surface:

- when the role MAY exist
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own passive `View` callback seams, `*ViewInputEvent`
carrier existence or carrier shape, `*PublishedEvent` carrier shape or
producer ownership, Binder-installed wiring, or Binder-to-`*ApplicationService`
translation. Those stay in the neighboring role-enforcement documents and in
the view-layer and layering standards.

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
| `view-intenthandler-passive-surface-necessity` | Review-Owned | every local unit that defines a `*IntentHandler` | none | none | A local `*IntentHandler` exists only when the unit really owns interactive input interpretation. Fully passive units stay without a handler instead of parking non-essential orchestration behind a legal role file. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-consume-viewinputevent-entrypoint` | Enforced | every interactive `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | An interactive `IntentHandler` exposes a fire-and-forget `consume(SameRootViewInputEvent)` entrypoint for its own local interactive surface. |
| `view-intenthandler-local-publishedevent-sink-contract` | Enforced | every `*IntentHandler.java` that exposes a published-event sink seam | ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew checkArchitecture` | A handler that exposes `onPublishedEventRequested(Consumer<...>)` does so for a matching same-package `*PublishedEvent` family. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-no-outer-layer-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` and ArchUnit `intentHandlersMustStayShellDomainAndDataFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | An `IntentHandler` does not depend on `shell/**`, `bootstrap/**`, `src/domain/**`, `src/data/**`, or `javafx/**`. |
| `view-intenthandler-no-applicationservice-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerApplicationSinkBoundary` | `./gradlew compileJava` | An `IntentHandler` does not reference root `*ApplicationService` types directly. |
| `view-intenthandler-no-foreign-or-forbidden-view-role-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` | `./gradlew compileJava` | An `IntentHandler` does not depend on foreign view units or on forbidden view-role families beyond its own same-package `ContributionModel` or `ContentModel`, same-package `*ViewInputEvent`, same-package `*PublishedEvent`, and same-surface local support types. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-viewinputevent-consume-entrypoint` | Enforced | every interactive `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | Local interactive input reaches the handler through a fire-and-forget `consume(SameRootViewInputEvent)` entrypoint for the handler's own surface. |
| `view-intenthandler-publishedevent-consumer-sink-contract` | Enforced | every `*IntentHandler.java` that exposes a write-side publication seam | ArchUnit `intentHandlersWithPublishedEventSinkMustOwnMatchingPublishedEvents` | `./gradlew checkArchitecture` | If a handler exposes a write-side publication seam, that seam targets a matching same-package `*PublishedEvent` family through `onPublishedEventRequested(Consumer<SameRootPublishedEvent>)`. |
| `view-intenthandler-no-direct-backend-communication` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerApplicationSinkBoundary` and ArchUnit `intentHandlersMustStayShellDomainAndDataFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | A handler does not communicate with the backend through direct `*ApplicationService`, domain, or data dependencies. |

## Review-Owned

- whether a mechanically legal `IntentHandler` still stays a thin local
  input-interpretation role rather than turning into a hidden workflow
  coordinator
- whether a legal `consume(...)` entrypoint set is still the minimum local
  interpretation surface or whether the unit should stay fully passive
- whether a mechanically legal handler still avoids extra local helper seams
  that are structurally legal but unnecessary beside `consume(...)` and the
  optional published-event sink contract
- whether a legal local published-event sink is really needed or whether the
  interaction should remain local presentation-only without a write-side seam

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)

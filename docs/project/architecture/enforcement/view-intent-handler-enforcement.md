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
carrier existence, same-stem belonging, or payload shape, Binder-installed
forwarding, or the detailed root `*ApplicationService` boundary contract
itself. Those stay in the neighboring role-enforcement documents and in the
view-layer and layering standards. This role therefore consumes documented
same-stem carriers but does not own or synthesize them.

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
| `view-intenthandler-slotcontent-count` | Enforced | every reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewIntentHandlerTopologyRules` | `./gradlew checkArchitecture` | Reusable `slotcontent/**` units define no local `*IntentHandler.java`; input interpretation stays in the same-root contribution `IntentHandler`. |
| `view-intenthandler-local-input-interpretation-necessity` | Review-Owned | every active root that defines a `*IntentHandler` | none | none | An active-root `*IntentHandler` exists only when the contribution really owns input interpretation. Reusable `slotcontent/**` units stay without a handler instead of parking non-essential orchestration behind a legal role file. |

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-projectionmodel-dependency-surface` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` | `./gradlew compileJava` | An active-root `IntentHandler` may read only its same-root `*ContributionModel` and reused child `slotcontent/**` `*ContentModel` surfaces when it needs local UI facts for interpretation. |
| `view-intenthandler-viewinputevent-dependency-surface` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` and Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | An active-root `IntentHandler` may consume only same-root or reused child `slotcontent/**` `*ViewInputEvent` families, and those carriers remain the only top-level input protocol it interprets. |
| `view-intenthandler-root-applicationservice-boundary-surface` | Enforced | every `*IntentHandler.java` under `src/view/**` that crosses the domain-write boundary | Error Prone `ViewIntentHandlerDependencyBoundary` and ArchUnit `intentHandlersMustDependOnDomainOnlyThroughRootApplicationServices` | `./gradlew compileJava` and `./gradlew checkArchitecture` | Domain-write work may leave an active-root `IntentHandler` only through a direct dependency on the matching root `*ApplicationService`. |
| `view-intenthandler-same-surface-local-support-only` | Review-Owned | every `*IntentHandler.java` under `src/view/**` | none | none | Beyond the allowed model and carrier families above, helper state and helper types stay local to the same handler surface instead of becoming hidden foreign-role or cross-unit coordination channels. |

### Must Contain

No additional role-local containment invariant is owned here beyond the
communication seam obligations documented below.

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-no-shell-data-bootstrap-or-javafx-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` and ArchUnit `intentHandlersMustStayShellDataAndBootstrapFree` | `./gradlew compileJava` and `./gradlew checkArchitecture` | An `IntentHandler` does not depend on `shell/**`, `bootstrap/**`, `src/data/**`, or `javafx/**`. |
| `view-intenthandler-no-non-applicationservice-domain-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` and ArchUnit `intentHandlersMustDependOnDomainOnlyThroughRootApplicationServices` | `./gradlew compileJava` and `./gradlew checkArchitecture` | An `IntentHandler` does not depend on domain internals outside the matching root `*ApplicationService`. |
| `view-intenthandler-no-foreign-or-forbidden-view-role-dependencies` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerDependencyBoundary` | `./gradlew compileJava` | An active-root handler depends only on same-root `*ContributionModel`, same-root or reused child `*ViewInputEvent`, reused child `*ContentModel`, direct root `*ApplicationService`, and same-surface local support types. `*PublishedEvent` and other foreign view-role families are forbidden. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-viewinputevent-consume-entrypoint` | Enforced | every `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | An `IntentHandler` exposes fire-and-forget `consume(...)` entrypoints only for same-root or reused child `slotcontent/**` `*ViewInputEvent` families it interprets. |
| `view-intenthandler-no-viewinputevent-discriminator-dispatch` | Enforced | every legal `consume(...ViewInputEvent)` overload in `*IntentHandler.java` under `src/view/**` | Error Prone `ViewIntentHandlerViewInputEvent` | `./gradlew compileJava` | `IntentHandler.consume(...)` derives meaning from concrete `*ViewInputEvent` snapshot fields instead of dispatching through `event.source()` or `event.action()` command discriminators. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-intenthandler-thin-local-interpretation-semantics` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | A legal active-root `IntentHandler` still stays a thin input-interpretation role rather than becoming a hidden workflow coordinator. Purely local UI-only state such as selection, tool mode, open/closed flags, or comparable presentation facts may be written directly into the same-root `ContributionModel` or reused child `ContentModel`s without growing a domain seam, while authoritative session or domain transitions leave through one focused root `*ApplicationService` call. |
| `view-intenthandler-consume-surface-minimality` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | The legal `consume(...)` entrypoint set is still the minimum local interpretation surface instead of an accumulation of extra technically legal entrypoints and helper protocols. |
| `view-intenthandler-no-viewinputevent-fallback-synthesis` | Review-Owned | every mechanically legal `*IntentHandler.java` under `src/view/**` | none | none | A legal `IntentHandler` does not synthesize fallback `*ViewInputEvent` instances or rebuild the carrier protocol internally beyond the now-mechanically-blocked `source/action` discriminator dispatch anti-pattern. |
| `view-intenthandler-local-view-effect-sink-necessity` | Review-Owned | every mechanically legal `*IntentHandler.java` that exposes a non-domain local effect sink | none | none | A legal local effect sink exists only for same-root passive-View effects that neither mutate projection state nor cross a domain boundary. Reset-, focus-, or viewport-style effects must stay local and must not be remodeled as a second write protocol or as projection-model request protocols. |

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)

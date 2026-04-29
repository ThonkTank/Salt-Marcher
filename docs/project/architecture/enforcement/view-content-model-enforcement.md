Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the reusable `*ContentModel`
role itself in `src/view/slotcontent/**`.

# View ContentModel Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
reusable `*ContentModel` role itself.

It answers three questions for every reusable `*ContentModel` surface:

- what the role MUST or MAY contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own reusable-unit role count or required-existence
rules, passive `View` read or mutation rules, Binder-owned readback wiring,
or `IntentHandler` / `*ViewInputEvent` / `*PublishedEvent` protocol rules.
Those stay in the neighboring role-enforcement documents and in the
view-layer and layering standards.

Unified focused bundle entrypoint:

- `./gradlew checkViewContentModelEnforcement --rerun-tasks --console=plain`
  runs the currently active ContentModel-focused Error Prone, ArchUnit,
  jQAssistant, and build-harness checks through one root task. Canonical
  blocking behavior remains at `./gradlew compileJava`,
  `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` as
  listed below.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contentmodel-reusable-role-shape` | Enforced | every projection-model role file in a reusable `slotcontent/**` unit under `src/view/**` | build-harness `ViewContentModelTopologyRules` | `./gradlew checkArchitecture` | Reusable `slotcontent/**` projection-model roles use the reusable role shape `*ContentModel.java` rather than active-root `*ContributionModel.java` or legacy `*ViewModel.java`, `*PresentationModel.java`, or `*Projector.java` files. |
| `view-contentmodel-observable-projection-scope` | Review-Owned | every reusable `*ContentModel.java` under `src/view/**` | none | none | A `ContentModel` carries the reusable observable projection state its passive `View` surface renders and its co-located `IntentHandler` may need for local input interpretation, including render-relevant and input-relevant facts. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contentmodel-no-outer-layer-or-service-dependencies` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelDependencyBoundary`, ArchUnit `contentModelsMustStayShellDataAndServiceFree`, ArchUnit `contentModelsMustNotDependOnApplicationServices`, and jQAssistant `saltmarcher:ViewContentModelDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` | A `ContentModel` does not depend on `shell/**`, `bootstrap/**`, `src/data/**`, or root `*ApplicationService` boundaries. |
| `view-contentmodel-no-write-side-domain-carriers` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelDependencyBoundary` and jQAssistant `saltmarcher:ViewContentModelDependencies` | `./gradlew compileJava` and `./gradlew checkViewArchitecture` | A `ContentModel` does not depend on domain internals or write-side `published/**` carrier families such as `*Command`, `*Query`, `*Operation`, or `*Edit`; domain reach stays read-side only. |
| `view-contentmodel-no-foreign-view-role-dependencies` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelDependencyBoundary` and jQAssistant `saltmarcher:ViewContentModelDependencies` | `./gradlew compileJava` and `./gradlew checkViewArchitecture` | A `ContentModel` does not depend on `*Contribution`, `*Binder`, `*IntentHandler`, `*View`, `*ViewInputEvent`, `*PublishedEvent`, `*InspectorEntry`, or foreign view-unit role families. |
| `view-contentmodel-no-nested-input-or-command-carriers` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelFlatSurface` | `./gradlew compileJava` | A `ContentModel` does not declare nested `*Intent`, `*Input`, `*Request`, `*Command`, `*Query`, `*Operation`, or `*Edit` carrier types. |
| `view-contentmodel-no-hidden-orchestration-surface` | Review-Owned | every reusable `*ContentModel.java` under `src/view/**` | none | none | A mechanically legal `ContentModel` still avoids request fields, service handles, shell contracts, deep orchestration state, or other hidden workflow channels that do not belong to a flat observable projection surface. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contentmodel-read-side-only-direct-boundary` | Enforced | every reusable `*ContentModel.java` under `src/view/**` | Error Prone `ViewContentModelDependencyBoundary`, ArchUnit `contentModelsMustStayShellDataAndServiceFree`, ArchUnit `contentModelsMustNotDependOnApplicationServices`, and jQAssistant `saltmarcher:ViewContentModelDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` | A `ContentModel` communicates directly only with read-side domain `published/**` carriers, JavaFX beans or collections, same-unit model surfaces, and allowed same-surface local support types. |
| `view-contentmodel-no-separate-presentation-event-protocol` | Review-Owned | every reusable `*ContentModel.java` under `src/view/**` | none | none | A `ContentModel` exposes observable state only; it does not grow separate presentation-event, callback, acknowledgement, or presenter-style communication APIs. |

## Candidate

- mechanizing whether a boundary-compliant `ContentModel` is already the
  minimum shared reusable projection surface rather than a structurally legal
  but overgrown state bag

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)

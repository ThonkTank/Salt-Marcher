Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the active-root
`*ContributionModel` role itself in `src/view/**`.

# View ContributionModel Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
active-root `*ContributionModel` role itself.

It answers three questions for every active-root `*ContributionModel` surface:

- what the role MUST or MAY contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own active-root topology, role-count or
required-existence rules, passive `View` read or mutation rules,
Binder-owned readback wiring or Binder-owned write translation, the
view-layer-wide mutation-cycle contract, or `IntentHandler` /
`*ViewInputEvent` / `*PublishedEvent` protocol and necessity rules. Those
stay in the neighboring role-enforcement documents and in the view-layer and
layering standards.

Unified focused bundle entrypoint:

- `./gradlew checkViewContributionModelEnforcement --rerun-tasks --console=plain`
  runs the currently active ContributionModel-focused Error Prone, ArchUnit,
  jQAssistant, and build-harness checks through one root task. Canonical
  blocking behavior remains at `./gradlew compileJava`,
  `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` as
  listed below.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contributionmodel-active-root-role-shape` | Enforced | every projection-model role file in an active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, or `src/view/dropdowns/**` | build-harness `ViewContributionModelTopologyRules` | `./gradlew checkArchitecture` | Active roots use the active projection-model role shape `*ContributionModel.java` rather than reusable `*ContentModel.java` or legacy `*ViewModel.java`, `*PresentationModel.java`, or `*Projector.java` files. |
| `view-contributionmodel-observable-projection-scope` | Review-Owned | every active-root `*ContributionModel.java` under `src/view/**` | none | none | A `ContributionModel` carries the complete contribution-local observable projection state for one shell-hung contribution, including render-relevant and input-relevant facts such as text, render data, labels, enablement, selections, active tools, and the other local facts its passive `View` surfaces render and its co-located `IntentHandler` may need for local input interpretation. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contributionmodel-no-outer-layer-or-service-dependencies` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelDependencyBoundary`, ArchUnit `contributionModelsMustStayShellDataAndServiceFree`, ArchUnit `contributionModelsMustNotDependOnApplicationServices`, and jQAssistant `saltmarcher:ViewContributionModelDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` | A `ContributionModel` does not depend on `shell/**`, `bootstrap/**`, `src/data/**`, or root `*ApplicationService` boundaries. |
| `view-contributionmodel-no-write-side-domain-carriers` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelDependencyBoundary` and jQAssistant `saltmarcher:ViewContributionModelDependencies` | `./gradlew compileJava` and `./gradlew checkViewArchitecture` | A `ContributionModel` does not depend on domain internals or write-side `published/**` carrier families such as `*Command`, `*Query`, `*Operation`, or `*Edit`; domain reach stays read-side only. |
| `view-contributionmodel-no-foreign-view-role-dependencies` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelDependencyBoundary` and jQAssistant `saltmarcher:ViewContributionModelDependencies` | `./gradlew compileJava` and `./gradlew checkViewArchitecture` | A `ContributionModel` does not depend on `*Contribution`, `*Binder`, `*IntentHandler`, `*View`, `*ViewInputEvent`, `*PublishedEvent`, `*InspectorEntry`, or foreign view-unit role families. |
| `view-contributionmodel-no-nested-input-or-command-carriers` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelFlatSurface` | `./gradlew compileJava` | A `ContributionModel` does not declare nested `*Intent`, `*Input`, `*Request`, `*Command`, `*Query`, `*Operation`, or `*Edit` carrier types. |
| `view-contributionmodel-no-hidden-orchestration-surface` | Review-Owned | every active-root `*ContributionModel.java` under `src/view/**` | none | none | A mechanically legal `ContributionModel` still avoids request fields, service handles, shell contracts, deep nested orchestration state, or other hidden workflow channels that do not belong to a flat observable projection surface. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contributionmodel-read-side-only-direct-boundary` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelDependencyBoundary`, ArchUnit `contributionModelsMustStayShellDataAndServiceFree`, ArchUnit `contributionModelsMustNotDependOnApplicationServices`, and jQAssistant `saltmarcher:ViewContributionModelDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` | A `ContributionModel` communicates directly only with read-side domain `published/**` carriers, JavaFX beans or collections, and allowed same-surface local value/support types. |
| `view-contributionmodel-no-separate-presentation-event-protocol` | Review-Owned | every active-root `*ContributionModel.java` under `src/view/**` | none | none | A `ContributionModel` exposes observable state only; it does not grow separate presentation-event, callback, acknowledgement, or presenter-style communication APIs. |

## Candidate

- mechanizing whether a boundary-compliant `ContributionModel` is already the
  minimum shared projection surface rather than a structurally legal but
  overgrown state bag

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)

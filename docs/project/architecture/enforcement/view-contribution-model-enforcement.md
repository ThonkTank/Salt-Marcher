Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-13
Source of Truth: Complete invariant catalog for the active-root
`*ContributionModel` role itself in `src/view/**`.

# View ContributionModel Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
active-root `*ContributionModel` role itself.

Architectural truth for active-root `*ContributionModel` lives only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1).
This document owns only ContributionModel-local enforcement inventory and
current mechanical drift.

It answers three questions for every active-root `*ContributionModel` surface:

- what the role MUST or MAY contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own active-root topology, role-count or
required-existence rules, passive `View` read or mutation rules,
Binder-owned runtime-service lookup, the view-layer-wide mutation-cycle
contract, or `IntentHandler` / `*ViewInputEvent` / legacy `*PublishedEvent`
protocol and necessity rules. Those stay in the neighboring role-enforcement
documents and in the view-layer and layering standards.

Merged focused bundle entrypoint:

- `./gradlew checkViewEnforcement --rerun-tasks --console=plain`
  runs the focused active-root `ContributionModel` bundle. Role-shape
  topology enters transitively through `./gradlew checkViewEnforcement`.
  Canonical compile-side blocking behavior remains at `./gradlew compileJava`;
  aggregate blocking behavior enters `./gradlew checkViewEnforcement` and
  `./gradlew check` through this focused role task.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contributionmodel-active-root-role-shape` | Enforced | every aggregate projection-model role file in an active root under `src/view/leftbartabs/**`, `src/view/statetabs/**`, or `src/view/dropdowns/**` | build-harness `ViewLayerTopologyRules` | `./gradlew checkViewEnforcement` | Active roots use exactly one aggregate projection-model role named `*ContributionModel.java`; active-root `*ContentModel.java` files are legal only as same-stem passive-View content models and are not alternate aggregate models. |
| `view-contributionmodel-observable-projection-scope` | Review-Owned | every active-root `*ContributionModel.java` under `src/view/**` | none | none | A `ContributionModel` carries the root-wide observable projection state for one shell-hung contribution, including root-level mode, status, cross-surface selection, readback coordination, and input-relevant facts its same-root `IntentHandler` may need for local interpretation. It orchestrates child `ContentModel`s instead of absorbing their component-specific render and input logic. Those facts remain projection-only and do not become a hidden write-side session mirror or command reconstruction backchannel. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contributionmodel-no-outer-layer-or-service-dependencies` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A `ContributionModel` does not depend on `shell/**`, `bootstrap/**`, `src/data/**`, or root `*ApplicationService` boundaries. |
| `view-contributionmodel-no-write-side-domain-carriers` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A `ContributionModel` does not depend on domain internals or write-side `published/**` carrier families such as `*Command`, `*Query`, `*Operation`, or `*Edit`; domain reach stays read-side only. |
| `view-contributionmodel-no-foreign-view-role-dependencies` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A `ContributionModel` may coordinate same-root or intentionally reused child `*ContentModel` surfaces, but it does not depend on `*Contribution`, `*Binder`, `*IntentHandler`, `*View`, `*ViewInputEvent`, `*PublishedEvent`, `*InspectorEntry`, foreign `*ContentModel`, or other foreign view-unit role families. |
| `view-contributionmodel-no-nested-input-or-command-carriers` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelFlatSurface` | `./gradlew compileJava` | A `ContributionModel` does not declare nested `*Intent`, `*Input`, `*Request`, `*Command`, `*Query`, `*Operation`, or `*Edit` carrier types. |
| `view-contributionmodel-no-outward-request-or-publish-protocols` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelRequestProtocol` | `./gradlew compileJava` | A `ContributionModel` exposes observable projection state only. It does not open outward request-token, publish-like, callback, or acknowledgement protocols such as `*Request*Property()`, `*TokenProperty()`, or non-private `publish*()` seams. |
| `view-contributionmodel-no-hidden-orchestration-surface` | Review-Owned | every active-root `*ContributionModel.java` under `src/view/**` | none | none | A mechanically legal `ContributionModel` still avoids service handles, shell contracts, deep nested orchestration state, or other hidden workflow channels that do not belong to a flat observable projection surface. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contributionmodel-read-side-only-direct-boundary` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A `ContributionModel` communicates directly only with read-side domain `published/**` carriers, JavaFX beans or collections, allowed same-surface local value/support types, and same-root or intentionally reused child `*ContentModel` surfaces it orchestrates. In target architecture that read-side boundary is not just passive data access: the `ContributionModel` is also the listener-side owner of root-wide `published/*Model` readback reaction while child `ContentModel`s own component-local projection reaction. |
| `view-contributionmodel-no-separate-presentation-event-protocol` | Enforced | every active-root `*ContributionModel.java` under `src/view/**` | Error Prone `ViewContributionModelRequestProtocol` | `./gradlew compileJava` | A `ContributionModel` exposes observable state only; it does not grow separate presentation-event, callback, acknowledgement, request-token, or presenter-style communication APIs. |

## Candidate

- mechanizing whether a boundary-compliant `ContributionModel` is already the
  minimum shared projection surface rather than a structurally legal but
  overgrown state bag

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)

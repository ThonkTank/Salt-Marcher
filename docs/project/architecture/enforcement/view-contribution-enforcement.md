Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the active-root
`*Contribution` role itself in `src/view/**`.

# View Contribution Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
active-root `*Contribution` role itself.

It answers four questions for every `*Contribution` surface:

- when the role MAY exist
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own active-root role-count rules, general
`slotcontent/**` topology, bootstrap startup selection and fallback policy,
shell lifecycle-hook ownership, or generic cross-layer boundary rules beyond
the direct `*Contribution` role itself. Those stay in the view-layer,
bootstrap, shell-role, and layering enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkViewContributionEnforcement --rerun-tasks --console=plain`
  runs the currently active Contribution-focused Error Prone, ArchUnit, and
  PMD checks through one root task. Canonical compile-side blocking behavior
  remains at `./gradlew compileJava`; aggregate blocking behavior enters
  `./gradlew checkArchitecture` and `./gradlew check` through this bundle.

## Invariant Catalog

### May Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contribution-active-root-placement` | Enforced | every `*Contribution.java` under `src/view/**` | ArchUnit `contributionsStayInActiveRoots` | `./gradlew checkViewContributionEnforcement` | A view contribution may exist only as an active-root shell entrypoint under `src/view/leftbartabs/**`, `src/view/statetabs/**`, or `src/view/dropdowns/**`. It does not appear under `slotcontent/**` or other non-active-root view locations. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contribution-discovery-entrypoint-shape` | Enforced | every active-root `*Contribution.java` under `src/view/leftbartabs/**`, `src/view/statetabs/**`, or `src/view/dropdowns/**` | PMD `ViewContributionEntrypointRule` | `./gradlew pmdViewContributionEnforcement` and `./gradlew checkViewContributionEnforcement` | A view contribution keeps the documented shell-discovery entrypoint shape: `*Contribution` naming, `public final` class shape, public no-arg discovery constructor, `ShellContribution` contract, `registrationSpec()`, and `bind(ShellRuntimeContext)`. |
| `view-contribution-shell-spec-family-alignment` | Enforced | every active-root `*Contribution.java` under `src/view/**` | PMD `ViewContributionEntrypointRule` | `./gradlew pmdViewContributionEnforcement` and `./gradlew checkViewContributionEnforcement` | A contribution constructs exactly one allowed shell contribution spec family, and that family matches its active-root area: `ShellLeftBarTabSpec` for `leftbartabs`, `ShellStateTabSpec` for `statetabs`, and `ShellTopBarSpec` for `dropdowns`. |
| `view-contribution-leftbar-defaultlanding-scope` | Enforced | every active-root `*Contribution.java` under `src/view/**` that mentions `defaultLanding` | PMD `ViewContributionEntrypointRule` | `./gradlew pmdViewContributionEnforcement` and `./gradlew checkViewContributionEnforcement` | Contribution-local startup metadata uses `defaultLanding` only on left-bar contribution specs. Startup-target uniqueness and fallback policy stay bootstrap-owned. |
| `view-contribution-passive-registration-metadata-only` | Review-Owned | every active-root `*Contribution.java` under `src/view/**` | none | none | A mechanically legal contribution still stays a passive registration-metadata adapter: `registrationSpec()` carries registration metadata only, and the file does not grow hidden runtime composition, view assembly, domain interpretation, or workflow logic. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contribution-dependency-boundary` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `ViewContributionDependencyBoundary` and ArchUnit `contributionsMustNotReachDomainDataOrHost` | `./gradlew compileJava` and `./gradlew checkViewContributionEnforcement` | A contribution depends directly only on its co-located `*Binder` and on the documented shell registration vocabulary. It does not depend on `javafx/**`, `src/domain/**`, `src/data/**`, `bootstrap/**`, `shell.host/**`, foreign view units, or local non-Binder view-role families. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contribution-shell-public-contract-and-local-binder-only` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `ViewContributionDependencyBoundary`, Error Prone `ViewContributionShellApiAllowlist`, and ArchUnit `contributionsMustNotReachDomainDataOrHost` | `./gradlew compileJava` and `./gradlew checkViewContributionEnforcement` | A contribution communicates directly only with its co-located `*Binder` and the documented shell registration subset: `ShellContribution`, `ShellContributionSpec`, `ShellBinding`, `ShellRuntimeContext`, exactly one area-matching shell spec family, and registration-local metadata types such as `ContributionKey`, `NavigationGroupSpec`, `NavigationGraphicResource`, `ShellLeftBarTabMode`, `InspectorEntrySpec`, and `InspectorSink`. It does not communicate directly with backend boundaries, shell host internals, or foreign view-role surfaces. |
| `view-contribution-no-shell-service-lookup` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `ViewContributionShellApiAllowlist` | `./gradlew compileJava` and `./gradlew checkViewContributionEnforcement` | A contribution does not call `ShellRuntimeContext.services()`. Runtime service lookup stays out of the role. |
| `view-contribution-bind-delegates-runtime-binding` | Review-Owned | every active-root `*Contribution.java` under `src/view/**` | none | none | A mechanically legal `bind(...)` method still delegates runtime binding to the co-located `*Binder` rather than turning the contribution into a second composition root. `ShellRuntimeContext` stays limited to the role's registration handoff instead of becoming a hidden runtime-work surface through `inspector()`, `session(...)`, or other otherwise legal shell API calls. |

## Candidate

- proving that a contribution exposes no extra public or protected surface
  beyond its discovery constructor, `registrationSpec()`, and `bind(...)`
- proving direct Binder delegation structurally rather than inferring it from
  dependency cleanliness and review-owned role semantics

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell RuntimeContext Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-runtime-context-enforcement.md:1)
- [Bootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-enforcement.md:1)

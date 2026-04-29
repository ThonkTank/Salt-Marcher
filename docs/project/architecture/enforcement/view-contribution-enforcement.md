Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the active-root
`*Contribution` role itself in `src/view/**`.

# View Contribution Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
active-root `*Contribution` role itself.

It answers three questions for every active-root `*Contribution` surface:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own active-root topology, role-count rules,
`slotcontent/**` placement or absence rules, shell startup rules, or generic
shell registration placement outside the `*Contribution` role itself. Those
stay in the view-layer and shell-layer enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkViewContributionEnforcement --rerun-tasks --console=plain`
  runs the currently active Contribution-focused Error Prone, ArchUnit, and
  PMD checks through one root task. Canonical compile-side blocking behavior
  remains at `./gradlew compileJava`; aggregate blocking behavior enters
  `./gradlew checkArchitecture` and `./gradlew check` through this bundle.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contribution-discovery-entrypoint-shape` | Enforced | every active-root `*Contribution.java` under `src/view/leftbartabs/**`, `src/view/statetabs/**`, or `src/view/dropdowns/**` | PMD `ViewContributionEntrypointRule` | `./gradlew pmdViewContributionEnforcement` and `./gradlew checkViewContributionEnforcement` | A view contribution keeps the documented shell-discovery entrypoint shape: `*Contribution` naming, `public final` class shape, public no-arg discovery constructor, `ShellContribution` contract, `registrationSpec()`, and `bind(ShellRuntimeContext)`. |
| `view-contribution-shell-spec-family-alignment` | Enforced | every active-root `*Contribution.java` under `src/view/**` | PMD `ViewContributionEntrypointRule` | `./gradlew pmdViewContributionEnforcement` and `./gradlew checkViewContributionEnforcement` | A contribution constructs exactly one allowed shell contribution spec family, and that family matches its active-root area: `ShellLeftBarTabSpec` for `leftbartabs`, `ShellStateTabSpec` for `statetabs`, and `ShellTopBarSpec` for `dropdowns`. |
| `view-contribution-leftbar-defaultlanding-scope` | Enforced | every active-root `*Contribution.java` under `src/view/**` that mentions `defaultLanding` | PMD `ViewContributionEntrypointRule` | `./gradlew pmdViewContributionEnforcement` and `./gradlew checkViewContributionEnforcement` | `defaultLanding` appears only on left-bar contribution specs; non-left-bar contributions do not use that startup flag. |
| `view-contribution-passive-registration-metadata-only` | Review-Owned | every active-root `*Contribution.java` under `src/view/**` | none | none | A mechanically legal contribution still stays a passive registration-metadata adapter instead of turning `registrationSpec()` or `bind(...)` into a hidden runtime-composition or workflow surface. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contribution-no-javafx-dependencies` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `ViewContributionDependencyBoundary` | `./gradlew compileJava` | A contribution does not depend on JavaFX UI or assembly types. UI construction stays outside the role. |
| `view-contribution-no-domain-data-bootstrap-or-shellhost-dependencies` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `ViewContributionDependencyBoundary` and ArchUnit `contributionsMustNotReachDomainDataOrHost` | `./gradlew compileJava` and `./gradlew checkViewContributionEnforcement` | A contribution does not depend on `src/domain/**`, `src/data/**`, `bootstrap/**`, or `shell.host/**`. |
| `view-contribution-no-foreign-view-role-dependencies` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `ViewContributionDependencyBoundary` | `./gradlew compileJava` | A contribution does not depend on foreign view units or on local non-Binder view-role families. The only direct view-role dependency allowed to the role itself is its co-located `*Binder`. |
| `view-contribution-no-hidden-runtime-composition` | Review-Owned | every active-root `*Contribution.java` under `src/view/**` | none | none | A mechanically legal contribution still avoids hidden service lookup, view assembly, domain interpretation, or runtime orchestration parked inside otherwise legal entrypoint methods. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-contribution-shell-public-contract-and-local-binder-only` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `ViewContributionDependencyBoundary`, Error Prone `FeatureShellApiAllowlist`, and ArchUnit `contributionsMustNotReachDomainDataOrHost` | `./gradlew compileJava` and `./gradlew checkViewContributionEnforcement` | A contribution communicates directly only with its co-located `*Binder` and the documented shell public contract subset for contribution registration. It does not communicate directly with backend boundaries, shell host internals, or foreign view-role surfaces. |
| `view-contribution-no-shell-service-lookup` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `FeatureShellApiAllowlist` | `./gradlew compileJava` | A contribution does not call `ShellRuntimeContext.services()`. Runtime service lookup stays out of the role. |
| `view-contribution-no-shellbinding-lifecycle-invocation` | Enforced | every active-root `*Contribution.java` under `src/view/**` | Error Prone `ShellLifecycleHookOwnership` | `./gradlew compileJava` | A contribution does not invoke `ShellBinding.onActivate()` or `ShellBinding.onDeactivate()` directly. Shell lifecycle invocation stays shell-owned. |
| `view-contribution-bind-delegates-runtime-binding` | Review-Owned | every active-root `*Contribution.java` under `src/view/**` | none | none | A mechanically legal `bind(...)` method still delegates runtime binding to the co-located `*Binder` rather than turning the contribution into a second composition root. |

## Candidate

- proving contribution statelessness and construction purity directly rather
  than only proving entrypoint shape and dependency cleanliness

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)

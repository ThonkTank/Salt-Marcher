Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for the
`bootstrap/AppBootstrap.java` role itself, limited to invariants decidable
from that file.

# Bootstrap AppBootstrap Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`AppBootstrap` role itself.

It answers three questions for `bootstrap/AppBootstrap.java`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document keeps only `AppBootstrap`-local invariants that can be decided
by reading `bootstrap/AppBootstrap.java` itself.

This document does not own discovery-helper contracts, view `*Contribution`
entrypoint shape, data `*ServiceContribution` entrypoint shape, shell-host
privacy across the whole repository, bootstrap-layer-wide dependency policy,
or the layer-wide generic registration-path claim. Those stay in the
neighboring bootstrap-layer, shell-role, view-role, data-role, and layering
enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-appbootstrap-service-registry-build-before-shell` | Review-Owned | `AppBootstrap.createShell()` and `discoverServices()` | none | none | `AppBootstrap` discovers `ServiceContribution` roots, registers them into `ServiceRegistry.Builder`, and builds the shared `ServiceRegistry` before constructing `AppShell`. |
| `bootstrap-appbootstrap-ui-resolution-through-runtime-context` | Review-Owned | `AppBootstrap.createShell()` and `discoverContributions(ShellRuntimeContext)` | none | none | After shell construction, `AppBootstrap` discovers `ShellContribution` roots and resolves each one through `registrationSpec()` plus `bind(shell.runtimeContext())`. |
| `bootstrap-appbootstrap-contribution-key-sort-before-registration` | Review-Owned | every discovered UI contribution before host registration | none | none | `AppBootstrap` sorts resolved contributions by `registrationSpec().key().value()` before any host registration happens. |
| `bootstrap-appbootstrap-spec-kind-dispatch` | Review-Owned | `AppBootstrap.register(...)` | none | none | `AppBootstrap` dispatches registration only by the supported shell spec families `ShellLeftBarTabSpec`, `ShellTopBarSpec`, and `ShellStateTabSpec`, each to the matching `AppShell.register*` method. |
| `bootstrap-appbootstrap-unsupported-spec-kind-fails-fast` | Review-Owned | `AppBootstrap.register(...)` when a resolved spec is not one of the documented shell spec families | none | none | `AppBootstrap` treats an unsupported `ShellContributionSpec` family as a bootstrap error instead of silently ignoring it or inventing fallback wiring. |
| `bootstrap-appbootstrap-startup-target-leftbar-only` | Review-Owned | `AppBootstrap.resolveStartupView(...)` | none | none | `AppBootstrap` selects startup landing targets only from `ShellLeftBarTabSpec` contributions; state tabs and top-bar dropdown windows never become startup targets. |
| `bootstrap-appbootstrap-startup-defaultlanding-conflict-fails-fast` | Review-Owned | `AppBootstrap.resolveStartupView(...)` when more than one left-bar contribution declares `defaultLanding=true` | none | none | `AppBootstrap` fails fast when multiple left-bar contributions declare `defaultLanding=true`. |
| `bootstrap-appbootstrap-startup-fallback-from-sorted-leftbar-order` | Review-Owned | `AppBootstrap.resolveStartupView(...)` when no left-bar contribution declares `defaultLanding=true` | none | none | `AppBootstrap` falls back to the first left-bar contribution in the documented sorted startup order: navigation-group order, navigation-group label, view order, then key. |
| `bootstrap-appbootstrap-startup-navigation-after-registration` | Review-Owned | `AppBootstrap.createShell()` after contribution registration completes | none | none | `AppBootstrap` performs startup navigation only after contributions have been registered and only when a startup left-bar target exists. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-appbootstrap-no-feature-name-or-package-branches` | Review-Owned | every control-flow branch in `AppBootstrap` | none | none | `AppBootstrap` does not branch on feature names, feature packages, or feature-specific type identities. Startup and registration logic stays generic. |
| `bootstrap-appbootstrap-no-handwritten-feature-registries-or-wiring` | Review-Owned | every registration and discovery path in `AppBootstrap` | none | none | `AppBootstrap` does not carry manual per-feature registries, hardcoded feature imports, or handwritten feature-local shell wiring. |
| `bootstrap-appbootstrap-no-feature-specific-startup-special-cases` | Review-Owned | every startup-selection path in `AppBootstrap` | none | none | `AppBootstrap` does not encode feature-specific startup precedence, non-left-bar startup exceptions, or hidden startup fallbacks outside the documented rule set. |
| `bootstrap-appbootstrap-no-alternate-registration-protocols` | Review-Owned | every discovery, binding, and registration path in `AppBootstrap` | none | none | `AppBootstrap` does not introduce handwritten callbacks, feature-local factories, or other alternate registration protocols beyond the documented shell contribution and service-contribution seams. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-appbootstrap-shell-host-appshell-only` | Enforced Elsewhere | every direct dependency from `AppBootstrap` into `shell.host/**` | shell `shell-host-private-boundary` via ArchUnit `bootstrapMustOnlyUseAppShellFromShellHost` | `./gradlew checkArchitecture` | As an `AppBootstrap`-local seam subset, the role reaches `shell.host/**` only through `shell.host.AppShell`; no other shell-host internal type is part of its direct communication surface. |
| `bootstrap-appbootstrap-data-runtime-registration-seam-only` | Review-Owned | every direct runtime-composition seam from `AppBootstrap` into discovered data roots | none | none | `AppBootstrap` communicates with data feature exports only through `ServiceContribution` discovery and `ServiceRegistry.Builder` registration. It does not call feature-local repositories, gateways, queries, mappers, or application services directly. |
| `bootstrap-appbootstrap-view-runtime-registration-seam-only` | Review-Owned | every direct runtime-composition seam from `AppBootstrap` into discovered view roots | none | none | `AppBootstrap` communicates with discovered view roots only through `ShellContribution`, `ShellRuntimeContext`, `registrationSpec()`, `ShellBinding`, `ShellContributionSpec`, and the matching `AppShell.register*` surface. It does not invent a second view-registration or startup-control protocol. |

## Candidate

- proving contribution-key sorting, supported-spec dispatch, and startup
  fallback as dedicated blockers instead of keeping those `AppBootstrap`-local
  invariants review-owned

## References

- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Bootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-enforcement.md:1)
- [Shell AppShell Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)

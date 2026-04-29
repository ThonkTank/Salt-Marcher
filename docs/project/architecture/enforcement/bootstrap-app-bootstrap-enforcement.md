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

It answers four questions for `bootstrap/AppBootstrap.java`:

- when the role MAY contain a direct collaborator or surface
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document keeps only `AppBootstrap`-local invariants that can be decided
by reading `bootstrap/AppBootstrap.java` itself.

This document does not own discovery-helper contracts, view `*Contribution`
entrypoint shape, data `*ServiceContribution` entrypoint shape, shell-host
privacy across the whole repository, bootstrap-layer-wide dependency policy,
desktop-launch role APIs, or bootstrap-layer discovery root sets. Those stay
in the neighboring bootstrap-layer, shell-role, view-role, data-role, and
layering enforcement documents.

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-appbootstrap-generic-composition-collaborators-only` | Review-Owned | every direct dependency from `bootstrap/AppBootstrap.java` into neighboring bootstrap or shell composition types | none | none | `AppBootstrap` may directly contain only generic startup-composition collaborators and carriers needed for its role: `ShellViewDiscovery`, `ServiceContributionDiscovery`, a local resolved-contribution carrier, `shell.host.AppShell`, `shell.api.ServiceRegistry`, `shell.api.ServiceContribution`, `shell.api.ShellContribution`, `shell.api.ShellRuntimeContext`, `shell.api.ShellBinding`, `shell.api.ShellContributionSpec`, and the supported shell spec families. It does not absorb desktop-launch framing APIs, feature-local helper protocols, or alternate composition-role surfaces. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-appbootstrap-service-contribution-discovery` | Review-Owned | `AppBootstrap.discoverServices()` | none | none | `AppBootstrap` discovers exported `ServiceContribution` roots through its generic data-discovery collaborator instead of using handwritten feature registries. |
| `bootstrap-appbootstrap-service-registry-population-and-build` | Review-Owned | `AppBootstrap.discoverServices()` | none | none | `AppBootstrap` populates one shared `ServiceRegistry.Builder` from the discovered `ServiceContribution` roots and builds the resulting shared `ServiceRegistry`. |
| `bootstrap-appbootstrap-shell-construction-from-shared-registry` | Review-Owned | `AppBootstrap.createShell()` when startup composition begins | none | none | `AppBootstrap` constructs `AppShell` from the shared `ServiceRegistry` before any UI contribution registration or startup navigation happens. |
| `bootstrap-appbootstrap-shell-contribution-discovery-after-shell-construction` | Review-Owned | `AppBootstrap.createShell()` after `AppShell` construction | none | none | `AppBootstrap` discovers shell-facing `ShellContribution` roots only after shell construction, when the runtime context needed for binding exists. |
| `bootstrap-appbootstrap-shell-contribution-registration-protocol` | Review-Owned | `AppBootstrap.discoverContributions(ShellRuntimeContext)` for every discovered `ShellContribution` | none | none | `AppBootstrap` resolves each discovered shell contribution only through the documented registration protocol: `registrationSpec()` for metadata plus `bind(runtimeContext)` for the runtime `ShellBinding`. |
| `bootstrap-appbootstrap-contribution-key-sort-before-registration` | Review-Owned | every discovered UI contribution before host registration | none | none | `AppBootstrap` sorts resolved contributions by `registrationSpec().key().value()` before any host registration happens. That sort stays deterministic registration policy only; it does not become a user-visible navigation-order contract or hidden startup-priority rule. |
| `bootstrap-appbootstrap-spec-kind-dispatch` | Review-Owned | `AppBootstrap.register(...)` | none | none | `AppBootstrap` dispatches registration only by the supported shell spec families `ShellLeftBarTabSpec`, `ShellTopBarSpec`, and `ShellStateTabSpec`, each to the matching `AppShell.register*` method. |
| `bootstrap-appbootstrap-unsupported-spec-kind-fails-fast` | Review-Owned | `AppBootstrap.register(...)` when a resolved spec is not one of the documented shell spec families | none | none | `AppBootstrap` treats an unsupported `ShellContributionSpec` family as a bootstrap error instead of silently ignoring it or inventing fallback wiring. |
| `bootstrap-appbootstrap-startup-target-leftbar-only` | Review-Owned | `AppBootstrap.resolveStartupView(...)` | none | none | `AppBootstrap` selects startup landing targets only from `ShellLeftBarTabSpec` contributions; state tabs and top-bar dropdown windows never become startup targets. |
| `bootstrap-appbootstrap-startup-defaultlanding-conflict-fails-fast` | Review-Owned | `AppBootstrap.resolveStartupView(...)` when more than one left-bar contribution declares `defaultLanding=true` | none | none | `AppBootstrap` fails fast when multiple left-bar contributions declare `defaultLanding=true`. |
| `bootstrap-appbootstrap-startup-fallback-from-sorted-leftbar-order` | Review-Owned | `AppBootstrap.resolveStartupView(...)` when no left-bar contribution declares `defaultLanding=true` | none | none | `AppBootstrap` falls back to the first left-bar contribution in the documented sorted startup order: navigation-group order, navigation-group label, view order, then key. |
| `bootstrap-appbootstrap-startup-navigation-after-registration` | Review-Owned | `AppBootstrap.createShell()` after contribution registration completes | none | none | `AppBootstrap` performs startup navigation only after contributions have been registered and only when a startup left-bar target exists. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-appbootstrap-no-desktop-launch-framing-or-javafx-ownership` | Review-Owned | every direct dependency or control-flow path in `bootstrap/AppBootstrap.java` | none | none | `AppBootstrap` does not create stages or scenes, apply global startup resources, or coordinate preloader handoff. Desktop launch framing stays in neighboring bootstrap launch roles instead of being absorbed by the startup-composition root. |
| `bootstrap-appbootstrap-no-feature-name-or-package-branches` | Review-Owned | every control-flow branch in `AppBootstrap` | none | none | `AppBootstrap` does not branch on feature names, feature packages, or feature-specific type identities. Startup and registration logic stays generic. |
| `bootstrap-appbootstrap-no-handwritten-feature-registries-or-wiring` | Review-Owned | every registration and discovery path in `AppBootstrap` | none | none | `AppBootstrap` does not carry manual per-feature registries, hardcoded feature imports, or handwritten feature-local shell wiring. |
| `bootstrap-appbootstrap-no-feature-specific-startup-special-cases` | Review-Owned | every startup-selection path in `AppBootstrap` | none | none | `AppBootstrap` does not encode feature-specific startup precedence, non-left-bar startup exceptions, or hidden startup fallbacks outside the documented rule set. |
| `bootstrap-appbootstrap-no-alternate-registration-protocols` | Review-Owned | every discovery, binding, and registration path in `AppBootstrap` | none | none | `AppBootstrap` does not introduce handwritten callbacks, feature-local factories, or other alternate registration protocols beyond the documented shell contribution and service-contribution seams. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-appbootstrap-shell-host-appshell-composition-surface-only` | Enforced Elsewhere | every direct dependency from `AppBootstrap` into `shell.host/**` and every direct `AppShell` call site in `bootstrap/AppBootstrap.java` | shell `shell-host-private-boundary` via ArchUnit `bootstrapMustOnlyUseAppShellFromShellHost` | `./gradlew checkArchitecture` | `AppBootstrap` communicates with shell host only through the documented `AppShell` composition surface it actually needs: construction from `ServiceRegistry`, `runtimeContext()`, `registerLeftBarTab(...)`, `registerTopBar(...)`, `registerStateTab(...)`, and `navigateTo(...)`. It does not reach host panes, layout internals, or shell lifecycle hooks directly. |
| `bootstrap-appbootstrap-shell-public-registration-vocabulary-only` | Review-Owned | every direct dependency from `AppBootstrap` into `shell.api/**` | none | none | `AppBootstrap` communicates with shell public contracts only through the documented startup-composition and registration vocabulary for the role: `ServiceContribution`, `ServiceRegistry`, `ShellContribution`, `ShellRuntimeContext`, `ShellBinding`, `ShellContributionSpec`, and the supported shell spec families. |
| `bootstrap-appbootstrap-data-runtime-registration-seam-only` | Review-Owned | every direct runtime-composition seam from `AppBootstrap` into discovered data roots | none | none | `AppBootstrap` communicates with data feature exports only through `ServiceContribution` discovery and `ServiceRegistry.Builder` registration. It does not call feature-local repositories, gateways, queries, mappers, or application services directly. |
| `bootstrap-appbootstrap-view-runtime-registration-seam-only` | Review-Owned | every direct runtime-composition seam from `AppBootstrap` into discovered view roots | none | none | `AppBootstrap` communicates with discovered view roots only through `ShellContribution`, `ShellRuntimeContext`, `registrationSpec()`, `ShellBinding`, `ShellContributionSpec`, and the matching `AppShell.register*` surface. It does not invent a second view-registration or startup-control protocol. |
| `bootstrap-appbootstrap-no-direct-domain-communication` | Review-Owned | every direct dependency from `AppBootstrap` below `src/domain/**` | none | none | `AppBootstrap` does not communicate directly with domain-layer implementation code. Domain work stays behind the registered runtime-service seam and later service lookup owned outside `AppBootstrap`. |

## Candidate

- proving the documented `AppShell` composition surface directly instead of
  inferring the allowed host calls from broader shell-host privacy
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

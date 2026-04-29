Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the shell layer itself:
shell-owned passive cockpit hosting, shell-scoped runtime services, shell
public boundary, private host boundary, and shell-owned lifecycle seams.

# Shell Layer Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
shell layer itself.

It answers three questions for `shell/**`:

- what the layer MUST contain
- what the layer MUST NOT contain
- which direct communication boundaries the layer itself MAY expose or cross

This document does not own bootstrap discovery order, startup landing policy,
view `*Contribution` or `*Binder` role shape, data `*ServiceContribution`
placement, or generic cross-layer topology outside shell-specific boundaries.
Those stay in the bootstrap, view-role, data-layer, and layering enforcement
documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-api-host-topology` | Enforced | every active Java source under `shell/**` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Shell Java sources live only under `shell/api` or `shell/host`, preserving the documented split between public shell contract and private shell host implementation. |
| `shell-api-fixed-public-surface` | Enforced | the public shell boundary under `shell/api/**` | build-harness `ShellSurfaceRules` | `./gradlew checkArchitecture` | The fixed `shell/api` contract remains present and does not silently grow new public extension points. |
| `shell-passive-cockpit-hosting-surface` | Review-Owned | `shell/host/AppShell.java` and its supporting host types | none | none | The shell layer owns passive cockpit hosting responsibilities: navigation, top-bar hosting, empty controls/main hosting, details/history hosting, global state-tab hosting, state-pane precedence, activation, deactivation, and layout persistence. |
| `shell-runtime-gateway-surface` | Review-Owned | the shell-scoped runtime gateway exposed to feature active roots | none | none | `ShellRuntimeContext` remains the shell-scoped runtime gateway for inspector publication, root application-service lookup, and typed shell-scoped sessions instead of growing into a second feature behavior layer. |
| `shell-fixed-cockpit-slot-vocabulary` | Review-Owned | shell-owned cockpit slot contracts | none | none | The shell layer keeps the documented fixed cockpit slot vocabulary and ownership model: `TOP_BAR`, `COCKPIT_CONTROLS`, `COCKPIT_MAIN`, `COCKPIT_DETAILS`, and `COCKPIT_STATE`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-no-feature-or-bootstrap-dependencies` | Enforced | every active Java source under `shell/**` | ArchUnit `shellMustNotReachFeatureInteractorsDomainOrData`, `shellMustStayIndependentFromBootstrap`, and `shellApiMustStayIndependentFromHostAndFeatureLayers` | `./gradlew checkArchitecture` | Shell code does not depend on `src/view/**`, `src/domain/**`, `src/data/**`, or `bootstrap/**`. The shell stays outside feature implementation and outside bootstrap internals. |
| `shell-no-public-surface-outside-shell-api` | Enforced | every public shell-facing Java source | build-harness `SourceLayoutRules` and `ShellSurfaceRules` | `./gradlew checkArchitecture` | Public shell contracts do not escape into arbitrary shell packages; shell-facing extension points stay confined to the fixed `shell/api/**` surface. |
| `shell-no-feature-logic-or-presentation-mutation` | Review-Owned | every shell host and shell API type | none | none | The shell layer does not own feature logic, business behavior, or presentation-state mutation. It stays a passive cockpit host and shell-scoped runtime surface. |
| `shell-no-long-lived-feature-state-in-host` | Review-Owned | `shell/host/**` | none | none | Shell host classes do not become a storage home for long-lived feature state. Feature-authored state stays in its owning view or domain surfaces. |
| `shell-no-feature-specific-runtime-wiring-shortcuts` | Review-Owned | shell-owned runtime gateway and host surfaces | none | none | The shell layer does not introduce feature-specific alternate runtime wiring around `ShellRuntimeContext` or other shell-owned seams. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-host-private-boundary` | Enforced | every direct dependency from non-shell code into `shell.host/**` | ArchUnit `nonBootstrapCodeMustNotReachShellHostInternals` and `bootstrapMustOnlyUseAppShellFromShellHost` | `./gradlew checkArchitecture` | `shell.host/**` stays private to the shell layer. External code does not depend on shell host internals, and bootstrap uses only the documented `AppShell` composition point. |
| `shell-api-independence-boundary` | Enforced | every direct dependency from `shell.api/**` outward | ArchUnit `shellApiMustStayIndependentFromHostAndFeatureLayers` | `./gradlew checkArchitecture` | The public shell contract stays dependency-clean: `shell.api/**` does not depend on `shell.host/**`, bootstrap, or feature layers. |
| `shell-lifecycle-hook-ownership` | Enforced | every invocation of `ShellBinding.onActivate()` or `ShellBinding.onDeactivate()` | Error Prone `ShellLifecycleHookOwnership` | `./gradlew compileJava` | Shell binding lifecycle hooks are invoked only by `shell.host.AppShell`; feature and bootstrap code do not take over shell-owned activation control. |
| `shell-runtime-gateway-no-host-bypass` | Enforced | every direct feature-side dependency into shell runtime surfaces | Error Prone `FeatureShellApiAllowlist` and ArchUnit `nonBootstrapCodeMustNotReachShellHostInternals` | `./gradlew compileJava` and `./gradlew checkArchitecture` | Feature code reaches the shell only through the documented shell API subset and does not bypass the shell runtime gateway by importing `AppShell` or concrete shell host panes. |
| `shell-service-registry-shell-owned-runtime-seam` | Enforced Elsewhere | every runtime service registration or lookup crossing the shell boundary | Error Prone `ServiceRegistryRegistrationPlacement` and `FeatureShellApiAllowlist` | `./gradlew compileJava` | The `ServiceRegistry` seam remains shell-owned runtime vocabulary, while placement and consumer-subset rules stay owned by the data-layer and view-role enforcement documents rather than by this shell-layer catalog. |

## Candidate

- proving the exact fixed `ShellSlot` member set and slot-ownership matrix
  directly rather than inferring the contract from the current public shell
  API surface and consumer references
- proving that the public `shell/api` surface is minimal rather than merely
  fixed and dependency-clean

## Review-Owned

- whether a new shell API contract is genuinely generic passive cockpit
  hosting vocabulary rather than a feature-specific shortcut
- whether `AppShell` host behavior still stays at shell-hosting semantics
  rather than gradually absorbing feature workflow or stateful policy
- whether `ShellRuntimeContext.session(...)` remains a shell-scoped runtime
  seam instead of becoming a second hidden feature-state channel

## References

- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)

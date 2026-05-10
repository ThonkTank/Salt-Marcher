Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-01
Source of Truth: Complete invariant catalog for the shell layer itself:
shell-wide topology, public shell-boundary families, fixed cockpit slot
vocabulary, and shell-wide dependency and communication cleanliness.

# Shell Layer Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the shell
layer itself.

It answers three questions for `shell/**`:

- what the layer MUST contain
- what the layer MUST NOT contain
- which direct communication boundaries the layer itself MAY expose or cross

This document does not own bootstrap discovery order, startup landing policy,
`AppShell` host semantics, `ShellRuntimeContext` runtime-gateway semantics,
view `*Contribution` or `*Binder` role shape, data `*ServiceContribution`
placement or runtime-composition contract, or generic cross-layer topology
outside shell-specific boundaries. Those stay in the bootstrap, focused
shell-role, view-role, data-layer, data-service-contribution, and layering
enforcement documents. This file catalogs only the invariants that belong to
the shell layer as a layer and names where proof currently lives.

Unified focused bundle entrypoint:

- `./gradlew checkShellEnforcement --rerun-tasks --console=plain`
  runs the dedicated shell-layer ArchUnit and build-harness topology proof
  route through one root task. Canonical aggregate blocking behavior remains
  at `./gradlew checkArchitecture` and `./gradlew check`.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-api-host-topology` | Enforced | every active Java source under `shell/**` | shell-layer bundle build-harness `ShellLayerTopologyRules` | `./gradlew checkShellEnforcement` and `./gradlew checkArchitecture` | Shell Java sources live only under `shell/api` or `shell/host`, preserving the documented split between public shell contract and private shell host implementation. |
| `shell-api-fixed-public-surface` | Enforced | the public shell boundary under `shell/api/**` | shell-layer bundle build-harness `ShellLayerTopologyRules` | `./gradlew checkShellEnforcement` and `./gradlew checkArchitecture` | The fixed `shell/api` contract remains present and does not silently grow new public extension points. |
| `shell-layer-public-boundary-family-set` | Enforced Elsewhere | every public shell boundary family under `shell/api/**` | shell-layer bundle build-harness `ShellLayerTopologyRules`; view `view-contribution-shell-public-contract-and-local-binder-only` and `view-binder-shell-public-contract-communication-only`; data `data-service-contribution-shell-runtime-seam-subset` | `./gradlew checkShellEnforcement`, `./gradlew checkArchitecture`, `./gradlew compileJava`, and neighboring focused role tasks | The shell layer exposes its documented public boundary families only through `shell/api/**`: contribution registration contracts, shell slot and inspector vocabulary, lifecycle binding vocabulary, and shell-owned runtime composition vocabulary such as `ShellRuntimeContext`, `ServiceContribution`, and `ServiceRegistry`. |
| `shell-fixed-cockpit-slot-vocabulary` | Review-Owned | shell-owned cockpit slot contracts | none | none | The shell layer keeps the documented fixed cockpit slot vocabulary and ownership model: `TOP_BAR`, `COCKPIT_CONTROLS`, `COCKPIT_MAIN`, `COCKPIT_DETAILS`, and `COCKPIT_STATE`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-no-feature-or-bootstrap-dependencies` | Enforced | every active Java source under `shell/**` | ArchUnit `ShellLayerArchitectureTest` (`shellMustNotReachFeatureInteractorsDomainOrData`, `shellMustStayIndependentFromBootstrap`, and `shellApiMustStayIndependentFromHostAndFeatureLayers`) | `./gradlew checkShellEnforcement` and `./gradlew checkArchitecture` | Shell code does not depend on `src/view/**`, `src/domain/**`, `src/data/**`, or `bootstrap/**`. The shell stays outside feature implementation and outside bootstrap internals. |
| `shell-no-public-surface-outside-shell-api` | Enforced | every public shell-facing Java source | shell-layer bundle build-harness `ShellLayerTopologyRules` | `./gradlew checkShellEnforcement` and `./gradlew checkArchitecture` | Public shell contracts do not escape into arbitrary shell packages; shell-facing extension points stay confined to the fixed `shell/api/**` surface. |
| `shell-no-feature-specific-runtime-wiring-shortcuts` | Review-Owned | every shell-owned runtime-composition or runtime-gateway surface | none | none | The shell layer does not introduce feature-specific alternate runtime wiring around `ShellRuntimeContext` or other shell-owned runtime seams. |
| `shell-no-feature-logic-or-presentation-mutation` | Review-Owned | every shell host and shell API type | none | none | The shell layer does not own feature logic, business behavior, or presentation-state mutation. It stays a passive cockpit host and shell-scoped runtime surface. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-api-independence-boundary` | Enforced | every direct dependency from `shell.api/**` outward | ArchUnit `ShellLayerArchitectureTest` (`shellApiMustStayIndependentFromHostAndFeatureLayers`) | `./gradlew checkShellEnforcement` and `./gradlew checkArchitecture` | The public shell contract stays dependency-clean: `shell.api/**` does not depend on `shell.host/**`, bootstrap, or feature layers. |
| `shell-host-private-boundary` | Enforced | every direct dependency from non-shell code into `shell.host/**` | ArchUnit `ShellLayerArchitectureTest` (`nonBootstrapCodeMustNotReachShellHostInternals`) plus bootstrap-app-bootstrap bundle ArchUnit `AppBootstrapArchitectureTest` (`bootstrapMustOnlyUseAppShellFromShellHost`) | `./gradlew checkShellEnforcement`, `./gradlew checkBootstrapEnforcement`, and `./gradlew checkArchitecture` | `shell.host/**` stays private to the shell layer. External code does not depend on shell host internals, and bootstrap uses only the documented `AppShell` composition point. |
| `shell-layer-public-entry-only-through-shell-api` | Enforced Elsewhere | every direct dependency from bootstrap, view, or data code into `shell/**` | shell `shell-host-private-boundary`; bootstrap-app-bootstrap `bootstrap-appbootstrap-shell-host-appshell-composition-surface-only`; view `view-contribution-shell-public-contract-and-local-binder-only` and `view-binder-shell-public-contract-communication-only`; data `data-service-contribution-shell-runtime-seam-subset` | `./gradlew checkShellEnforcement`, `./gradlew checkBootstrapEnforcement`, `./gradlew checkArchitecture`, `./gradlew compileJava`, and neighboring focused role tasks | Non-shell code reaches the shell layer only through documented `shell/api/**` contracts. View and data code do not bypass that boundary through `shell.host/**`, and the bootstrap host-composition exception is limited to the documented `AppShell` composition point. |
| `shell-layer-role-specific-shell-api-consumer-subsets` | Review-Owned | every direct consumer-specific dependency into `shell/api/**` | none | none | Each neighboring layer uses only the documented shell API subset for its own role: bootstrap for startup composition and registration, view `*Contribution` roots for registration metadata, view `*Binder` roots for runtime composition, and data `*ServiceContribution` roots for runtime service registration. The shell layer does not become a shared miscellaneous utility API for arbitrary feature code. |

## Candidate

- proving the exact fixed `ShellSlot` member set and slot-ownership matrix
  directly rather than inferring the contract from the current public shell
  API surface and consumer references
- proving that the public `shell/api` surface is minimal rather than merely
  fixed and dependency-clean

## Review-Owned

- whether a new shell API contract is genuinely generic passive cockpit
  hosting vocabulary rather than a feature-specific shortcut

## References

- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Shell AppShell Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [Shell RuntimeContext Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-runtime-context-enforcement.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)

Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the
`shell.api.ShellRuntimeContext` role itself: fixed shell-scoped runtime
gateway methods and the direct shell-runtime communication seams those methods
expose.

# Shell RuntimeContext Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`ShellRuntimeContext` role itself.

It answers three questions for the shell-scoped runtime gateway exposed to UI
contributions and their Binders:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY expose or cross

This document keeps only `ShellRuntimeContext`-local invariants that can be
decided from `shell/api/ShellRuntimeContext.java` and its direct runtime seams.

This document does not own generic shell package topology, shell host
privacy, feature-side consumer subsets, data-side `*ServiceContribution`
placement and registration shape, or shell-layer bans on alternate runtime
wiring around this role. Those stay in the shell-layer, AppShell, data-layer,
view-role, and layering enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-runtime-context-inspector-method-present` | Enforced | `shell/api/ShellRuntimeContext.java` | PMD `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | `ShellRuntimeContext` exposes `inspector()` as one of its fixed public runtime-gateway methods. |
| `shell-runtime-context-services-method-present` | Enforced | `shell/api/ShellRuntimeContext.java` | PMD `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | `ShellRuntimeContext` exposes `services()` as one of its fixed public runtime-gateway methods. |
| `shell-runtime-context-session-method-present` | Enforced | `shell/api/ShellRuntimeContext.java` | PMD `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | `ShellRuntimeContext` exposes `session(...)` as one of its fixed public runtime-gateway methods. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-runtime-context-no-extra-public-gateway-methods` | Enforced | `shell/api/ShellRuntimeContext.java` | PMD `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | `ShellRuntimeContext` does not expose public runtime-gateway methods beyond the fixed set `inspector`, `services`, and `session`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-runtime-context-inspector-details-publication-seam` | Review-Owned | every `ShellRuntimeContext.inspector()` seam | none | none | `inspector()` exposes only the shell-owned details/history publication seam through `InspectorSink`; it does not become a direct shell-host or slot-manipulation API. |
| `shell-runtime-context-services-root-appservice-lookup-seam` | Review-Owned | every `ShellRuntimeContext.services()` seam | none | none | `services()` exposes only shell-scoped runtime lookup through `ServiceRegistry`; it does not become a second public backend boundary family or a generic feature-service bag. |
| `shell-runtime-context-session-shell-scoped-runtime-session-seam` | Review-Owned | every `ShellRuntimeContext.session(...)` seam | none | none | `session(...)` exposes only typed shell-scoped runtime sessions; it does not become a hidden long-lived feature-state or workflow channel. |

## References

- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell AppShell Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)

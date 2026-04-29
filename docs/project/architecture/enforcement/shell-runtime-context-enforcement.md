Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the
`shell.api.ShellRuntimeContext` role itself: shell-scoped runtime gateway,
host-bypass ban, and shell-owned runtime seam classification.

# Shell RuntimeContext Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`ShellRuntimeContext` role itself.

It answers three questions for the shell-scoped runtime gateway exposed to UI
contributions and their Binders:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY expose or cross

This document does not own fixed `shell/api` surface membership, generic
shell package topology, shell host privacy, or data-side
`*ServiceContribution` placement and registration shape. Those stay in the
shell-layer, AppShell, data-layer, and layering enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-runtime-gateway-surface` | Review-Owned | the shell-scoped runtime gateway exposed to feature active roots | none | none | `ShellRuntimeContext` remains the shell-scoped runtime gateway for inspector publication, root application-service lookup, and typed shell-scoped sessions instead of growing into a second feature behavior layer. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-no-feature-specific-runtime-wiring-shortcuts` | Review-Owned | shell-owned runtime gateway surfaces | none | none | The shell layer does not introduce feature-specific alternate runtime wiring around `ShellRuntimeContext` or other shell-owned runtime seams. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-runtime-gateway-no-host-bypass` | Enforced | every direct feature-side dependency into shell runtime surfaces | Error Prone `FeatureShellApiAllowlist` and ArchUnit `nonBootstrapCodeMustNotReachShellHostInternals` | `./gradlew compileJava` and `./gradlew checkArchitecture` | Feature code reaches the shell only through the documented shell API subset and does not bypass the shell runtime gateway by importing `AppShell` or concrete shell host panes. |
| `shell-service-registry-shell-owned-runtime-seam` | Enforced Elsewhere | every runtime service registration or lookup crossing the shell boundary | Error Prone `ServiceRegistryRegistrationPlacement` and `FeatureShellApiAllowlist` | `./gradlew compileJava` | The `ServiceRegistry` seam remains shell-owned runtime vocabulary, while placement and consumer-subset rules stay owned by the data-layer and view-role enforcement documents rather than by this ShellRuntimeContext catalog. |

## Candidate

- proving the exact `ShellRuntimeContext` member set directly rather than
  inferring the runtime-gateway surface from current allowlists and consumer
  references

## Review-Owned

- whether `ShellRuntimeContext.session(...)` remains a shell-scoped runtime
  seam instead of becoming a second hidden feature-state channel

## References

- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell AppShell Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)

Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the `AppShell` host role
itself: passive cockpit hosting, host-private boundary, and shell-owned
lifecycle control.

# Shell AppShell Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`AppShell` role itself.

It answers three questions for `shell/host/AppShell.java` and its supporting
host surfaces:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY expose or cross

This document does not own shell-wide package topology, fixed `shell/api`
surface membership, fixed shell slot vocabulary, or the
`ShellRuntimeContext` runtime-gateway seam. Those stay in the shell-layer and
ShellRuntimeContext enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-passive-cockpit-hosting-surface` | Review-Owned | `shell/host/AppShell.java` and its supporting host types | none | none | `AppShell` owns passive cockpit hosting responsibilities: navigation, top-bar hosting, empty controls/main hosting, details/history hosting, global state-tab hosting, state-pane precedence, activation, deactivation, and layout persistence. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-no-long-lived-feature-state-in-host` | Review-Owned | `shell/host/**` | none | none | Shell host classes do not become a storage home for long-lived feature state. Feature-authored state stays in its owning view or domain surfaces. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-host-private-boundary` | Enforced | every direct dependency from non-shell code into `shell.host/**` | ArchUnit `nonBootstrapCodeMustNotReachShellHostInternals` and `bootstrapMustOnlyUseAppShellFromShellHost` | `./gradlew checkArchitecture` | `shell.host/**` stays private to the shell layer. External code does not depend on shell host internals, and bootstrap uses only the documented `AppShell` composition point. |
| `shell-lifecycle-hook-ownership` | Enforced | every invocation of `ShellBinding.onActivate()` or `ShellBinding.onDeactivate()` | Error Prone `ShellLifecycleHookOwnership` | `./gradlew compileJava` | Shell binding lifecycle hooks are invoked only by `shell.host.AppShell`; feature and bootstrap code do not take over shell-owned activation control. |

## Candidate

- proving the host-owned activation, deactivation, and state-pane precedence
  flow directly rather than inferring it from `AppShell` centrality and the
  current private-host boundary

## Review-Owned

- whether `AppShell` host behavior still stays at shell-hosting semantics
  rather than gradually absorbing feature workflow or stateful policy

## References

- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell RuntimeContext Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-runtime-context-enforcement.md:1)

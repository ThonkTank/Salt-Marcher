Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Complete invariant catalog for the `AppShell` host role
itself: passive cockpit hosting, host-owned activation control, layout
persistence, and the role-local registration and runtime seams that support
that host work.

# Shell AppShell Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`AppShell` role itself.

It answers three questions for `shell/host/AppShell.java` and its supporting
host surfaces:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY expose or cross

This document keeps only `AppShell`-local invariants that can be decided from
`shell/host/AppShell.java` and its direct host seams.

This document does not own shell-wide package topology, fixed `shell/api`
surface membership, fixed shell slot vocabulary, shell-host privacy across
the whole layer, or the `ShellRuntimeContext` runtime-gateway role. Those stay
in the shell-layer and ShellRuntimeContext enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkShellAppShellEnforcement --rerun-tasks --console=plain`
  runs the currently active `AppShell`-focused Error Prone check through one
  root task. Canonical blocking behavior remains at `./gradlew compileJava`
  and `./gradlew build` as listed below.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-appshell-leftbar-navigation-and-activation-hosting` | Review-Owned | `shell/host/AppShell.java` left-bar registration and navigation flow | none | none | `AppShell` owns left-bar navigation and contribution activation for registered left-bar tabs. |
| `shell-appshell-topbar-dropdown-hosting` | Review-Owned | `shell/host/AppShell.java` top-bar registration flow | none | none | `AppShell` owns top-bar dropdown-window hosting for registered top-bar contributions. |
| `shell-appshell-empty-controls-and-main-hosting` | Review-Owned | `shell/host/AppShell.java` workspace show flow | none | none | `AppShell` owns the empty cockpit controls and main-panel hosting surface rather than delegating that shell framing to feature code. |
| `shell-appshell-details-history-hosting` | Review-Owned | `shell/host/AppShell.java` workspace and runtime-context composition flow | none | none | `AppShell` owns shell details/history hosting through its composed workspace and inspector surfaces. |
| `shell-appshell-global-statetab-hosting` | Review-Owned | `shell/host/AppShell.java` state-tab registration flow | none | none | `AppShell` owns global state-tab hosting for registered shell state tabs. |
| `shell-appshell-state-pane-precedence` | Review-Owned | `shell/host/AppShell.java` active-tab show and state-tab registration flow | none | none | `AppShell` owns state-pane precedence between the active-tab state surface and the global state-tab surface. |
| `shell-appshell-activation-and-deactivation-control` | Review-Owned | `shell/host/AppShell.java` navigation flow | none | none | `AppShell` owns tab activation and deactivation control when the active left-bar target changes. |
| `shell-appshell-layout-persistence` | Review-Owned | `shell/host/AppShell.java` active-tab transition flow | none | none | `AppShell` owns layout persistence by saving and restoring workspace divider positions across tab switches. |

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-appshell-host-supporting-surface-only` | Review-Owned | every direct dependency from `shell/host/AppShell.java` into neighboring `shell.host/**` support types | none | none | `AppShell` may directly communicate only with shell-owned host support surfaces needed for sidebar, toolbar, workspace, slot validation, and registered-tab bookkeeping. It does not use host-private support types as feature-specific extension seams. |
| `shell-appshell-shell-api-hosting-contract-only` | Review-Owned | every direct dependency from `shell/host/AppShell.java` into `shell.api/**` | none | none | `AppShell` may directly use only the public shell contracts needed for contribution registration, runtime-context composition, lifecycle-driven tab hosting, and contribution identity: `ContributionKey`, `ShellBinding`, `ShellRuntimeContext`, `ServiceRegistry`, `ShellLeftBarTabSpec`, `ShellTopBarSpec`, and `ShellStateTabSpec`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-appshell-no-long-lived-feature-state-storage` | Review-Owned | `shell/host/AppShell.java` and its host-owned retained state | none | none | `AppShell` does not become a storage home for long-lived feature-authored state. Feature state stays in its owning view or domain surfaces. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `shell-appshell-registration-surface-only` | Review-Owned | every registration seam from bootstrap into `AppShell` | none | none | `AppShell` communicates with bootstrap and bound shell roots only through the area-specific host registration surface: `registerLeftBarTab(...)`, `registerTopBar(...)`, and `registerStateTab(...)` with the matching `Shell*Spec` plus `ShellBinding` contract. It does not invent feature-specific registration protocols. |
| `shell-appshell-runtime-context-exposure-only` | Review-Owned | every outward runtime seam from `AppShell` | none | none | `AppShell` exposes shell-scoped runtime access outward only as `runtimeContext()` returning `ShellRuntimeContext`. It does not expose concrete host panes or other host internals as public runtime APIs. |
| `shell-lifecycle-hook-ownership` | Enforced | every invocation of `ShellBinding.onActivate()` or `ShellBinding.onDeactivate()` | Error Prone `ShellLifecycleHookOwnership` | `./gradlew checkShellAppShellEnforcement` and `./gradlew compileJava` | Shell binding lifecycle hooks are invoked only by `shell.host.AppShell`; feature and bootstrap code do not take over shell-owned activation control. |

## References

- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell RuntimeContext Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-runtime-context-enforcement.md:1)

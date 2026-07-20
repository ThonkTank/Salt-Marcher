Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Shell host responsibilities and stable public shell contracts.

# Shell Layer Standard

## Goal

SaltMarcher uses a passive cockpit shell. The shell owns hosting, navigation,
view activation, details/history, state-pane arbitration, and shell-scoped UI
capabilities. Application startup and shutdown remain in `app`. The shell does
not own feature logic, business behavior, or feature state mutation.

## Shell Responsibilities

- host left-bar, top-bar, main, details/history, and state-pane surfaces
- activate and deactivate explicitly supplied bindings
- expose public shell contracts under `shell/api/**`
- provide shell-owned inspector, navigation, and session capabilities through
  narrow shell contracts
- keep concrete shell host internals private from feature code

## Boundaries

Features communicate with the shell only through `shell.api` contracts. The
shell MUST NOT import concrete feature implementations, locate feature
services, or store long-lived feature state. Concrete shell internals MAY use
feature-neutral platform mechanisms such as UI dispatch and local diagnostics;
public `shell.api` contracts MUST NOT expose platform implementation types.
Those concrete dependencies target only `platform.ui` and
`platform.diagnostics`.

## Verification

JUnit behavior tests and ArchUnit dependency checks cover the retained public
shell outcomes.

## References

- [Source Architecture](../source-architecture.md)
- [Feature Boundary Standard](feature-boundaries.md)
- [Application Composition Standard](application-composition.md)

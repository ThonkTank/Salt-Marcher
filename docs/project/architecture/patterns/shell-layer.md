Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Shell host responsibilities and stable public shell contracts.

# Shell Layer Standard

## Goal

SaltMarcher uses a passive cockpit shell. The shell owns hosting, navigation,
lifecycle, details/history, state-pane arbitration, and shell-scoped runtime
services. It does not own feature logic, business behavior, or presentation
state mutation.

## Shell Responsibilities

- host left-bar, top-bar, main, details/history, and state-pane surfaces
- activate and deactivate registered bindings
- expose public shell contracts under `shell/api/**`
- provide shell-owned services through `ShellRuntimeContext`
- keep concrete shell host internals private from feature code

## Boundaries

Feature and legacy view code communicate with the shell only through public
shell contracts. The shell must not import concrete feature implementations or
store long-lived feature state.

## Verification

The retained proof routes are the public production handoff, behavior
harnesses, and layer-dependency outcome checks. The retired role-family
enforcement inventory is no longer authoritative.

## References

- [Architecture Overview](../overview.md)
- [Layering Architecture Standard](layering-architecture.md)
- [Bootstrap Standard](bootstrap.md)

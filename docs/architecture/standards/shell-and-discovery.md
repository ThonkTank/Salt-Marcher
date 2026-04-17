Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Shell contribution model, discovery contracts, slot rules, and
dependency boundaries between bootstrap, shell, view, domain, and data.

# Shell And Discovery Standard

## Goal

The shell stays passive. Features register themselves through open contracts,
and bootstrap discovers them generically.

## Dependency Rule

Dependencies point inward:

- presentation reaches backend content through interactors and feature APIs
- domain defines business rules and repository contracts
- data implements domain-owned contracts

Forbidden directions:

- view directly to data
- shell to feature logic
- bootstrap to feature-specific classes as routine wiring
- domain to shell, JavaFX, or infrastructure frameworks

## Shell Contribution Model

Feature UI enters the shell through `ShellViewContribution`.

Each contribution provides:

- `registrationSpec()`
- `createScreen(runtimeContext)`

Allowed contribution types:

- `ShellTabSpec`
- `ShellTopBarSpec`
- `ShellRuntimeStateSpec`

## Slot Rules

`ShellScreen.slotContent()` may target only:

- `TOP_BAR`
- `COCKPIT_CONTROLS`
- `COCKPIT_MAIN`
- `COCKPIT_DETAILS`
- `COCKPIT_STATE`

Contribution-specific rules:

- `ShellTabSpec` requires `COCKPIT_MAIN`
- `ShellTabSpec` may provide `COCKPIT_CONTROLS`
- `ShellTabSpec` with `ShellTabMode.RUNTIME` must not provide `COCKPIT_STATE`
- `ShellTabSpec` with `ShellTabMode.EDITOR` may provide `COCKPIT_STATE`
- `ShellTopBarSpec` may provide only `TOP_BAR`
- `ShellRuntimeStateSpec` may provide only `COCKPIT_STATE`

Inspector content is dynamic and must flow through
`ShellRuntimeContext.inspector()`, not through slot content.

## Discovery Contracts

Bootstrap discovers features and persistence contributions generically.

### Feature Discovery

- scans `src/view/<component>/` root classes
- expects one root contribution class per component
- expects a public no-arg constructor
- registers the contribution by its spec type

### Persistence Discovery

- scans `src/data/<feature>/` root classes
- expects one persistence contribution per exporting feature
- registers exported capabilities into the shared `PersistenceRegistry`

## Runtime Access Rules

- Features read persistence through `ShellRuntimeContext.persistence()`
- Features publish inspector entries through `ShellRuntimeContext.inspector()`
- Features must not talk to `AppShell` or concrete shell panels as alternate
  wiring paths

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [ADR 002: Passive Shell And Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)

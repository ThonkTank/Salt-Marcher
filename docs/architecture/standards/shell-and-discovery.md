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

Feature contributions may target only:

- `TOP_BAR`
- `COCKPIT_CONTROLS`
- `COCKPIT_MAIN`
- `COCKPIT_STATE`

Contribution-specific rules:

- `ShellTabSpec` requires `COCKPIT_MAIN`
- `ShellTabSpec` may provide `COCKPIT_CONTROLS`
- `ShellTabSpec` must not provide `TOP_BAR` or `COCKPIT_DETAILS`
- `ShellTabSpec` with `ShellTabMode.RUNTIME` must not provide `COCKPIT_STATE`
- `ShellTabSpec` with `ShellTabMode.EDITOR` may provide `COCKPIT_STATE`
- `ShellTopBarSpec` must provide only `TOP_BAR`
- `ShellRuntimeStateSpec` must provide only `COCKPIT_STATE`

Inspector content is dynamic and must flow through
`ShellRuntimeContext.inspector()`. `COCKPIT_DETAILS` remains shell-owned and
must not be filled through feature `slotContent()`.

The shell owns cockpit resize behavior.

- slot roots are treated as content, not as layout authorities
- the shell may wrap or normalize slot roots so `COCKPIT_MAIN` absorbs
  remaining space while controls, state, and details keep shell-owned bounds
- features must not rely on custom root min/max sizing to influence cockpit
  resizing behavior

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

## Verification Notes

- `architectureTest` enforces dependency direction and cross-feature API-only
  access between `view`, `domain`, and `data`.
- `pmdArchitectureMain` enforces entrypoint contracts, contribution spec
  selection, slot-matrix rules, and bans on legacy shell wiring types.
- Positive runtime-access preferences for `ShellRuntimeContext.persistence()`
  and `ShellRuntimeContext.inspector()` remain review-owned until a dedicated
  check models them directly.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [ADR 002: Passive Shell And Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)

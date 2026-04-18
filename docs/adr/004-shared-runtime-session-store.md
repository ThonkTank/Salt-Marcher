# ADR 004: Shared Runtime Session Store

- Status: Accepted
- Date: 2026-04-17

## Context

Some runtime workflows need one shared live session across multiple passive
shell contributions. The main runtime tab and the independent runtime-state
tab must read and mutate the same transient state without introducing
feature-specific shell wiring or global static singletons.

## Decision

SaltMarcher adds a typed per-shell runtime-session store on
`ShellRuntimeContext`.

- contributions request a shared session by type
- the first request creates the session lazily
- later requests reuse the same instance for the lifetime of that shell
- the shell stays generic and does not know encounter-, travel-, or
  feature-specific session types

## Consequences

- Runtime main tabs and runtime-state tabs can share one transient session
  without direct knowledge of each other.
- Feature state remains runtime-local and separate from canonical persistence.
- The shell runtime context becomes the single passive integration point for
  runtime-capability lookup, inspector access, and shared runtime sessions.

## Alternatives Considered

### Feature-specific shell registries

Rejected because that would make the shell coordinate feature logic.

### Static singletons or global service locators

Rejected because they hide lifecycle, make tests brittle, and weaken the
passive-shell boundary.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [ADR 011: Passive Workbench Shell Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/011-shell-workbench-architecture-model.md:1)

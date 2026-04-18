# ADR 002: Passive Shell With Generic Feature Discovery

- Status: Accepted
- Date: 2026-04-17

## Context

SaltMarcher needs feature slices that can be added without routine manual shell
or bootstrap edits. The host shell should remain reusable and should not own
feature business logic.

## Decision

SaltMarcher uses a passive shell and generic discovery:

- bootstrap discovers feature UI through `ShellViewContribution`
- bootstrap discovers exported runtime services through `ServiceContribution`
- the shell owns slots, registration contracts, runtime context, and inspector
  surfaces
- features register themselves through open contracts instead of closed shell
  registries or feature-specific bootstrap wiring

## Consequences

- Feature UI composition stays decoupled from the shell implementation.
- Adding features is localized to `src/` plus documentation updates.
- Shell-owned runtime surfaces such as inspector and service lookup remain
  stable integration points.
- Feature code must respect the binding shell workbench contract and the
  generic discovery/bootstrap rules.

## Alternatives Considered

### Manual feature registration in bootstrap

Rejected because it centralizes knowledge of every feature and creates routine
wiring churn.

### Shell-owned feature registry or enums

Rejected because it turns the shell into a feature coordinator instead of a
passive host.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)

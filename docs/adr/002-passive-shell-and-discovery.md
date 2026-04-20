# ADR 002: Passive Shell With Generic Feature Discovery

- Status: Accepted
- Date: 2026-04-17

## Context

SaltMarcher needs feature slices that can be added without routine manual shell
or bootstrap edits. The host shell should remain reusable and should not own
feature business logic.

## Decision

SaltMarcher uses a passive shell and generic discovery:

- bootstrap discovers feature UI through shell-facing view contribution
  contracts; the current target discovers `*Contribution` classes under
  `src/view/leftbartabs`, `src/view/statetabs`, and shell-contributed
  `src/view/dropdowns`
- bootstrap discovers exported runtime services through `ServiceContribution`
- the shell owns fixed cockpit surfaces, registration contracts, runtime
  context, details/history, and state-pane precedence
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
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/020-view-contributions-and-viewmodels.md:1)
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1)

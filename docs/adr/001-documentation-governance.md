# ADR 001: Documentation Governance By Document Type And Ownership

- Status: Accepted
- Date: 2026-04-17

## Context

SaltMarcher accumulated large mixed-purpose documents that combined glossary,
rules, target architecture, feature specification, and delivery planning. That
made documents hard to trust because scope, status, and ownership were unclear.

## Decision

SaltMarcher will document by document type:

- `AGENTS.md` for project-wide rules only
- architecture overview and standards under `docs/architecture/`
- one ADR per architecture decision under `docs/adr/`
- feature documentation co-located with the owning code root under `src/`

Every non-ADR document outside `AGENTS.md` must declare metadata for status,
owner, review date, and source of truth.

## Consequences

- Mixed-purpose documents must be split.
- Future architecture decisions must be recorded as ADRs.
- Feature documentation becomes easier to discover while working in the owning
  code area.
- Temporary implementation planning moves into `delivery.md` instead of becoming
  accidental architecture doctrine.

## Alternatives Considered

### Keep a few large umbrella documents

Rejected because ownership and truth boundaries stay ambiguous.

### Keep feature documentation centralized under `docs/features/`

Rejected because it lowers discoverability during routine feature work and makes
feature documentation easier to miss when editing code.

### Move everything into ADRs

Rejected because ADRs are poor containers for UI specs, feature behavior, and
temporary delivery planning.

## Related Documents

- [AGENTS.md](/home/aaron/Schreibtisch/projects/SaltMarcher/AGENTS.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/documentation.md:1)

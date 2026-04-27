# ADR 001: Documentation Governance By Document Type And Ownership

Amended in part by [ADR 015: Standards Directory Simplification](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-015-standards-directory-simplification.md:1)
for the reusable standards directory location. This ADR still owns the
document-type and ownership model, except where
[ADR 025: Centralized Feature Documentation Bundles](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-025-feature-documentation-bundles.md:1)
updates the canonical home of feature documentation.

- Status: Accepted
- Date: 2026-04-17

Superseded in part by [ADR 026: Closed Documentation Taxonomy](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-026-closed-documentation-taxonomy.md:1). `docs/project/<type>/` and `docs/<feature>/<type>/` now replace the earlier `docs/architecture/`, `docs/standards/`, `docs/adr/`, and co-located `src/**` canonical layout.

## Current Status

The active documentation taxonomy is now:

- `docs/project/<type>/` for project-wide canonical truth
- `docs/<feature>/<type>/` for feature-owned canonical truth

Legacy roots `docs/architecture/`, `docs/standards/`, `docs/adr/`, and
code-local markdown under `src/**` remain only as Deprecated compatibility
or discoverability stubs during the migration wave.

## Context

SaltMarcher accumulated large mixed-purpose documents that combined glossary,
rules, target architecture, feature specification, and delivery planning. That
made documents hard to trust because scope, status, and ownership were unclear.

## Historical Accepted Decision

SaltMarcher will document by document type:

- `AGENTS.md` for project-wide rules only
- architecture overview under `docs/architecture/`
- reusable standards under `docs/standards/`
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
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)

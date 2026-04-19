# ADR 015: Standards Directory Simplification

- Status: Accepted
- Date: 2026-04-19

## Context

Reusable standards were stored in a nested standards subtree below the
architecture directory. That path made standards look like a subsection of the
architecture overview even though they are a first-class project-wide
documentation type.

The extra directory level also made references longer without adding ownership
clarity.

## Decision

SaltMarcher stores reusable standards under `docs/standards/`.

The architecture overview remains under `docs/architecture/overview.md`.
Architecture decisions remain under `docs/adr/`.

## Consequences

- Standards are easier to reference and scan from the documentation root.
- Existing links and repo-owned skill references must point to
  `docs/standards/`.
- `docs/architecture/` no longer owns a nested standards subtree.

## Alternatives Considered

### Keep standards below the architecture directory

Rejected because the extra nesting does not add a meaningful ownership boundary.

### Move all architecture documents under `docs/architecture/`

Rejected because ADRs and standards are distinct document types with separate
governance and review expectations.

## Related Documents

- [AGENTS.md](/home/aaron/Schreibtisch/projects/SaltMarcher/AGENTS.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/documentation.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)

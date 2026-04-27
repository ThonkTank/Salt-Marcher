# ADR 026: Closed Documentation Taxonomy

- Status: Accepted
- Date: 2026-04-25

## Context

SaltMarcher previously used several competing documentation layouts at once:
project-wide material under `docs/architecture/`, `docs/standards/`, and
`docs/adr/`; a temporary feature bundle root under `docs/features/<feature>/`;
and older co-located canonical docs under `src/domain/`, `src/view/`, and
`src/data/`.

That overlap made the current source of truth harder to discover and allowed
active canonical content to survive in several roots at once.

## Decision

SaltMarcher now uses one closed canonical project-document taxonomy:

- `docs/project/<type>/` for project-wide canonical truth
- `docs/<feature>/<type>/` for feature-owned canonical truth

`<type>` is closed to exactly these six values:

- `requirements`
- `architecture`
- `contract`
- `domain`
- `delivery`
- `verification`

`docs/<feature>/README.md` is the feature entrypoint and `docs/project/README.md`
is the project-wide entrypoint.

Legacy roots `docs/architecture/`, `docs/standards/`, `docs/adr/`,
`docs/features/`, and code-local markdown under `src/**` may remain only as
Deprecated compatibility stubs that point to the canonical document.

## Consequences

- Every canonical document must belong to exactly one owner root and one type.
- Project-wide standards, ADRs, and architecture overviews now live under
  `docs/project/architecture/`.
- Project-wide proof and gate-operation documents now live under
  `docs/project/verification/`.
- Feature bundles under `docs/features/<feature>/` are replaced by
  `docs/<feature>/<type>/`.
- Active canonical Markdown under `src/**` must migrate into the owning
  `docs/project/...` or `docs/<feature>/...` location and leave behind only a
  discoverability stub.

## Superseded Decisions

- [ADR 001: Documentation Governance By Document Type And Ownership](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-001-documentation-governance.md:1)
  remains historical for document-type governance, but its earlier canonical
  root layout is superseded by this ADR.
- [ADR 025: Centralized Feature Documentation Bundles](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-025-feature-documentation-bundles.md:1)
  remains historical for the move away from co-located feature truth, but the
  intermediate `docs/features/<feature>/` layout is superseded by this ADR.

## Alternatives Considered

### Keep `docs/features/<feature>/` as the long-term feature root

Rejected because it keeps an unnecessary extra directory layer once feature
truth is already grouped by document type.

### Keep project-wide canon split across `docs/architecture/`, `docs/standards/`, and `docs/adr/`

Rejected because those roots overlap semantically and make the owning project
surface harder to scan than one `docs/project/<type>/` tree.

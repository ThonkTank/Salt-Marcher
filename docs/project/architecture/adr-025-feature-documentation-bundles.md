# ADR 025: Centralized Feature Documentation Bundles

- Status: Accepted
- Date: 2026-04-24

Superseded in part by [ADR 026: Closed Documentation Taxonomy](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-026-closed-documentation-taxonomy.md:1). The temporary `docs/features/<feature>/` bundle root has been replaced by `docs/<feature>/<type>/`.

## Current Status

The active feature-documentation taxonomy is now:

- `docs/<feature>/<type>/` for canonical feature-owned truth
- `docs/<feature>/README.md` as the feature entrypoint

Legacy `docs/features/<feature>/` files and code-local markdown under `src/**`
remain only as Deprecated compatibility or discoverability stubs during the
migration wave.

## Context

SaltMarcher feature documentation has been split across `src/domain/`,
`src/view/`, `src/data/`, and feature-scoped standards under
`docs/standards/<feature>/`. That kept docs near code, but it also scattered
one feature's requirements, architecture, contracts, domain truth, and
persistence rules across several roots. Dungeon map work made the weakness
concrete: cross-root feature documentation started accumulating in
`docs/standards/map/`, even though much of that content was feature-specific
truth rather than reusable standards.

## Historical Accepted Decision

SaltMarcher will keep documenting by document type, but canonical
feature-specific documents now live under `docs/features/<feature>/`.

The new feature bundle root owns:

- `overview.md` as the feature documentation entrypoint
- `requirements-*.md` for feature behavior
- `architecture-*.md` for feature architecture
- `contract-*.md` for feature boundary and persistence contracts
- `domain-*.md` for domain truth
- `delivery-*.md` for temporary rollout notes

Not every feature bundle must use every family. A generic cross-root surface
bundle may own requirements, architecture, and contracts without owning a
domain write model or persistence truth.

`docs/standards/` remains standards-only. It may define reusable architecture
or contract rules, but it must not remain the canonical owner of one feature's
requirements, feature architecture, domain truth, or persistence truth.

Local markdown files under `src/domain/`, `src/view/`, and `src/data/` may
remain only as discoverability stubs that point to the canonical
`docs/features/<feature>/` bundle.

## Consequences

- Cross-root feature docs become easier to scan as one bundle.
- `docs/standards/<feature>/` can shrink back to real reusable standards or be
  removed when the content is feature-specific.
- Existing co-located feature docs must either migrate into
  `docs/features/<feature>/` or become non-canonical pointer stubs.
- Documentation governance, overview docs, and compatibility stubs must be
  updated in the same change when a feature migrates.

## Alternatives Considered

### Keep feature documentation co-located under `src/`

Rejected because cross-root feature truth keeps fragmenting into several
directories and encourages `docs/standards/` to absorb feature-specific
content.

### Move only map documentation into `docs/features/`

Rejected because a one-off exception would weaken documentation governance and
make the taxonomy harder to reason about.

### Keep `docs/standards/<feature>/` as the main cross-root feature home

Rejected because standards are the wrong surface for feature requirements,
feature architecture, domain truth, and delivery notes.

## Related Documents

- [AGENTS.md](/home/aaron/Schreibtisch/projects/SaltMarcher/AGENTS.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [ADR 001: Documentation Governance](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-001-documentation-governance.md:1)

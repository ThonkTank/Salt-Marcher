Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-01
Source of Truth: Complete invariant catalog for optional `mapper/`
translation roles in data features under `src/data/**`.

# Data Mapper Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
optional `mapper/` role itself.

It answers three questions for every mapper surface under
`src/data/**/mapper/`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY expose

This document does not own feature-root topology, domain-port contracts,
root export or registration seams, gateway placement, source-model ownership,
foreign-feature access, or broad layer-wide dependency rules. Those stay in
the neighboring data and layering enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkDataMapperEnforcement --rerun-tasks --console=plain`
  runs the currently active Data Mapper-focused PMD and
  enforcement-documentation coverage checks through one root task.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-mapper-non-trivial-translation-ownership` | Review-Owned | every data feature that owns any Java type under `src/data/**/mapper/` | none | none | A feature uses `mapper/` only when translation between own-feature source-local `model/` shapes and own-feature domain or published boundary shapes is meaningfully different enough to justify a dedicated translation role. |
| `data-mapper-translation-surface-ownership` | Review-Owned | every mapper facade or mapper-local helper under `src/data/**/mapper/` | none | none | `mapper/` code exists only to carry one-way or two-way translation between same-feature source-local `model/` shapes and same-feature domain or published boundary shapes; mapper-local support types are allowed only when they factor or stage that translation. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-mapper-no-source-mechanics` | Source-Pattern Enforced | every Java type under `src/data/**/mapper/` | data-mapper bundle PMD `DataMapperSourceMechanicsRule` | `./gradlew checkDataMapperEnforcement` | `mapper/` code does not reference narrow concrete source APIs directly. |
| `data-mapper-no-business-rules-or-policy` | Review-Owned | every mapper under `src/data/**/mapper/` | none | none | A mechanically legal mapper still limits itself to translation and does not own domain validation, normalization, ranking, policy, authored-state semantics, or other business meaning. |

### Communication Contract

This section owns only the direct mapper seam itself: which same-feature
collaborators a mapper surface may speak to and which shape families it may
exchange there. Broader layer dependency bans, root export seams, and
foreign-feature access rules stay in the neighboring owner documents.

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-mapper-shape-translation-boundary` | Review-Owned | every direct mapper API or mapper-local helper seam under `src/data/**/mapper/` | none | none | Mapper seams communicate only as same-feature internal data collaboration points for `repository/`, `query/`, or mapper-local helper code, and they exchange only same-feature source-local `model/` shapes, same-feature domain or published boundary shapes, mapper-local support types, or JDK value/container types rather than defining a domain-port contract, gateway facade, runtime export seam, or public backend boundary of their own. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-model-enforcement.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)

Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
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

This document does not own feature-root topology, repository/query adapter
contracts, gateway placement, source-model ownership, or broad layer and
cross-feature dependency rules. Those stay in the neighboring data and
layering enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-mapper-non-trivial-translation-ownership` | Review-Owned | every data feature that owns any Java type under `src/data/**/mapper/` | none | none | A feature uses `mapper/` only when translation between own-feature source-local `model/` shapes and own-feature domain or published boundary shapes is meaningfully different enough to justify a dedicated translation role. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-mapper-no-source-mechanics` | Source-Pattern Enforced | every Java type under `src/data/**/mapper/` | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | `mapper/` code does not reference narrow concrete source APIs directly. |
| `data-mapper-no-business-rules-or-policy` | Review-Owned | every mapper under `src/data/**/mapper/` | none | none | A mechanically legal mapper still limits itself to translation and does not own domain validation, normalization, ranking, policy, or other business meaning. |

### Communication Contract

This section owns only the direct mapper seam itself: which shape families a
mapper surface may expose or consume. Broader layer dependency bans and
foreign-feature access rules stay in the neighboring owner documents.

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-mapper-shape-translation-boundary` | Review-Owned | every direct mapper API or mapper-local helper seam under `src/data/**/mapper/` | none | none | Mapper seams speak only in own-feature source-local `model/` shapes, own-feature domain or published boundary shapes, mapper-local support types, or JDK value/container types rather than becoming a second gateway, repository/query, or public backend boundary surface. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-model-enforcement.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)

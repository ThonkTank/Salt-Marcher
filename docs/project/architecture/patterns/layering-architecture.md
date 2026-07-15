Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Retained package-level layer dependency direction and
cross-layer public-boundary framing during the architecture migration.

# Layering Architecture Standard

## Goal

SaltMarcher keeps a small package-level layer model while the old role-family
form doctrine is removed. This document owns only the retained dependency
direction statement. It does not define per-role file shapes, role suffixes, or
implementation ceremony.

## Layer Roots

```text
bootstrap/   startup and generic discovery
shell/       passive cockpit host and public shell contracts
src/features/ migrated feature runtime areas when named by the ledger
src/view/    legacy presentation adapters until migrated
src/domain/  legacy and non-migrated application core
src/data/    outbound source adapters
```

## Dependency Direction

Source dependencies stay inside these boundaries:

- `bootstrap` may depend on public shell contracts and shell host startup
  surfaces.
- `shell` stays independent from concrete feature code.
- migrated `src/features/**` may use public shell contracts and its documented
  persistence or authored-fact seams.
- legacy `src/view/**` may use public shell contracts and documented domain
  public boundaries.
- `src/data/**` may use domain-owned public boundaries needed for adapter work.
- `src/domain/**` stays independent from outer layers, except root
  service-composition files may use the narrow shell service-registration seam.

The retained automated outcome check is the layer-dependency-direction ArchUnit
test under `test/architecture/system/`. The migration roadmap decides when
legacy structure is simplified; behavior harnesses prove user-visible parity.

## Public Boundary Policy

New public cross-layer seams must be named by the owner document for the
behavior, contract, or migration slice that needs them. Migration passes keep
published seams byte-compatible until every consuming side is migrated.

## References

- [Source Architecture](../source-architecture.md)
- [Data Layer Standard](data-layer.md)
- [Shell Layer Standard](shell-layer.md)
- [Bootstrap Standard](bootstrap.md)

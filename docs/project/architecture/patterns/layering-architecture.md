Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Package-level layer dependency direction and cross-layer
public-boundary framing.

# Layering Architecture Standard

## Goal

SaltMarcher uses a small package-level layer model. This document owns only the
dependency-direction statement. It does not define per-role file shapes, role
suffixes, or implementation ceremony.

## Layer Roots

```text
bootstrap/   startup and generic discovery
shell/       passive cockpit host and public shell contracts
src/features/ feature runtime areas
src/view/    presentation adapters
src/domain/  application core
src/data/    outbound source adapters
```

## Dependency Direction

Source dependencies stay inside these boundaries:

- `bootstrap` may depend on public shell contracts and shell host startup
  surfaces.
- `shell` stays independent from concrete feature code.
- `src/features/**` may use public shell contracts and its documented
  persistence or authored-fact seams.
- `src/view/**` may use public shell contracts and documented domain
  public boundaries.
- `src/data/**` may use domain-owned public boundaries needed for adapter work.
- `src/domain/**` stays independent from outer layers, except root
  service-composition files may use the narrow shell service-registration seam.

The automated outcome check is the layer-dependency-direction ArchUnit test
under `test/architecture/system/`; behavior tests prove user-visible
behavior.

## Public Boundary Policy

New public cross-layer seams must be named by the owner document for the
behavior, contract, or architecture change that needs them. Published seams
stay compatible until all consumers change together or the owning contract
defines a migration.

## References

- [Source Architecture](../source-architecture.md)
- [Data Layer Standard](data-layer.md)
- [Shell Layer Standard](shell-layer.md)
- [Bootstrap Standard](bootstrap.md)

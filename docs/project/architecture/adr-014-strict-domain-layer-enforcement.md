# ADR 014: Strict Domain-Layer Enforcement

- Status: Superseded by [ADR 021: Domain Layer Role Reset](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-021-domain-layer-role-reset.md:1)
- Date: 2026-04-18
- Supersession: ADR 021 replaces this ADR's active `api/`, broad named-module,
  and context-type enforcement model with `published/`, tactical role packages,
  explicit context roles, and a blocking `mapcore` removal rule.

## Context

ADR 013 adopted the DDD-primary target model for `src/domain/**` while still
allowing legacy root role buckets to remain temporarily as migration debt.

That tolerance created a second practical model:

- the standards described named domain modules as the target
- the build harness still allowed role buckets such as `entity/`, `service/`,
  `valueobject/`, `repository/`, and `query/`
- same-feature internal domain types could still leak through public backend
  boundary signatures

## Decision

SaltMarcher now enforces the DDD target model immediately.

- `src/domain/<feature>/` may contain only the root
  `<PascalFeatureName>ApplicationService.java`, `api/`, `application/`, and
  named domain modules.
- Legacy root role buckets under `src/domain/**` are build-blocking violations.
- Every domain feature must declare exactly one machine-readable context type
  in `DOMAIN.md`.
- Public domain boundary signatures must not expose outer-layer types, foreign
  private domain types, or same-feature internal domain-module types.

## Consequences

- Existing violations are discovered by the normal build and architecture
  checks instead of by a separate migration report.
- The current codebase may remain non-green until the follow-up migration moves
  legacy role-bucket code into named domain modules and fixes any public
  signature leaks.
- Semantic DDD judgments still remain review-owned when they cannot be
  expressed as stable source, topology, or compiler-signature checks.

## Related Documents

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [ADR 013: DDD-Primary Domain-Layer Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-013-domain-layer-ddd-primary-model.md:1)
- [ADR 021: Domain Layer Role Reset](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-021-domain-layer-role-reset.md:1)

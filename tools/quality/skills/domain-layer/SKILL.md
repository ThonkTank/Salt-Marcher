---
name: domain-layer
description: Use before planning, implementing, refactoring, or reviewing anything under `src/domain/**`, any root `*ApplicationService`, `application/`, `published/`, `model/`, domain role package, or adjacent context docs such as `DOMAIN.md`. The canonical source of truth is `docs/project/architecture/patterns/domain-layer.md`.
---

# Domain Layer

## Overview

Use this skill to keep domain-layer work aligned with the canonical
domain-layer standard and the repo's instruction routing.

This skill operationalizes:

- [docs/project/architecture/patterns/domain-layer.md](../../../../docs/project/architecture/patterns/domain-layer.md)
- [AGENTS.md](../../../../AGENTS.md)

This skill is not the source of truth. If any neighboring doc, enforcement
catalog, or legacy guidance conflicts with `domain-layer.md`, follow the
standard.

Domain enforcement docs are authoritative only for role-local gate inventory,
current mechanical drift, and focused verification entrypoints. They do not
redefine the architecture.

## Use This Skill For

- any file under `src/domain/**`
- any root `*ApplicationService.java`
- any `published/`, `application/`, `model/`, or model-family role package
- any `README.md`, `SPEC.md`, `DOMAIN.md`, or `DELIVERY.md` that defines or
  reviews a domain context
- domain-layer governance rewrites where role enforcement docs, `AGENTS.md`,
  and the repo-local skill must stay aligned to one architectural owner

## Required Workflow

Before changing domain code:

1. Read `AGENTS.md`, the canonical
   `docs/project/architecture/patterns/domain-layer.md`, and the touched
   context's `DOMAIN.md` before making placement decisions.
2. Assign every touched type one domain-layer role before refactoring:
   family `*ApplicationService`, `published/**`, root `application/**`,
   direct internal model files under `model/<family>/`, a semantic internal
   model subpackage, or one explicit subordinate role package.
3. If the task touches a governed role doc under
   `docs/project/architecture/enforcement/`, keep architectural truth in
   `domain-layer.md` and keep the role doc limited to role-local enforcement
   inventory and routing.
4. Check the touched role's live enforcement doc for current mechanical drift
   and focused gate ownership before claiming a rule is enforced.
5. Move ambiguous logic to the owning role instead of copying nearby legacy
   placement.
6. Treat `src/domain/mapcore/**` as rejected placement; shared render input
   belongs in the view layer, while domain dungeon map/world facts belong to
   `dungeon/published`.

## Role Reminders

### `*ApplicationService.java`

- treat direct root services as family-scoped intent interpreters and routers
- keep them thin and boundary-owned
- do not let them become policy owners, composition roots, or direct reply
  channels

### `published/`

- keep it to exported published-language carriers only
- keep non-`*Model` carriers passive
- treat `published/*Model` as the read-side publication seam defined by the
  owner doc, not as a convenience reply channel

### `application/`

- root-level cross-model orchestration only
- direct Java files are named `*UseCase.java`
- do not let `application/` become a catch-all for displaced business policy

### `model/`

- treat `model/` as the primary home of current domain work state
- the internal model area is direct family-root model files plus semantic
  subpackages below `model/<family>/`, excluding subordinate role buckets
- model-local work operations belong under `model/<family>/usecase/`
- pure work steps belong under `helper/`; shared immutable values belong under
  `constants/`

### `port/` and `repository/`

- follow the owner doc's target semantics first: `Port` is inbound published
  listening and `Repository` is outbound triggering or layered data access
- check the role-local enforcement doc before claiming the current mechanics
  already prove the deeper purity or communication semantics beyond topology

### Model Families And Role Packages

- direct context-root buckets are only `published/`, `application/`, and
  `model/`
- lower-case model families live under `model/<family>/`
- non-model role buckets under a family are only `usecase/`, `helper/`,
  `constants/`, `port/`, and `repository/`
- non-model role buckets stay direct-file only
- `model/<family>/` may add deeper semantic subpackages for subordinate
  models of that same family

## Review Focus

When reviewing domain-layer work, look for:

- the touched files still match the owner rules in `domain-layer.md`
- role enforcement docs that stay on gate inventory and do not restate
  architectural truth
- `Context Role:` declarations matching the domain-layer standard
- no named modules at context root outside `published/`, `application/`, and
  `model/`
- direct Java files under `model/<family>/` are internal Model files
- no forbidden technical buckets under domain roots or model families
- reserved role suffixes only in their canonical buckets
- repositories and ports stated in domain language without data-source, shell,
  JavaFX, SQL, filesystem, network, or runtime-registration terms
- thin application use cases without hidden adapter composition
- no `src/domain/mapcore/**`

## Correctness Rule

Correct domain work follows the canonical `domain-layer.md` owner doc even when
nearby legacy code or older enforcement prose still reflects a previous shape.
If a role doc and the owner doc disagree, fix the role doc or report the drift;
do not copy the drift into new code or new governance text.

## References

- [Domain Layer Standard](../../../../docs/project/architecture/patterns/domain-layer.md)
- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
- [AGENTS.md](../../../../AGENTS.md)

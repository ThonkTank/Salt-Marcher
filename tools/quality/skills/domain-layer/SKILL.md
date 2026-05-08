---
name: domain-layer
description: Use before planning, implementing, refactoring, or reviewing anything under `src/domain/**`, any root `*ApplicationService`, `application/`, `published/`, named domain modules, or adjacent context docs such as `DOMAIN.md`. The canonical source of truth is `docs/project/architecture/patterns/domain-layer.md`.
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
- any `published/`, `application/`, domain-concept module, or module
  role package
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
   root `*ApplicationService`, `published/**`, `application/**`, named module,
   or one explicit module role package.
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

- treat the root boundary exactly as described by `domain-layer.md`
- keep it thin and boundary-owned
- do not let it become a second composition root, policy owner, or return-path
  workaround

### `published/`

- keep it to exported published-language carriers only
- keep non-`*Model` carriers passive
- treat `published/*Model` as the read-side publication seam defined by the
  owner doc, not as a convenience reply channel

### `application/`

- use-case orchestration and internal application coordination
- direct Java files are named `*UseCase.java`
- direct helper files are only the owner-doc-approved boundary helpers
- do not let `application/` become a catch-all for displaced business policy
- generic `*Operations` coordinator buckets are migration debt

### `port/`

- keep it to domain-owned outbound interfaces only
- do not let it become a home for adapters, records, schemas, or runtime
  registration

### Domain Modules And Role Packages

- direct domain module names are concepts in the ubiquitous language
- Java files inside a domain module live under a tactical role package
- use only the role packages allowed by `domain-layer.md`
- use `factory/`, `service/`, `event/`, and `specification/` only when the
  role genuinely exists
- domain modules must not import any `src.domain.*.published.*` carriers

## Review Focus

When reviewing domain-layer work, look for:

- the touched files still match the owner rules in `domain-layer.md`
- role enforcement docs that stay on gate inventory and do not restate
  architectural truth
- `Context Role:` declarations matching the domain-layer standard
- role subpackages under every named domain module
- no direct Java files under named domain modules
- no `published/` imports from named domain modules
- no forbidden technical buckets under domain modules
- ports stated in domain language without data-source, shell, JavaFX, SQL,
  filesystem, network, or runtime-registration terms
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

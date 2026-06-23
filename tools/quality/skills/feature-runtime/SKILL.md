---
name: feature-runtime
description: Use before planning, implementing, refactoring, or reviewing anything under `src/features/**`, migrated feature runtime, runtime state, typed targets, preview, operation engines, render frames, UI raw input, storage, shell binding, or adjacent feature-runtime governance docs. The canonical source of truth is `docs/project/architecture/patterns/feature-runtime.md`.
---

# Feature Runtime

## Overview

Use this skill for migrated feature-owned runtime work under `src/features/**`.

This skill operationalizes:

- [docs/project/architecture/patterns/feature-runtime.md](../../../../docs/project/architecture/patterns/feature-runtime.md)
- [AGENTS.md](../../../../AGENTS.md)

Legacy `src/view/**` and `src/domain/**` work still uses the view-layer and
domain-layer skills. Do not import those role chains into `src/features/**`
unless the feature-runtime owner explicitly says a compatibility seam is still
required.

Feature-runtime conformance is currently review-owned unless a later owner
document names a mechanical gate.

## Required Workflow

Before changing feature-runtime code or feature-runtime governance:

1. Read `AGENTS.md` and the canonical
   `docs/project/architecture/patterns/feature-runtime.md`.
2. Identify whether the touched path is migrated feature runtime work under
   `src/features/**` or legacy work that still belongs to `src/view/**` or
   `src/domain/**`.
3. Assign each touched concern one feature-runtime package family: `runtime`,
   `ui`, `storage`, or `shell`.
4. Keep transient session/workflow state in the runtime owner instead of
   reconstructing legacy `ContentModel`, `IntentHandler`, `ApplicationService`,
   or `published/*Model` chains as architectural ceremony.
5. Keep target, preview, mutation, publication, and render-frame semantics in
   `runtime/`.
6. When a migration still needs a compatibility seam to legacy shell/service
   registration or persistence boundaries, record the seam and its removal
   condition in the current implementation log.
7. Do not claim a feature-runtime rule is mechanically enforced unless a named
   gate proves it.

## Placement Heuristics

- If code owns one migrated feature's runtime composition, session state,
  target resolution, preview, operation dispatch, publication, or render-frame
  construction, it belongs in `runtime/`.
- If code owns preview, draft, hover, selection, mode, or tool state that is
  not authored truth, it belongs in `runtime/`.
- If code registers shell surfaces or binds shell lifecycle to the feature, it
  belongs in `shell/`.
- If code renders prepared frames or captures raw UI input, it belongs in
  `ui/`.
- If code persists or reloads authored facts, it belongs in `storage/`.

## Review Focus

When reviewing feature-runtime work, look for:

- migrated `src/features/**` code that drifts back into legacy
  `src/view/**` or `src/domain/**` role vocabulary without a real need
- transient runtime/session state split across too many foreign owners
- UI code resolving semantic targets or preview deltas instead of rendering a
  runtime frame
- storage code owning editor operation semantics instead of persistence
- shell binding that accumulates feature behavior instead of staying narrow
- claims of enforcement that are not backed by a named gate

## Health Review Checklist

- Mark retained legacy `ContentModel`, `IntentHandler`, application-service, or
  generic preview seams as project-health debt when they survive outside the
  target feature-runtime owner.
- Treat duplicated transient state, stale render-frame ownership, generic
  operation routers, and review-owned conformance gaps as structural findings.
- Do not approve missing feature-runtime expertise as neutral; route it through
  `project-health` as debt or skill gap.
- Keep migrated runtime, target, preview, mutation, publication, and
  render-frame truth in this owner; nearby legacy code is not precedent.

## Correctness Rule

Correct migrated feature work follows the canonical feature-runtime owner doc
even when nearby legacy code still uses the old view/domain role model. Legacy
topology is compatibility history, not precedent for new `src/features/**`
architecture.

## References

- [Feature Runtime Architecture Standard](../../../../docs/project/architecture/patterns/feature-runtime.md)
- [Agent Instruction Standard](../../../../docs/project/architecture/agent-instructions.md)
- [Project Health Standard](../../../../docs/project/architecture/project-health.md)
- [AGENTS.md](../../../../AGENTS.md)

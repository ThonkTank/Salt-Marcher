# SaltMarcher Working Constitution

This file is the early routing surface for SaltMarcher agents. It defines only
the repo-specific rules an agent needs before choosing canonical documentation,
skills, or verification. It does not hold feature specifications, long-form
target designs, migration plans, or glossary truth.

Global workspace rules live in
`/home/aaron/Schreibtisch/projects/AGENTS.md` and apply to SaltMarcher unless
this file adds a stricter SaltMarcher-specific rule.

## Task Context Protocol

Before changing repo-tracked files in SaltMarcher:

1. Follow the workspace preflight and post-work commit rules in
   `/home/aaron/Schreibtisch/projects/AGENTS.md`.
2. Classify the touched surface: production code, check/enforcement package,
   documentation, agent instruction, source-backed decision, or a combination.
3. Read the nearest canonical owner for that surface before copying nearby
   implementation shape.
4. Use every mandatory skill named by the workspace or SaltMarcher routing
   rules before planning, implementing, refactoring, or reviewing covered work.
5. For production-code, check/enforcement, or dependency work, identify the
   continuous-refactoring scope before editing.
6. Identify the required verification surface before editing and report the
   literal result before handoff.

If a touched surface has no clear canonical owner, stop and report the ambiguity
instead of creating a second source of truth.

## Documentation Routing

SaltMarcher keeps documentation by document type, not by convenience. Each
topic has one canonical home, and every other document may only summarize or
link to it.

Use the documentation tree in this order:

1. `AGENTS.md` for project-wide norms and documentation governance.
2. `docs/project/` for project-wide canonical documentation grouped by type.
3. `docs/<feature>/` for canonical feature documentation grouped by type.

Legacy roots `docs/architecture/`, `docs/standards/`, `docs/adr/`,
`docs/features/`, `docs/compat/`, and redirect-only markdown under `src/**`
are not canonical and must be removed instead of preserved once the owning
document exists.

## Skill Routing

- Behavior-coupled automated tests are not part of the project strategy; use
  the quality-platform gates plus manual testing instead.
- Verification harnesses must not carry fixture-based selftest suites or
  meta-test layers; enforce repository policy directly in the owning gate.
- New compile/build/check gates require explicit user request. Detailed
  verification policy lives in `docs/project/verification/quality-platforms.md`.
- Work on `AGENTS.md`, any `SKILL.md`, `agents/openai.yaml`, or other
  agent-facing instruction surface must use the global
  `agent-instruction-engineering` skill and follow
  `docs/project/architecture/agent-instructions.md`.
- Work that uses external sources or local source evidence for decisions must
  use the global `source-references` skill and follow
  `docs/project/verification/source-references.md`.
- Global review-specialist routing lives in
  `docs/project/architecture/agent-instructions.md` and in the repo-owned
  adversarial review skills; do not copy those skills into SaltMarcher without
  an explicit user request.
- Work that plans, implements, refactors, or reviews a SaltMarcher repo-tracked
  change must use the repo-owned `context-hygiene` skill before relying on
  nearby files as precedent. The skill is a routing and context-budget rule; it
  does not authorize new gates or broad documentation rewrites by itself.
- Work that plans, implements, refactors, or reviews a SaltMarcher repo-tracked
  change must use the repo-owned `repo-tools` skill before starting that work.
- Production-code, check/enforcement, and dependency work must use the
  repo-owned `continuous-refactoring` skill before planning, implementing,
  refactoring, or reviewing. The skill is a workflow rule for keeping cleanup
  inside the normal development pass; it does not authorize new gates or
  repo-wide cleanup waves by itself.
- Every repo-tracked implementation pass must receive the repo-owned
  adversarial review. The implementing agent must read
  `tools/quality/skills/adversarial-review/SKILL.md` before starting that step;
  the review subagent must read
  `tools/quality/skills/adversarial-review-agent/SKILL.md` before reviewing.
  Agent-facing instruction changes must still use
  `agent-instruction-engineering` before that review. A pass without the
  required completed review remains WIP.
- Work under `src/domain/**` must use the repo-owned `domain-layer` skill and
  follow the canonical domain-layer standard before changes are made or
  reviewed.
- Work under `src/view/**` must use the repo-owned `view-layer-mvvm` skill and
  follow the canonical cockpit view-layer standard before changes are made or
  reviewed.
- For `src/domain/**`,
  `docs/project/architecture/patterns/domain-layer.md` is the sole
  architectural source of truth and
  `tools/quality/skills/domain-layer/SKILL.md` is the sole operative agent
  guidance. Other docs may only route or summarize; they must not become a
  second source of domain-layer truth.
- For `src/view/**`, `docs/project/architecture/patterns/view-layer.md` is the
  sole architectural source of truth and
  `tools/quality/skills/view-layer-mvvm/SKILL.md` is the sole operative agent
  guidance. Other docs may only route or summarize; they must not become a
  second source of view-layer truth.

## SaltMarcher Verification

- After each completed implementation pass that changes production code, rerun
  `tools/gradle/run-staged-verification.sh production-handoff` from the
  repository root before handoff. If you are working inside `src/` or another
  subdirectory, set the command working directory to the repository root
  instead of using `../gradlew`.
- After each completed implementation pass that changes non-documentation
  production-code checks, enforcement packages, build-harness rules,
  Error Prone rules, quality-rules wiring, enforcement-bundle wiring, or
  verification-only Gradle wiring, use the smallest applicable documented
  wrapper route from the repository root before handoff. If the pass changes
  shared production-code routing, broad verification-core lifecycle wiring, or
  the public production-code surface itself, rerun
  `tools/gradle/run-staged-verification.sh production-handoff` from the
  repository root as the handoff proof.
- For package-limited production-adjacent or check/enforcement-package work,
  use `tools/gradle/run-staged-verification.sh focused-handoff --path
  <repo-package-or-resource-dir> [--area <area>]` first as the narrow local
  proof. For check/enforcement-package-only changes, that focused route may be
  the smallest local proof when the handoff reports the literal scope, selected
  area, engine surfaces, and result. Production-code changes and shared
  verification-core routing or lifecycle changes still require
  `tools/gradle/run-staged-verification.sh production-handoff` before final
  handoff.
- After each completed documentation-only pass limited to `AGENTS.md`,
  `docs/**`, `src/domain/**/DOMAIN.md`, or Markdown files under
  `tools/quality/**`, rerun
  `./gradlew checkDocumentationEnforcement --console=plain` from the repository
  root before handoff instead of the full build.
- A pass without the required production-code handoff or
  documentation-enforcement rerun is incomplete and must remain WIP.
- Parallel agent implementation work must not share one live checkout. Each
  agent must work in its own linked git worktree on its own branch, preferably
  under `build/codex-worktrees/<topic>/` or a temporary external worktree when
  the repo-local path is unsuitable.
- The required local sequence for parallel implementation is: create linked
  worktree, create or switch to an agent-owned branch inside that worktree,
  implement there, run the required verification surface there, merge the
  green branch back into the repo-root `SaltMarcher/` checkout only after the
  required gate passes, then remove the temporary local branch and linked
  worktree once the verified result lives in the real local working tree.
- For long verification runs where silent execution makes agent-side
  observation unreliable, prefer `tools/gradle/run-observable-gradle.sh`
  instead of shell loops over many separate `./gradlew` invocations. Use
  `tools/gradle/run-staged-verification.sh production-handoff` for the public
  production-code handoff surface and
  `tools/gradle/run-staged-verification.sh focused-handoff --path
  <repo-package-or-resource-dir> [--area <area>]` for package-focused local
  proof. The canonical public proof entrypoints are
  `tools/gradle/run-staged-verification.sh production-handoff` for
  production-code handoff and `./gradlew checkDocumentationEnforcement` for
  documentation checks.
- `CODEX_THREAD_ID` and `SALTMARCHER_GRADLE_ISOLATION_ID` remain trace labels
  only when a caller explicitly exports them; they are not part of the local
  parallel-safety contract and the wrapper does not consume them anymore.
- `./gradlew` now uses Gradle's normal daemon behavior unless the caller
  explicitly passes `--daemon` or `--no-daemon`.
- When the desktop app is the manual test surface, run
  `tools/gradle/run-staged-verification.sh desktop-install` after the
  successful production handoff before handoff unless the user explicitly
  waives reinstall, the task is documentation-only, or the task is purely
  non-code planning or review work.

## References

- [Global Workspace Rules](/home/aaron/Schreibtisch/projects/AGENTS.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Source References Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/source-references.md:1)
- [Global Source References Skill](/home/aaron/.codex/skills/local/source-references/SKILL.md:1)
- [Global Agent Instruction Engineering Skill](/home/aaron/.codex/skills/local/agent-instruction-engineering/SKILL.md:1)
- [Context Hygiene Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-context.md:1)
- [Context Hygiene Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/context-hygiene/SKILL.md:1)
- [Repo Tools Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/repo-tools/SKILL.md:1)
- [Continuous Refactoring Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/continuous-refactoring/SKILL.md:1)
- [Adversarial Review Caller Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/adversarial-review/SKILL.md:1)
- [Adversarial Review Agent Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/adversarial-review-agent/SKILL.md:1)
- [Domain Layer Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/domain-layer/SKILL.md:1)
- [View Layer MVVM Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/view-layer-mvvm/SKILL.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)

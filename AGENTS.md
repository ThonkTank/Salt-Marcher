# SaltMarcher Working Constitution

This file is the early SaltMarcher routing surface. It defines repo-specific
rules before agents choose canonical docs, skills, or verification; it does not
hold feature specs, target designs, migration plans, or glossary truth.

Global workspace rules live in
`/home/aaron/Schreibtisch/projects/AGENTS.md` and apply to SaltMarcher unless
this file adds a stricter SaltMarcher-specific rule.

## Task Context Protocol

Before changing repo-tracked files in SaltMarcher:

1. Follow the workspace preflight and post-work commit rules in
   `/home/aaron/Schreibtisch/projects/AGENTS.md`.
2. Classify the touched surface: production code, check/enforcement package,
   documentation, agent instruction, source-backed decision, or a combination.
3. Every requested repo-tracked mutation enters the Standard Coordinated
   Workflow immediately:
   `Goal Definition -> CR -> CR Review -> Planning Bundle -> Plan Review -> Implementation -> Review -> Commit/Handoff`.
   Read-only and status-only work stays outside that chain because it does not
   mutate tracked files. User-provided, confirmed, or requested plans and chat
   confirmation are goal-definition input only; they do not replace CR review,
   planning-bundle review, implementation authority, Verification Runner proof,
   Implementation Review Coordinator acceptance, or the artifact-chain guard.
   Before implementation, run the artifact-chain guard; bad provenance keeps
   WIP. Main must use the Workflow Artifact Ownership table below before
   launching any downstream role and must not create generated review
   artifacts.
4. For the current workflow phase only, read the nearest canonical owner and
   mandatory role/surface skills before covered work. Keep later-phase context
   out of the current role packet.
5. The Standard Coordinated Workflow is owned by
   `docs/project/architecture/agent-instructions.md`; Wave Coordination is its
   normal operating skill. Documentation placement is owned by
   `documentation.md`; generated artifact shape by
   `implementation-artifacts.md`, routed by `implementation-documentation.md`.
6. For bug, regression, refactor, governance, systemic-repair, or repeated-fix
   work, perform the `Problem History Intake` owned by
   `docs/project/architecture/agent-instructions.md` before implementation
   planning, refactor planning, implementation review, or continuation.
   `context-hygiene` and `code-exploration` own the trigger-time workflow.
   When proof, review, architecture, quality, harness, or gate feedback blocks
   a pass, run that standard's `Blocker Reflection Gate` before planning a
   repair.
7. When repo-tracked work knowingly creates transitional support or leaves
   superseded support in place, mark it at that point with
   `LEGACY_REMOVE_ON_TOUCH` and a concrete removal condition.
8. When a supported architecture, quality, governance, stale-proof, repeated
   fix, or compatibility finding cannot be fixed in the same pass, materialize
   it as `PROJECT_HEALTH_DEBT` at the primary cause and in
   `docs/project/architecture/project-health-debt.md`, or report why it is a
   markerless process/tooling entry.
9. For production-code, check/enforcement, or dependency work, identify the
   continuous-refactoring scope before editing.
10. For production-code, check/enforcement, or dependency work, search the
   planned write set and directly owning adapters for `LEGACY_REMOVE_ON_TOUCH`.
   Any hit must be removed in the same pass or reported as an explicit blocker;
   do not grow marked support or treat marked surfaces as implementation
   precedent.
11. Identify the required verification surface before editing and report the
   literal result before handoff.

If a touched surface has no clear canonical owner, stop and report the ambiguity
instead of creating a second source of truth.

## Workflow Artifact Ownership

Before launching another workflow role, Main must name the input authority, the
expected generated artifact path, and the allowed write surface in that role's
prompt. A role may write only the artifact class assigned here and by the
narrower caller skill or plan. If Main cannot assign the required output path
or allowed write surface, the workflow stays WIP/blocked instead of launching a
role with implicit artifact duties.

| Artifact | Workflow route | Guard-readable artifact role | Caller/launch surface |
| --- | --- | --- | --- |
| Goal definition, CR | Main/User | `Main/User` | Main writes intake and CR only; requested plans remain input authority, not downstream permission. |
| CR review | CR Review Coordinator route | `Planning Review Coordinator` in `Owner Role` and `Authored By Role` | Main launches through `coord-main-cr-review`, assigns exactly one CR review path as the allowed write surface, and must not write or replace it. |
| Roadmap, phase plan, wave/step plan | Planner | `Planner` | Main launches one planner with the accepted CR/review, assigns the roadmap plus any needed phase and step-plan paths, and limits the planner write surface to that bundle. |
| Planning-bundle review | Plan Review Coordinator route | `Planning Review Coordinator` in `Owner Role` and `Authored By Role` | Main launches through `coord-main-plan-review`, assigns exactly one plan-review path for the roadmap/phase/step bundle as the allowed write surface, and must not write or replace it. |
| Implementation log | Implementation Worker | not guard-checked | Main launches the worker from one accepted step plan, assigns one implementation-log path plus the step-plan write set, and the worker writes that pass log after implementation and worker-local proof. |
| Final integrated proof | Verification Runner | not guard-checked | Main launches the runner with assigned commands and evidence section or log path as the allowed write surface; Main must not substitute proof. |
| Review log | Main Aggregator from Implementation Review Coordinator result | not guard-checked | Main assigns the review-log path before review, the coordinator returns a result only, and Main writes the aggregate from accepted coordinator evidence. |

Generated artifact form and guard-readable fields are owned by
`docs/project/architecture/implementation-artifacts.md`. Role skills repeat the
fields their authors need; caller skills repeat the write-surface contract their
launchers need. Split CR and plan review coordinator names are route and lens
names only; generated CR-review and plan-review artifacts keep the shared
guard-compatible `Planning Review Coordinator` role value.

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

- Behavior changes, user-reported misbehavior, new features, and new
  behavior-bearing concepts must identify their owning behavior harness before
  implementation handoff. Extend the owning harness, create the missing concept
  harness, or report a `Harness Gap` blocker; manual testing may supplement
  but must not replace available production-path harness proof.
- Verification harnesses must not carry fixture-based selftest suites or
  meta-test layers. Behavior harnesses prove production routes or production
  owner APIs; repository policy remains enforced directly in the owning gate.
- New central compile/build/check gates require explicit user request. Adding
  behavior-harness cases, suite ids, focused JavaExec harnesses, or declared
  harness dependencies needed to prove requested behavior is normal
  implementation work. Detailed verification policy lives in
  `docs/project/verification/quality-platforms.md`.
- Work on `AGENTS.md`, any `SKILL.md`, `agents/openai.yaml`, or other
  agent-facing instruction surface must use the global
  `agent-instruction-engineering` skill and follow
  `docs/project/architecture/agent-instructions.md`.
- Work that uses external sources or local source evidence for decisions must
  use the global `source-references` skill and follow
  `docs/project/verification/source-references.md`.
- Global review-specialist routing lives in
  `docs/project/architecture/agent-instructions.md` and in the global
  `coord-*` / `lens-*` review skills; do not create
  SaltMarcher-local copies without an explicit user request.
- Work that plans, implements, refactors, or reviews a SaltMarcher repo-tracked
  change must use the repo-owned `context-hygiene` skill before relying on
  nearby files as precedent. The skill is a routing and context-budget rule; it
  does not authorize new gates or broad documentation rewrites by itself.
- Work that plans, implements, refactors, or reviews a SaltMarcher repo-tracked
  change must use the repo-owned `repo-tools` skill before starting that work.
- Work that plans, implements, refactors, or reviews a SaltMarcher repo-tracked
  governance, architecture, quality, repeated-fix, stale-proof, compatibility,
  or baseline-admission concern must use the repo-owned `project-health` skill
  and the Project Health standard.
- Documentation or governance artifacts must follow the Documentation
  Standard's placement, split, naming, and linking rules before adding or
  extending an owner document, skill, log, or generated artifact.
- CR review must use `coord-main-cr-review`,
  `lens-coordinator-cr-review`, `coord-planning-reviewer`, and
  `lens-cr-artifact`. Planning-bundle review must use
  `coord-main-plan-review`, `lens-coordinator-plan-review`,
  `coord-planning-reviewer`, and `lens-plan-artifact`. Main may record fixes
  but must not synthesize acceptance, edit generated review artifacts, or
  launch artifact/content reviewers directly.
- Work that requires implementation planning, refactor planning, or
  implementation review where existing code behavior, workflow routing,
  build/check logic, or repo-local tool behavior affects the decision must use
  the repo-owned `code-exploration` skill before planning or reviewing from
  nearby files, shared entrypoints, repo-local tools, or tool output.
- Exploration subagents launched for that workflow must use the repo-owned
  `code-exploration-agent` skill before reading or reporting.
- Repo-tracked implementation passes that change production code,
  check/enforcement packages, build or verification wiring, dependency
  surfaces, or agent-facing instruction surfaces must use
  `coord-main-implementation-review` after implementation logging and
  Verification Runner proof. The Implementation Review Coordinator owns the
  required qualitative `code-simplifier` packet, risk-selected specialist
  review, fix-loop coordination, proof-refresh requests, and final clean/WIP/
  blocked result. If that coordinator, its required packet, or required
  tooling is unavailable, the pass remains WIP/blocked; Main must not review or
  run proof as a fallback.
- When review results, architecture checks, behavior harnesses, or required
  proof expose a systemic blocker, Main must use the global `planner` skill to
  obtain a project-health repair plan before implementing the repair. The
  planner optimizes for the long-term target architecture, maintainability, and
  fitting solution shape, not for the shortest immediate unblocker. Systemic
  blockers include unclear root cause, repeated fix cycles, architecture or
  harness mismatch, cross-owner repair, or likely edits across multiple
  packages, documents, checks, or generated surfaces. Adapter stacks,
  ownership-subverting seams, self-confirming harnesses, and
  `LEGACY_REMOVE_ON_TOUCH` hits are Clean-Break signals when their scope is
  larger than an obvious local deletion. Small local blockers with an obvious
  one-file fix do not require this planner escalation.
- Work that runs, plans, changes, or reviews the SaltMarcher
  process-autoresearch loop must use the repo-owned
  `autodev-process-optimizer` skill. The process optimizer tunes implementer
  prompts, slice handoffs, context budgets, model routing, review routing, and
  feedback capture; it must not weaken mandatory SaltMarcher proof, review, or
  publication rules.
- Production-code, check/enforcement, and dependency work must use the
  repo-owned `continuous-refactoring` skill before planning, implementing,
  refactoring, or reviewing. The skill is a workflow rule for keeping cleanup
  inside the normal development pass; it does not authorize new gates or
  repo-wide cleanup waves by itself.
- Every repo-tracked implementation pass must receive one Implementation
  Review Coordinator cycle through `coord-main-implementation-review` and
  `lens-coordinator-implementation-review`. The coordinator applies the global
  adversarial review, coordinator, reviewer-briefing, and handoff lenses as
  method evidence without Main directly launching specialist reviewers. Review
  layers inspect Verification Runner evidence and report stale or missing proof
  instead of rerunning proof tools. If any review/fix role changes tracked
  files, final proof is stale; the coordinator returns `Proof Refresh Required`
  and waits for a fresh Verification Runner result before final aggregation.
  Agent-facing instruction changes must still use
  `agent-instruction-engineering` before that review. A pass without the
  completed coordinator result remains WIP.
- Every repo-tracked implementation pass must write the local implementation
  pass log required by `docs/project/architecture/agent-instructions.md` before
  Verification Runner proof and implementation review. Every completed
  Implementation Review Coordinator cycle must produce the aggregated review
  pass log required by that standard. Read-only
  nested specialist reviewers do not write files directly; they read relevant
  available pass logs and report repeated reversals, looped implementation,
  quality degradation, architecture friction, recurring smells, or
  governance/check misses in their reviewer output so the Implementation
  Review Coordinator can aggregate them.
- When Main is waiting for an implementation, Verification Runner,
  implementation-review, or fix role that may still change the target write
  set, Main must not launch a Verification Runner, quality analysis, review,
  production-handoff, desktop-install, or other expensive sidecar work against
  that same unstable checkout or behavior surface. Before launching such work
  after any wait,
  interruption, resume, or user correction, refresh the active user
  instruction, agent status, worktree dirty paths, and ownership boundary. The
  canonical rule is the Stable-State Barrier in
  `docs/project/architecture/agent-instructions.md`.
- Work under `src/domain/**` must use the repo-owned `domain-layer` skill and
  follow the canonical domain-layer standard before changes are made or
  reviewed.
- Work under `src/features/**` or adjacent feature-runtime governance docs must
  use the repo-owned `feature-runtime` skill and follow the canonical Feature
  Runtime Architecture standard before changes are made or reviewed.
- Work under `src/view/**` must use the repo-owned `view-layer-mvvm` skill and
  follow the canonical cockpit view-layer standard before changes are made or
  reviewed.
- For `src/domain/**`,
  `docs/project/architecture/patterns/domain-layer.md` is the sole
  architectural source of truth and
  `tools/quality/skills/domain-layer/SKILL.md` is the sole operative agent
  guidance. Other docs may only route or summarize; they must not become a
  second source of domain-layer truth.
- For migrated `src/features/**`,
  `docs/project/architecture/patterns/feature-runtime.md` is the sole
  architectural source of truth and
  `tools/quality/skills/feature-runtime/SKILL.md` is the sole operative agent
  guidance. Feature-runtime conformance is review-owned unless a later
  canonical owner names a specific gate.
- For Dungeon domain work under `src/domain/dungeon/**` or `docs/dungeon/**`,
  start at `docs/dungeon/README.md`. Dungeon-specific architecture lives in
  `docs/dungeon/architecture/architecture-dungeon-domain.md`, domain truth in
  `docs/dungeon/domain/domain-dungeon.md`, behavior in
  `docs/dungeon/requirements/`, and proof ownership in
  `docs/dungeon/verification/`. Keep `AGENTS.md` routing-only for that feature.
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
- A pass without the required production-code handoff, focused-handoff proof,
  or documentation-enforcement rerun is incomplete and must remain WIP.
- Parallel agent implementation work may share the repo-root checkout only when
  the caller assigns disjoint write sets and serializes edits to any file that
  more than one agent might touch. Agents must not create linked worktrees or
  per-agent temporary isolation branches for parallel implementation unless the
  user explicitly asks for that workflow.
- For long verification runs where silent execution makes agent-side
  observation unreliable, prefer `tools/gradle/run-observable-gradle.sh`
  instead of shell loops over many separate `./gradlew` invocations. Use
  `tools/gradle/run-staged-verification.sh production-handoff` for the public
  production-code handoff surface and
  `tools/gradle/run-staged-verification.sh focused-handoff --path
  <repo-package-or-resource-dir> [--area <area>]` for package-focused local
  proof. Use `./gradlew checkDocumentationEnforcement --console=plain` for
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
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Implementation Artifact Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/implementation-artifacts.md:1)
- [Global Agent Instruction Engineering Skill](/home/aaron/.codex/skills/local/agent-instruction-engineering/SKILL.md:1)
- [Context Hygiene Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/context-hygiene/SKILL.md:1)
- [Repo Tools Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/repo-tools/SKILL.md:1)
- [Project Health Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/project-health/SKILL.md:1)
- [Main To CR Review Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-main-cr-review/SKILL.md:1)
- [CR Review Coordinator Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-cr-review/SKILL.md:1)
- [Main To Plan Review Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-main-plan-review/SKILL.md:1)
- [Plan Review Coordinator Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-plan-review/SKILL.md:1)
- [Main To Implementation Review Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-main-implementation-review/SKILL.md:1)
- [Implementation Review Coordinator Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/lens-coordinator-implementation-review/SKILL.md:1)
- [Verification Runner Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/verification-runner/SKILL.md:1)
- [Planning Reviewer Briefing Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/coord-planning-reviewer/SKILL.md:1)
- [Installed Code Simplifier Skill](/home/aaron/.codex/plugins/cache/claude-plugins-official/code-simplifier/1.0.0/agents/code-simplifier.md:1)
- [Global Planner Skill](/home/aaron/.codex/skills/local/planner/SKILL.md:1)
- [Domain Layer Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/domain-layer/SKILL.md:1)
- [Feature Runtime Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/feature-runtime/SKILL.md:1)
- [View Layer MVVM Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/view-layer-mvvm/SKILL.md:1)

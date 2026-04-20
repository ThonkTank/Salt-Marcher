# SaltMarcher Working Constitution

This file defines the project-wide documentation and architecture governance for
SaltMarcher. It is intentionally short. It does not hold feature-specific
specifications, long-form target designs, or implementation plans.

## Purpose

SaltMarcher keeps documentation by document type, not by convenience. Each
topic has one canonical home, and every other document may only summarize or
link to it.

Use the documentation tree in this order:

1. `AGENTS.md` for project-wide norms and documentation governance.
2. `docs/architecture/overview.md` for the system shape and major boundaries.
3. `docs/standards/*.md` for reusable standards.
4. `docs/adr/*.md` for individual architecture decisions.
5. co-located feature documents under `src/domain/<feature>/`,
   `src/view/featuretabs/<tab>/`, `src/view/runtimetabs/<state>/`,
   `src/view/dropdowns/<dropdown>/`,
   `src/view/slotcontent/<slot>/<entry>/`, and `src/data/<feature>/`.

## Core Terms

- `Feature`: a project-local vertical slice with view, domain, and data code.
- `Application Service`: the public backend boundary of a feature below the
  view layer.
- `Shell Contribution`: a feature entrypoint that registers UI content with the
  passive shell.
- `Service Contribution`: a feature entrypoint that registers exported runtime
  services with the passive shell.
- `Write Model`: the authored state a feature owns and is allowed to persist.
- `Read Model`: a read-only projection, lookup shape, or query-facing result.
- `Derived State`: any state rebuilt deterministically from the write model.
- `Source of Truth`: the single document that is authoritative for a topic.

## Hard Rules

- `AGENTS.md` contains project-wide rules only.
- System-wide architecture decisions are recorded as ADRs under `docs/adr/`.
- Feature requirements and design documents live next to the owning feature
  code by default.
- Behavior-coupled automated tests are not part of the project strategy; use
  the quality-platform gates plus manual testing instead.
- Verification harnesses must not carry fixture-based selftest suites or
  meta-test layers; enforce repository policy directly in the owning gate.
- New compile/build/check gates require explicit user request. Detailed
  verification policy lives in `docs/standards/quality-platforms.md`.
- Every non-ADR document outside `AGENTS.md` must declare `Status`, `Owner`,
  `Last Reviewed`, and `Source of Truth`.
- Documents must clearly distinguish current state from target state.
- A topic may be summarized in multiple places, but it may be defined in only
  one place.
- Documents above roughly 350 lines must be split by purpose.
- Hypothetical method-level callchains do not belong in product or UI specs.
- Work on agent-facing instruction artifacts must use the repo-owned
  `agent-instruction-engineering` skill and follow the canonical agent
  instruction standard.
- Work under `src/domain/**` must follow the canonical domain-layer standard
  before changes are made or reviewed. The repo-owned `domain-layer` skill is
  supporting guidance only and must not override the canonical standard.
- Work under `src/view/**` must use the repo-owned `view-layer-mvvm` skill and
  follow the canonical cockpit MVVM view-layer standard before changes are made
  or reviewed.
- A change that introduces or alters behavior, architecture, or ownership must
  update the corresponding documentation in the same change.
- The agent workflow below is a mandatory delivery protocol for implementation
  work, not guidance. If a required step cannot run, stop and report the
  blocker explicitly instead of silently continuing.

## Agent Workflow

- Local implementation work happens on `wip/*` branches. `main` is stable
  integration history and must not receive `WIP`, `checkpoint`, or
  dirty-worktree preservation commits.
- Before touching files for an implementation request, run an explicit
  worktree-inspection command and treat it as required preflight, not optional
  context gathering.
- If the worktree has pre-existing local modifications at the start of an
  implementation request, commit the complete current state before making new
  edits. This start-of-task WIP commit is mandatory because it turns prior work
  into the visible baseline and keeps the new implementation isolated in the
  subsequent diff.
- Start-of-task WIP commits must stay on `wip/*` branches and use an explicit
  preservation message such as `wip(<scope>): preserve current state before
  <task>`. If the current branch is `main`, create or switch to a `wip/*`
  branch before making the preservation commit.
- Push WIP branches only when the user requests remote preservation or when the
  current request explicitly requires sharing the WIP state.
- If the start-of-task WIP commit cannot complete exactly as required, report
  the concrete blocker together with the preserved local state instead of
  silently continuing.
- After each completed implementation pass, rerun
  `./gradlew build --console=plain` from the repository root before handoff.
  If you are working inside `src/` or another subdirectory, set the command
  working directory to the repository root instead of using `../gradlew`. A pass
  without that rerun is incomplete and must remain WIP.
- Codex-managed Gradle invocations automatically use per-agent build and
  project-cache directories when `CODEX_THREAD_ID` is present. Non-Codex agents
  that run local Gradle gates concurrently must set a unique
  `SALTMARCHER_GRADLE_ISOLATION_ID`; do not reuse another agent's isolation id.
- When the desktop app is the manual test surface, run
  `./gradlew installDesktopApp` after the successful build before handoff
  unless the user explicitly waives reinstall or the task is purely non-code
  planning or review work.
- Stable handoff or release commits must be separate from WIP preservation
  commits. A stable commit may be created only after the required build and any
  applicable install step have completed successfully, and it must not use a
  `wip`, `WIP`, or `checkpoint` message.
- Every implementation handoff must state the literal status of the preflight
  worktree inspection, start-of-task WIP commit, WIP push handling,
  `./gradlew build`, stable commit handling, and `./gradlew installDesktopApp`
  when applicable. If any step did not run, say that directly and give the
  concrete reason.
- Verification claims must be literal. Do not claim that commit, push, build,
  or install steps happened unless they actually ran.

## Document Types

- `docs/architecture/overview.md`
  Current system-wide architecture summary.
- `docs/standards/*.md`
  Reusable standards such as documentation rules, repository structure, shell
  registration, and quality tooling.
- `docs/adr/NNN-*.md`
  One architecture decision per file.
- `src/domain/<feature>/README.md`
  Entry point for a feature's documentation set.
- `src/domain/<feature>/SPEC.md`
  Product and behavior specification.
- `src/domain/<feature>/DOMAIN.md`
  Canonical domain model, ownership, invariants, and derived-state rules.
- `src/view/featuretabs/<tab>/UI.md`,
  `src/view/runtimetabs/<state>/UI.md`,
  `src/view/dropdowns/<dropdown>/UI.md`, or
  `src/view/slotcontent/<slot>/<entry>/<topic>.md`
  UI structure, interaction model, and user-visible states for one tab,
  runtime state-panel tab, dropdown window, detail entry, or reusable
  slotcontent unit.
- `src/data/<feature>/PERSISTENCE.md`
  Persistence contracts, schema ownership, and adapter rules.
- `src/domain/<feature>/DELIVERY.md`
  Temporary implementation plan, risks, and phased rollout notes.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/documentation.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/agent-instructions.md:1)
- [Domain Layer Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/domain-layer/SKILL.md:1)
- [View Layer MVVM Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/view-layer-mvvm/SKILL.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [ADR 001: Documentation Governance](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/001-documentation-governance.md:1)
- [ADR 002: Passive Shell And Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 019: Shell Cockpit MVVM Contribution View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1)

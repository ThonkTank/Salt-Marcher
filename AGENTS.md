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
3. `docs/architecture/standards/*.md` for reusable standards.
4. `docs/adr/*.md` for individual architecture decisions.
5. co-located feature documents under `src/domain/<feature>/`,
   `src/view/<component>/`, and `src/data/<feature>/`.

## Core Terms

- `Feature`: a project-local vertical slice with view, domain, and data code.
- `Feature API`: the public backend boundary of a feature below the view layer.
- `Shell Contribution`: a feature entrypoint that registers UI content with the
  passive shell.
- `Persistence Contribution`: a feature entrypoint that registers exported
  persistence capabilities.
- `Canonical Truth`: the authored state that is allowed to persist.
- `Derived State`: any state rebuilt deterministically from canonical truth.
- `Source of Truth`: the single document that is authoritative for a topic.

## Hard Rules

- `AGENTS.md` contains project-wide rules only.
- System-wide architecture decisions are recorded as ADRs under `docs/adr/`.
- Feature requirements and design documents live next to the owning feature
  code by default.
- Behavior-coupled automated tests are not part of the project strategy; use
  the quality-platform gates plus manual testing instead.
- New compile/build/check gates require explicit user request. Detailed
  verification policy lives in `docs/architecture/standards/quality-platforms.md`.
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
- A change that introduces or alters behavior, architecture, or ownership must
  update the corresponding documentation in the same change.
- The agent workflow below is a mandatory delivery protocol for implementation
  work, not guidance. If a required step cannot run, stop and report the
  blocker explicitly instead of silently continuing.

## Agent Workflow

- Before touching files for an implementation request, run an explicit
  worktree-inspection command and treat it as required preflight, not optional
  context gathering.
- If pre-existing local modifications are present, handle them explicitly as a
  dirty-worktree preservation step before the requested implementation. This
  step exists to save the current state, not to forbid implementation by
  default.
- Dirty-worktree preservation may commit and push the existing changes when
  that is the requested or safest way to preserve them.
- If preservation cannot complete exactly as requested, report the concrete
  blocker explicitly together with the preserved local state instead of
  silently continuing.
- After each completed implementation pass, rerun `./gradlew build` before
  handoff. A pass without that rerun is incomplete.
- When the desktop app is the manual test surface, run
  `./gradlew installDesktopApp` after the successful build before handoff
  unless the user explicitly waives reinstall or the task is purely non-code
  planning or review work.
- Every implementation handoff must state the literal status of the preflight
  worktree inspection, dirty-worktree commit/push handling, `./gradlew build`,
  and `./gradlew installDesktopApp` when applicable. If any step did not run,
  say that directly and give the concrete reason.
- Verification claims must be literal. Do not claim that commit, push, build,
  or install steps happened unless they actually ran.

## Document Types

- `docs/architecture/overview.md`
  Current system-wide architecture summary.
- `docs/architecture/standards/*.md`
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
- `src/view/<component>/UI.md`
  UI structure, interaction model, and user-visible states for one component.
- `src/data/<feature>/PERSISTENCE.md`
  Persistence contracts, schema ownership, and adapter rules.
- `src/domain/<feature>/DELIVERY.md`
  Temporary implementation plan, risks, and phased rollout notes.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/documentation.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/agent-instructions.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Shell And Discovery Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/shell-and-discovery.md:1)
- [ADR 001: Documentation Governance](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/001-documentation-governance.md:1)
- [ADR 002: Passive Shell And Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)

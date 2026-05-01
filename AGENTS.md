# SaltMarcher Working Constitution

This file defines the project-wide documentation and architecture governance for
SaltMarcher. It is intentionally short. It does not hold feature-specific
specifications, long-form target designs, or implementation plans.

Global workspace rules live in
`/home/aaron/Schreibtisch/projects/AGENTS.md` and apply to SaltMarcher unless
this file adds a stricter SaltMarcher-specific rule.

## Purpose

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

## Core Terms

- `Feature`: a project-local vertical slice with view, domain, and data code.
- `Application Service`: the public backend boundary of a feature below the
  view layer.
- `Shell Contribution`: a feature entrypoint that registers UI content with the
  passive shell.
- `Service Contribution`: a feature entrypoint that registers exported runtime
  services with the passive shell.
- `Write Model`: the authored state a feature owns and is allowed to persist.
- `Outbound Port`: a domain-owned interface that states what the application
  core needs from an outer adapter.
- `Derived State`: any state rebuilt deterministically from the write model.
- `Source of Truth`: the single document that is authoritative for a topic.

## SaltMarcher Rules

- Behavior-coupled automated tests are not part of the project strategy; use
  the quality-platform gates plus manual testing instead.
- Verification harnesses must not carry fixture-based selftest suites or
  meta-test layers; enforce repository policy directly in the owning gate.
- New compile/build/check gates require explicit user request. Detailed
  verification policy lives in `docs/project/verification/quality-platforms.md`.
- Work under `src/domain/**` must follow the canonical domain-layer standard
  before changes are made or reviewed. The repo-owned `domain-layer` skill is
  supporting guidance only and must not override the canonical standard.
- Work under `src/view/**` must use the repo-owned `view-layer-mvvm` skill and
  follow the canonical cockpit view-layer standard before changes are made or
  reviewed.

## SaltMarcher Verification

- After each completed implementation pass that changes production code, rerun
  `./gradlew build --console=plain` from the repository root before handoff.
  If you are working inside `src/` or another subdirectory, set the command
  working directory to the repository root instead of using `../gradlew`.
- After each completed implementation pass limited to one or more concrete
  check or enforcement packages under `tools/quality/**`,
  `tools/gradle/build-harness/**`,
  `tools/quality/rules/quality-rules/**`,
  `tools/quality/incubator/quality-rules-errorprone/**`,
  `tools/quality/enforcement-bundles.gradle.kts`, or verification-only wiring
  in `build.gradle.kts` / `settings.gradle.kts`, rerun only the corresponding
  focused package or bundle task or tasks from the repository root before
  handoff instead of the full build. If such a pass touches shared check
  wiring, rerun the focused entrypoints for the actually affected packages; a
  broader package wave must be explicit and does not automatically become a
  full build.
- After each completed documentation-only pass limited to `AGENTS.md`,
  `docs/**`, `src/domain/**/DOMAIN.md`, or Markdown files under
  `tools/quality/**`, rerun
  `./gradlew checkDocumentationEnforcement --console=plain` from the repository
  root before handoff instead of the full build.
- A pass without the required production-code full build, check-only
  package/bundle rerun, or documentation-enforcement rerun is incomplete and
  must remain WIP.
- Wrapper-based Gradle invocations automatically use per-invocation build and
  project-cache directories. They also isolate `GRADLE_USER_HOME`, seed wrapper
  content into that repo-local invocation home, expose a shared read-only
  dependency cache snapshot through `GRADLE_RO_DEP_CACHE`, and run the shared
  included builds through a per-invocation composite mirror so parallel builds
  do not contend on wrapper, cache, or included-build state.
- For long verification runs where silent execution makes agent-side
  observation unreliable, prefer `tools/gradle/run-observable-gradle.sh`
  instead of shell loops over many separate `./gradlew` invocations. Use
  `tools/gradle/run-observable-gradle.sh build` for production-code handoff
  and pass the corresponding focused task list explicitly for check-only or
  documentation-only reruns. The canonical public proof tasks themselves
  remain the existing `./gradlew build`,
  `./gradlew checkDocumentationEnforcement`, and
  `./gradlew check*Enforcement` entrypoints.
- `CODEX_THREAD_ID` and `SALTMARCHER_GRADLE_ISOLATION_ID` remain trace labels
  for local Gradle invocations, but they no longer decide whether wrapper-based
  isolation happens.
- Wrapper-based local Gradle runs now delete their per-invocation isolation
  roots after the run finishes. Successful artifact-producing runs overwrite the
  stable export surface at `build/latest-output/`; failed or interrupted runs
  keep only selected diagnostics under `build/retained-gradle-failures/` for up
  to seven days.
- When the desktop app is the manual test surface, run
  `./gradlew installDesktopApp` after the successful build before handoff
  unless the user explicitly waives reinstall, the task is documentation-only,
  or the task is purely non-code planning or review work.

## Document Types

- `docs/project/<type>/*.md`
  Project-wide canonical docs where `<type>` is one of `architecture`,
  `requirements`, `contract`, `domain`, `delivery`, or `verification`.
- `docs/<feature>/<type>/*.md`
  Feature-owned canonical docs using the same closed six-type set.
- some feature folders may intentionally omit `domain`, `contract`,
  `delivery`, or `verification` files when they own no write model,
  persistence truth, rollout notes, or separate proof surface.

## References

- [Global Workspace Rules](/home/aaron/Schreibtisch/projects/AGENTS.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/agent-instructions.md:1)
- [Source References Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/source-references.md:1)
- [Global Source References Skill](/home/aaron/.codex/skills/local/source-references/SKILL.md:1)
- [Global Agent Instruction Engineering Skill](/home/aaron/.codex/skills/local/agent-instruction-engineering/SKILL.md:1)
- [Domain Layer Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/domain-layer/SKILL.md:1)
- [View Layer MVVM Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/view-layer-mvvm/SKILL.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)

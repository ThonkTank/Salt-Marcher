# SaltMarcher Agent Guide

## Build & Verify

Always run verification from the repository root.

- Production-code changes: `tools/gradle/run-staged-verification.sh production-handoff`
- Package-limited check/enforcement work: `tools/gradle/run-staged-verification.sh focused-handoff --path <pkg> [--area <area>]`
- Documentation-only changes (`AGENTS.md`, `docs/**`, `src/domain/**/DOMAIN.md`, Markdown under `tools/quality/**`): `./gradlew checkDocumentationEnforcement --console=plain`
- Desktop manual-test surface: `tools/gradle/run-staged-verification.sh desktop-install` after a green production-handoff
- Long runs: `tools/gradle/run-observable-gradle.sh <task>`; do not loop many separate `./gradlew` calls

## Hard Rules

1. Work on a feature branch. Do not commit to `main`; merge through a PR with green CI.
2. A pass whose required verify command has not literally passed is WIP. Report the literal result at handoff.
3. Architecture is enforced by `tools/gradle/build-harness` and Error Prone rules. Do not weaken, disable, suppress, or bypass a check to make a build pass; report a blocker instead.
4. Transitional or superseded support you knowingly leave behind gets a `LEGACY_REMOVE_ON_TOUCH` marker plus a concrete removal condition. When your write set contains such a marker, remove the marked support in the same pass or report it as a blocker.
5. Structural findings you cannot fix in the same pass get a `PROJECT_HEALTH_DEBT` marker at the primary cause and an entry in `docs/project/architecture/project-health-debt.md`.
6. Before editing a surface, read its owner doc and skill from the table below. If a surface has no clear owner, stop and report instead of creating a second source of truth.
7. Behavior changes and new behavior-bearing concepts need an owning behavior harness: extend it, create it, or report a `Harness Gap` blocker. Harnesses prove production routes; avoid fixture selftests and meta-test layers. New central build/check gates require explicit user request.
8. Record notable decisions, incidents, and repeated fixes in `docs/project/journal/YYYY-MM.md`; see `docs/project/architecture/work-logs.md`.

## Surface Owners

| Surface | Owner doc | Mandatory skill |
| --- | --- | --- |
| `src/domain/**` | `docs/project/architecture/patterns/domain-layer.md` | `domain-layer` |
| `src/features/**` | `docs/project/architecture/patterns/feature-runtime.md` | `feature-runtime` |
| `src/view/**` | `docs/project/architecture/patterns/view-layer.md` | `view-layer-mvvm` |
| `src/domain/dungeon/**`, `docs/dungeon/**` | `docs/dungeon/README.md` | - |
| Documentation placement | `docs/project/architecture/documentation.md` | - |
| Verification policy | `docs/project/verification/quality-platforms.md` | - |
| Workflow, roles, logs | `docs/project/architecture/agent-instructions.md` | - |
| Agent instruction surfaces (`AGENTS.md`, `SKILL.md`, `agents/openai.yaml`) | `docs/project/architecture/agent-instructions.md` | `agent-instruction-engineering` |
| Autonomous documentation-upkeep slices | `docs/project/architecture/documentation.md` | `documentation-upkeep-steward` |
| External-source-backed decisions | `docs/project/verification/source-references.md` | `source-references` |

## Workflow

Classify each task by tier as defined in `docs/project/architecture/agent-instructions.md`:

- **S**: docs-only or trivial mechanical fix. Edit directly and run the matching gate.
- **M**: standard code change. State a short plan in the PR or log, implement, run proof, get one judge review, and merge on green CI.
- **L**: architecture, governance, cross-cutting, or dependency change. Write a one-page journal design note first, unless the user explicitly waives it, then proceed as M.

Skills live in `tools/quality/skills/<name>/SKILL.md`. Read a skill when this file, an owner doc, or the task surface names it, not speculatively.

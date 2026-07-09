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
3. Outcome checks stay binding: cycles, layer direction, behavior harnesses, and doc link/placement basics. Do not weaken, suppress, or bypass them; architecture-migration form checks are removed under `docs/project/architecture/architecture-migration-roadmap.md` instead of treated as architecture truth.
4. Transitional or superseded support you knowingly leave behind gets a `LEGACY_REMOVE_ON_TOUCH` marker plus a concrete removal condition. When your write set contains such a marker, remove the marked support in the same pass or record a concrete repair target.
5. Structural findings you cannot fix in the same pass get a `PROJECT_HEALTH_DEBT` marker at the primary cause and an entry in `docs/project/architecture/project-health-debt.md`.
6. Before editing a surface, read its owner doc and skill from the table below. If a surface has no clear owner, create a narrow documentation repair target instead of creating a second source of truth.
7. Behavior changes and new behavior-bearing concepts need an owning behavior harness: extend it, create it, or record a `Harness Gap` repair target. Harnesses prove production routes; avoid fixture selftests and meta-test layers. New central build/check gates require explicit user request.
8. Record notable decisions, incidents, and repeated fixes in `docs/project/journal/YYYY-MM.md`; see `docs/project/architecture/work-logs.md`.
9. Risk class is mandatory on PRs: R0 docs/comments/small reversible refactor;
   R1 behavior-neutral structure, architecture, dependency, or tooling; R2
   visible behavior; R3a real local data migration; R3b external service,
   cost, account, or data egress; R3c frozen gate surface.
10. The owner decides stable acceptance, data, cost, and outside-policy
    consent. The system decides technical matters autonomously; see
    `docs/project/architecture/autonomy-boundaries.md`.
11. Forbidden autonomous actions: real local data modification without a
    restore-tested backup; enabling paid services or moving secrets; external
    data transmission outside `docs/project/policies/resource-policy.md`;
    silent R2 behavior; merge with red or skipped required checks.
12. When product options exist, implement the recommended option as provisional
    R2 on `main`/next, flag it in the German release note and status report,
    and do not promote to stable before owner acceptance.
13. For owner-reported bugs or features, first restate expected behavior,
    reproduction, acceptance criteria, affected surfaces, and proof route in
    the issue; then implement.

## Risk Classes

- `R0`: docs/comments/small reversible refactor; doc gate or production-handoff; auto-promote.
- `R1`: behavior-neutral structure, architecture, dependency, or tooling; R0 plus touched behavior harnesses and judge review; auto-promote.
- `R2`: visible behavior; R1 plus German release note and acceptance checklist; auto-promote as provisional next/main work, promote to stable only after owner acceptance.
- `R3a`: real local data migration; verified restore-tested backup and copy dry run; auto-promote after backup proof.
- `R3b`: external service, cost, account, or data egress; must fit `docs/project/policies/resource-policy.md`; outside-policy work creates a policy/no-action PR instead of blocking in chat.
- `R3c`: frozen gate surface; requires R3c label and the full required gate set; auto-promote after merge. Roadmap-governed migration passes are R1; the R3c freeze does not apply to required doctrine-gate removal.

## Surface Owners

| Surface | Owner doc | Mandatory skill |
| --- | --- | --- |
| Migration source areas (`src/domain/**`, `src/features/**`, `src/view/**`) | `docs/project/architecture/architecture-migration-roadmap.md`; `docs/project/architecture/migration-ledger.md` once created | - |
| `src/domain/dungeon/**`, `docs/dungeon/**` | `docs/dungeon/README.md` | - |
| Documentation placement | `docs/project/architecture/documentation.md` | - |
| Verification policy | `docs/project/verification/quality-platforms.md` | - |
| Workflow, roles, logs | `docs/project/architecture/agent-instructions.md` | - |
| Agent instruction surfaces (`AGENTS.md`, `SKILL.md`, `agents/openai.yaml`) | `docs/project/architecture/agent-instructions.md` | `agent-instruction-engineering` |
| Autonomous documentation-upkeep slices | `docs/project/architecture/documentation.md` | `documentation-upkeep-steward` |
| External-source-backed decisions | `docs/project/verification/source-references.md` | `source-references` |
| Resource policy and operating model | `docs/project/policies/resource-policy.md`, `docs/project/decisions/**` | - |

Legacy migration areas match surrounding code; migrated areas match the pilot reference named in the ledger. Harness Gap repair targets reference `docs/project/verification/harness-gaps.md`. Autonomous decision boundaries are defined in `docs/project/architecture/autonomy-boundaries.md`.

## Workflow

Classify each task by tier as defined in `docs/project/architecture/agent-instructions.md`:

- **S**: docs-only or trivial mechanical fix. Edit directly and run the matching gate.
- **M**: standard code change. State a short plan in the PR or log, implement, run proof, get one judge review, and merge on green CI.
- **L**: architecture, governance, cross-cutting, or dependency change. Write a one-page journal design note first, unless the user explicitly waives it, then proceed as M.

Architecture migration passes follow `docs/project/architecture/architecture-migration-roadmap.md`; the roadmap wins, carries the migration design obligation, and requires behavior parity, no owner questions, no security analysis, no pause/throttle/stop mechanisms, and frozen harness scenarios/assertions except separate wiring ports.

Skills live in `tools/quality/skills/<name>/SKILL.md`. Read a skill when this file, an owner doc, or the task surface names it, not speculatively.

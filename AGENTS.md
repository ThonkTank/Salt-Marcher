# SaltMarcher Agent Guide

## Build & Verify

Always run verification from the repository root.

- Production-code changes: `tools/gradle/run-staged-verification.sh production-handoff`
- Package-limited check/enforcement work: `tools/gradle/run-staged-verification.sh focused-handoff --path <pkg> [--area <area>]`
- Documentation-only changes (`AGENTS.md`, `docs/**`, `src/domain/**/DOMAIN.md`, Markdown under `tools/quality/**`): `git diff --check` plus any owner-named proof for the changed surface
- Desktop manual-test surface: `tools/gradle/run-staged-verification.sh desktop-install` after a green production-handoff
- Long runs: `tools/gradle/run-observable-gradle.sh <task>`; do not loop many separate `./gradlew` calls

## Hard Rules

1. Work on a feature branch. Do not commit to `main`; merge through a PR with green CI.
2. A pass whose required verify command has not literally passed is WIP. Report the literal result at handoff.
3. Outcome checks stay binding: cycles, layer direction, behavior harnesses, and owner-named proof. Do not weaken, suppress, or bypass them.
4. Fix structural, governance, compatibility, and legacy-removal findings inside the scoped pass when proportional. Otherwise name the blocker in the PR or open a scoped GitHub issue; do not create a parallel debt system.
5. Before editing a surface, read its owner doc and skill from the table below. If a surface has no clear owner, create a narrow documentation repair target instead of creating a second source of truth.
6. Behavior changes and new behavior-bearing concepts need an owning behavior harness: extend it, create it, or record a `Harness Gap` repair target. Harnesses prove production routes; avoid fixture selftests and meta-test layers. New central build/check gates require explicit user request.
7. L-tier changes add the short design or incident note required by `docs/project/architecture/agent-instructions.md` and an ADR when `docs/project/documentation.md` requires one. Do not journal routine progress.
8. Risk class is mandatory on PRs: R0 docs/comments/small reversible refactor;
   R1 behavior-neutral structure, architecture, dependency, or tooling; R2
   visible behavior; R3a real local data migration; R3b external service,
   cost, account, or data egress; R3c frozen gate surface.
9. The owner decides stable acceptance, data, cost, and outside-policy
   consent. The system decides technical matters autonomously; see
   `docs/project/architecture/autonomy-boundaries.md`.
10. Forbidden autonomous actions: real local data modification without a
    restore-tested backup; enabling paid services or moving secrets; external
    data transmission outside `docs/project/policies/resource-policy.md`;
    silent R2 behavior; merge with red or skipped required checks.
11. When product options exist, implement the recommended option as provisional
    R2 on `main`/next, flag it in the PR's owner-visible behavior section, and
    do not promote to stable before owner acceptance.
12. For owner-reported bugs or features, first restate expected behavior,
    reproduction, acceptance criteria, affected surfaces, and proof route in
    the issue; then implement.

## Risk Classes

- `R0`: docs/comments/small reversible refactor; owner-named proof or production-handoff; auto-promote.
- `R1`: behavior-neutral structure, architecture, dependency, or tooling; R0 plus touched behavior harnesses and independent review; auto-promote.
- `R2`: visible behavior; R1 plus one plain sentence in the PR on what the owner will see change; auto-promote as provisional next/main work, promote to stable only after owner acceptance.
- `R3a`: real local data migration; verified restore-tested backup and copy dry run; auto-promote after backup proof.
- `R3b`: external service, cost, account, or data egress; must fit `docs/project/policies/resource-policy.md`; outside-policy work creates a policy/no-action PR instead of blocking in chat.
- `R3c`: frozen gate surface; requires R3c label and the full required gate set; auto-promote after merge.

## Surface Owners

| Surface | Owner doc | Mandatory skill |
| --- | --- | --- |
| Source architecture (`bootstrap/**`, `shell/**`, `src/**`, `src/data/**`) | `docs/project/architecture/source-architecture.md` | - |
| `src/domain/dungeon/**`, `docs/dungeon/**` | `docs/dungeon/README.md` | - |
| Documentation placement | `docs/project/documentation.md` | - |
| Verification policy | `docs/project/verification/quality-platforms.md` | - |
| Workflow, roles, logs | `docs/project/architecture/agent-instructions.md` | - |
| Agent instruction surfaces (`AGENTS.md`, `SKILL.md`, `agents/openai.yaml`) | `docs/project/architecture/agent-instructions.md` | `agent-instruction-engineering` |
| Project delivery documents | `docs/project/documentation.md` | `delivery` |
| External-source-backed decisions | `docs/project/verification/source-references.md` | `source-references` |
| Resource policy and operating model | `docs/project/policies/resource-policy.md`, `docs/project/decisions/**` | - |

Harness Gap repair targets reference `docs/project/verification/harness-gaps.md`. Autonomous decision boundaries are defined in `docs/project/architecture/autonomy-boundaries.md`.

## Workflow

Classify each task S/M/L per the Tier Model in
`docs/project/architecture/agent-instructions.md`, then follow that tier.

Repository skills live under `tools/quality/skills/`; mandatory global skills such as `agent-instruction-engineering`, `delivery`, `architecture`, and `verification` resolve from the installed skill registry. Read only named skills, not speculative ones.

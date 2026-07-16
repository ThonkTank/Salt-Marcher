# SaltMarcher Agent Guide

## Build And Verify

Run verification from the repository root.

- Required local and CI proof: `./gradlew check`
- Diagnostics: `./gradlew test`, `./gradlew uiTest`, `./gradlew architectureTest`
- Documentation-only changes: `git diff --check`
- Desktop install after a green check: `./gradlew installDesktopApp`

`check` is the only merge-blocking proof. A change without a literal green
`check` is work in progress.

## Delivery Rules

Standing owner approval: for work in this repository, push only the owned
feature branch to the configured `origin`, open or update its pull request, and
merge it only after required CI is green. Do not request additional permission
for those standard publication steps. This approval does not cover other
remotes, unrelated branches, red or skipped required checks, real user data,
secrets, paid services, or external data transmission.

1. Work on a feature branch and merge through a pull request with green CI.
2. Implement a clear request directly. Add planning or coordination only when
   it resolves concrete uncertainty or the user explicitly requests it.
3. Preserve accepted observable behavior. Tests exercise production routes;
   fixture self-tests, private reflection, and meta-test layers are not product
   proof.
4. Fix structural and legacy-removal findings in the scoped change when
   practical. Otherwise open a focused issue; do not create a parallel debt,
   marker, registry, or status system.
5. Read the owner document for a surface before changing its durable behavior
   or architecture. Keep one source of truth per concern.
6. The owner decides stable behavior acceptance, real user-data changes, paid
   services, secret handling, and external data transmission. Technical design,
   CI repair, refactoring, and test structure are autonomous decisions.
7. Never modify real local data without a restore-tested backup, enable paid
   services, expose or move secrets, transmit real user data, or merge with a
   red/skipped required check.
8. For owner-reported behavior, capture the expected observable result,
   reproduction, acceptance criteria, and proof route before changing code.

## Surface Owners

| Surface | Owner document | Required skill |
| --- | --- | --- |
| Source architecture (target `app/**`, `shell/**`, `platform/**`, `features/**`; legacy production roots while migration is active) | `docs/project/architecture/source-architecture.md` | - |
| `features/dungeon/**`, legacy Dungeon production code while migration is active, `docs/dungeon/**` | `docs/dungeon/README.md` | - |
| Documentation placement | `docs/project/documentation.md` | - |
| Verification policy | `docs/project/verification/quality-platforms.md` | `verification` |
| Agent instructions | `docs/project/architecture/agent-instructions.md` | `agent-instruction-engineering` |
| External-source-backed decisions | `docs/project/verification/source-references.md` | `source-references` |
| Resource policy | `docs/project/policies/resource-policy.md` | - |

Repository skills live under `tools/quality/skills/`. Read a skill only when
the requested surface names it.

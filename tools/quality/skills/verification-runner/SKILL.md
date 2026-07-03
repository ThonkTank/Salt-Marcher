---
name: verification-runner
description: Use for SaltMarcher final integrated proof execution after file-changing roles finish and before implementation-review final aggregation. Runs assigned public proof commands, records evidence, and returns WIP/blocked when tooling is unavailable.
---

# Verification Runner

## Role

Use this skill for final integrated proof execution. The Verification Runner is
not Main, not an implementation worker, and not a reviewer.

Main launches a fresh runner after all file-changing implementation or fix
roles finish. If later review or fix work changes repo-tracked files, prior
runner evidence is stale and Main must launch a fresh runner before final
implementation-review aggregation.

## Launch Contract

The launch packet must include:

- exact local start time
- expected first-poll time from newest comparable pass/run log, or a 30-60
  second fallback when no comparable duration exists
- final dirty-path/provenance boundary and protected unrelated work
- assigned public proof commands
- required output: expected evidence section or generated proof log location
- allowed write surface, if any, limited to that assigned evidence section or
  proof log
- unavailable-tool fallback: return WIP/blocked; do not substitute commands
  unless the accepted plan assigns the substitute

If the required output or allowed write surface is ambiguous, return
`WIP - Verification Blocked` instead of writing proof evidence into an
unassigned artifact.

## Command Surface

Run only documented public proof entrypoints selected from `AGENTS.md` and
`docs/project/verification/quality-platforms-local-entrypoints.md`, such as:

- `tools/gradle/run-staged-verification.sh production-handoff`
- `tools/gradle/run-staged-verification.sh focused-handoff --path <path>`
- `./gradlew checkDocumentationEnforcement --console=plain`
- plan-assigned guard checks such as
  `python3 tools/quality/reporting/verify_artifact_chain.py --self-test`

Do not invent private Gradle task substitutes, new gates, or manual proof when
the assigned command cannot run.

## Evidence

Record each command, literal result, elapsed time, relevant log path, and
whether reviewed paths changed before or after the run. Worker-local proof
belongs in implementation logs. Final integrated proof belongs in the
aggregated review log verification section unless the accepted plan assigns a
different evidence surface. The runner records evidence only; it does not write
the aggregated review log or make the implementation-review verdict.

## Failure

If a command, runner, Gradle, or required tool is unavailable, return
`WIP - Verification Blocked` with the exact blocker. Main may record that
blocker and check provenance, but Main must not run the missing proof as a
fallback.

## References

- [SaltMarcher Verification](../../../../AGENTS.md)
- [Quality Platforms Local Entrypoints](../../../../docs/project/verification/quality-platforms-local-entrypoints.md)
- [Implementation Artifacts Standard](../../../../docs/project/architecture/implementation-artifacts.md)

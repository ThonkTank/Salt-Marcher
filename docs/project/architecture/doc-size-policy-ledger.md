Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: Current implementation state for the document size and focus
roadmap in `docs/project/architecture/doc-size-policy-vision-and-roadmap.md`.

# Document Size Policy Ledger

## Purpose

This ledger is the single status source for replacing the hard Markdown size
cap with the document-size policy roadmap. It records the current milestone,
proof state, and later work. Chat summaries and pass logs may describe work,
but they do not advance this roadmap unless this ledger advances too.

## State Rules

- At most one document-size policy work item may be `In Flight`.
- Source-area architecture migration state remains owned by
  `migration-ledger.md`.
- Size may be reported as a signal, but size alone must not create a build
  failure.
- Split enforcement that requires live issue knowledge is deferred until the
  M2 mechanical-support work defines and self-tests it.

## Current Position

| Field | Value |
| --- | --- |
| Branch | `codex/architecture-migration-m0-charter` |
| Milestone | M4 - Specification amendment and unblock |
| Work item | Complete |
| Cycle step | Done |
| In-flight area | Documentation specification |
| Required next proof | None. New owner intent capture may start with the prepared goal-interview transcript. |
| Last status note | `2026-07-10 M4 complete` |

## M0 Step Ledger

| Step | Status | Local branch commit | Proof | Notes |
| --- | --- | --- | --- | --- |
| Roadmap home | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-10; `git diff --check` passed, 2026-07-10 | Moved the owner-provided roadmap to `docs/project/architecture/doc-size-policy-vision-and-roadmap.md` and marked it Active by explicit implementation request. |
| Enforcement document update | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-10; `git diff --check` passed, 2026-07-10 | `documentation.md` now defines 400 lines as a soft signal and forbids omission, compression, or relocation because of size. |
| Gate inversion | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-10; `git diff --check` passed, 2026-07-10 | `DocumentationHygieneRules` reports documents above 400 lines but does not add a violation for size. |
| Agent instruction | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-10; `git diff --check` passed, 2026-07-10 | `AGENTS.md` carries the anti-omission `doc-split` rule without increasing file line count. |

## Milestone Ledger

| Milestone | Status | Done-when evidence |
| --- | --- | --- |
| M0 - Stop the bleeding | Done in working tree | No mechanical size failure remains; anti-omission instruction present; `./gradlew checkDocumentationEnforcement --console=plain` and `git diff --check` passed on 2026-07-10. |
| M1 - Split protocol | Done in working tree | `doc-split-protocol.md` Active, judge checklist referenced, pilot split executed from `documentation.md` to `documentation-templates.md`, and independent judge review approved with no Must Fix findings. |
| M2 - Mechanical support | Done in working tree | Three cheap checks with self-tests run in `checkDocumentationEnforcement`, and independent judge false-positive review approved with no Must Fix findings. |
| M3 - Damage repair | Done in working tree | Hex documentation audited with no repair required; remaining features have prioritized `doc-repair` issues #423 through #431; independent judge approved with no Must Fix findings. |
| M4 - Specification amendment and unblock | Done in working tree | Specification Active with Document Size & Focus section; roadmap artifact Deprecated with successor pointer; goal interview scheduled. |

## M1 Step Ledger

| Step | Status | Local branch commit | Proof | Notes |
| --- | --- | --- | --- | --- |
| Split protocol | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-10; independent judge Approve, no Must Fix findings | Added `doc-split-protocol.md` with trigger rules, seam selection, zero-loss rule, same-commit obligations, and five-point judge checklist. |
| Review instruction reference | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-10; independent judge Approve, no Must Fix findings | `agent-instructions.md` routes documentation split reviews to the protocol checklist without increasing line count. |
| Pilot split | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-10; independent judge Approve, no Must Fix findings | Split required documentation templates from `documentation.md` into `documentation-templates.md`; trigger is mixed scope, not line count. |

## M2 Step Ledger

| Step | Status | Local branch commit | Proof | Notes |
| --- | --- | --- | --- | --- |
| Documents above 400 need `doc-split` issue check | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed with `Documentation self-tests passed.`, 2026-07-10 | Implemented as `documentation-size-split-issue`; documents above 400 lines must contain `doc-split` and an issue reference. |
| Directory README index completeness check | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed with `Documentation self-tests passed.`, 2026-07-10 | Implemented as `documentation-index-completeness`; repaired current README coverage to satisfy the check. |
| Duplicate `Source of Truth` detection | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed with `Documentation self-tests passed.`, 2026-07-10 | Implemented as `documentation-source-of-truth-unique`. |
| False-positive review | Done in working tree | Pending | Independent judge Approve, no Must Fix findings | Judge accepted the local `doc-split` issue interpretation, all-doc index scope, and self-test coverage as sufficient for M2. |

## M3 Step Ledger

| Step | Status | Local branch commit | Proof | Notes |
| --- | --- | --- | --- | --- |
| Hex documentation damage audit | Done in working tree | Pending | Pending documentation proof | `doc-size-policy-hex-repair-audit.md` found no Hex docs near the old cap, no cap-shaped compression commit, and no confirmed size-caused scatter. |
| Hex repair | Done in working tree | Pending | Pending documentation proof | No Hex repair required because the audit found no confirmed old-cap damage. |
| Remaining feature repair issues | Done in working tree | Pending | Pending documentation proof and judge review | Filed prioritized `doc-repair` issues: dungeon #423, world planner #424, session planner #425, maps #427, encounter #426, party #428, creatures #429, encounter table #431, and deprecated travel #430. |
| M3 proof and judge review | Done in working tree | Pending | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-10; `git diff --check` passed, 2026-07-10; independent judge Approve, no Must Fix findings | Judge confirmed Hex audit satisfies the M3 pilot and issue queue #423 through #431 is prioritized and sufficient. |

## M4 Step Ledger

| Step | Status | Local branch commit | Proof | Notes |
| --- | --- | --- | --- | --- |
| Specification amendment | Done in working tree | Pending | Pending final documentation proof and judge review | `documentation-specification.md` is Active and includes the new `Document Size & Focus` section. |
| Completed roadmap marker | Done in working tree | Pending | Pending final documentation proof and judge review | `doc-size-policy-vision-and-roadmap.md` is Deprecated by the specification and marks the roadmap complete in working tree. |
| Goal interview scheduled | Done in working tree | Pending | Pending final documentation proof and judge review | `docs/project/interviews/README.md` identifies the prepared goal interview transcript as the next owner-facing documentation step after M4 proof and review. |

## Deferred Checks

| Check | Status | Reason |
| --- | --- | --- |
| Live GitHub open/closed state validation for linked `doc-split` issues | Deferred beyond M2 | The M2 CI check stays local and cheap: it requires a `doc-split` issue reference but does not call GitHub from the build. |

## Owner Status Notes

German owner status notes are maintained in
`doc-size-policy-owner-status-notes.md`.

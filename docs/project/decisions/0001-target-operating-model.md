Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-05
Source of Truth: Target operating model decision for autonomous SaltMarcher delivery.

# 0001 Target Operating Model

## Problem

SaltMarcher needs autonomous technical delivery without training agents to
ignore red gates, silently change visible behavior, or ask the owner technical
implementation questions.

## Alternatives

- Owner reviews every technical choice. Rejected because it keeps the owner in
  the technical loop.
- Agents merge after local proof only. Rejected because one model can erode its
  own gates.
- Deterministic gates plus independent review and owner holdout acceptance.

## Decision

SaltMarcher uses two loops: the owner loop accepts visible behavior and sets
priorities, while the technical loop owns architecture, tests, dependencies,
security details, and refactoring. Three guardians protect the loop: frozen
warden surfaces, independent judge review for R1+ work, and owner testing of
the next channel.

`main` is the next integration channel. The stable installation follows the
latest `v*` tag. Every PR declares risk class R0, R1, R2, R3a, R3b, or R3c.

## Rationale

The owner should decide product outcomes, data/cost consent, and acceptance.
The system should decide implementation details and prove them mechanically.
Frozen gates prevent silent weakening; judge review prevents self-approval;
the owner holdout catches behavior that tests did not model.

## Risks

The model depends on GitHub branch protection, labels, and secrets that require
owner setup. Until those owner actions are complete, live repository
qualification remains not qualified.

## Validation

Required GitHub check contexts are `production-handoff`, `warden-freeze`,
`behavior-gate`, and `judge-review`. GitHub's UI displays them under the
`quality-platforms / ...` workflow labels, but branch protection must require
the job context names that the Checks API reports. Branch-protection readback
must report `Qualified`.

## Archived Artifacts

The decision-complete predecessor plan is archived in PR #360 and will be
attached to the first stable release. The full independent review report uses
the same archive route once the owner provides the complete copy.

## Rollback

Revert the operating-model PRs, remove the new required checks from branch
protection, and return to production-handoff-only gating.

## Supersedes

None.

Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-05
Source of Truth: Implementation index for the SaltMarcher target operating model rollout.

# SaltMarcher Target Operating Model Plan

## Status

The approved rollout plan has been implemented as canonical repo artifacts.
This file remains as a short index so future agents can find the owners without
retaining a long, gate-incompatible planning document.

## Canonical Owners

- Operating model decision:
  `docs/project/decisions/0001-target-operating-model.md`
- Required checks decision:
  `docs/project/decisions/0002-required-checks.md`
- Resource policy:
  `docs/project/policies/resource-policy.md`
- Agent workflow router:
  `AGENTS.md`
- Branch-protection and CI policy:
  `docs/project/verification/quality-platforms-ci-and-branch-protection.md`
- Harness gaps:
  `docs/project/verification/harness-gaps.md`
- Autonomous runner status:
  no active in-repo autonomous runner; retired on 2026-07-09
- Owner-action checklist:
  `docs/project/journal/2026-07-target-operating-model-owner-actions.md`

## Implemented Milestones

- M0: repo hygiene, README, DEVELOPMENT, SECURITY, German issue templates, PR
  template, Dependabot secret guard, and label owner-action list.
- M1: risk classes, decision boundary, forbidden actions, ADR infrastructure,
  target operating model ADR, and resource policy.
- M2: frozen-surface list, CODEOWNERS, warden script, branch-protection
  readback script, SHA-pinned workflow actions, and required-check ADR.
- M3: harness map, harness-map consistency check, behavior-gate job, harness
  gap register, headless xvfb CI invocation, and smoke startup harness.
- M4: Anthropic judge script, judge-review CI job, Dependabot risk labels, and
  risk-label plausibility checks in the warden.
- M5: stable-promotion workflow and promotion script.
- M6: Linux systemd-user updater, next-channel launcher, status command, and
  installer.
- M7: German status issue updater and acceptance-label workflow.
- M8: repo-owned autonomous runner retired; local tooling kept for updater and
  status commands only.
- M9: governed migration roadmap remains review-owned by the active
  architecture and verification owners.

## Remaining Owner Actions

Owner actions are tracked in
`docs/project/journal/2026-07-target-operating-model-owner-actions.md`. Live
qualification is not complete until branch protection readback reports
`Qualified`, the judge secret is set, labels exist, the resource policy is
signed off, issue templates are checked in GitHub, and the laptop updater is
installed.

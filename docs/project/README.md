Status: Active
Source of Truth: Entry point into project-wide canonical documentation.

# Project Documentation

This directory owns cross-feature canonical documentation. Feature-owned truth
lives under `docs/<feature>/`; see [docs/README.md](../README.md).

## Direction

- [Vision](vision.md) -- who SaltMarcher is for, and what it is not.
- [Roadmap](roadmap.md) -- now, next, later.
- [Definition of Done](definition-of-done.md)
- [Owner Interviews](interviews/README.md) -- verbatim owner intent (German).

## Rules

- [Documentation Standard](documentation.md) -- what is documented where.
- [Agent Instruction Standard](architecture/agent-instructions.md) -- tiers,
  roles, judge review.
- [Autonomy Boundaries](architecture/autonomy-boundaries.md) -- what the system
  decides alone, and what the owner decides.
- [Resource Policy](policies/resource-policy.md) -- paid services, egress,
  secrets.
- [Project Health](architecture/project-health.md) and its
  [Debt Register](architecture/project-health-debt.md).

## Architecture

- [Source Architecture](architecture/source-architecture.md) -- the current
  source shape and its principles. Start here.
- Patterns: [layering](architecture/patterns/layering-architecture.md),
  [bootstrap](architecture/patterns/bootstrap.md),
  [shell layer](architecture/patterns/shell-layer.md),
  [data layer](architecture/patterns/data-layer.md),
  [styling](architecture/patterns/styling.md).
- [Verification Core](architecture/verification-core.md) -- public verification
  surfaces and outcome-check wiring.

## Decisions

- [ADR 0001 Target Operating Model](decisions/0001-target-operating-model.md)
- [ADR 0002 Required Checks](decisions/0002-required-checks.md)
- [ADR 0003 Honest Instruments Base Gates](decisions/0003-honest-instruments-base-gates.md)
- [ADR 0004 Content-Addressed Harness Verification](decisions/0004-content-addressed-harness-verification.md)
- [ADR Template](decisions/0000-template.md)

## Verification

- [Quality Platforms](verification/quality-platforms.md), split into
  [CI and branch protection](verification/quality-platforms-ci-and-branch-protection.md),
  [local entry points](verification/quality-platforms-local-entrypoints.md), and
  [local gates](verification/quality-platforms-local-gates.md).
- [Harness Gaps](verification/harness-gaps.md)
- [Source References Standard](verification/source-references.md)

## Repo-Wide Requirements

Behavior owned centrally rather than by one feature:
[anchored popup](requirements/requirements-anchored-popup.md),
[dialog surface](requirements/requirements-dialog-surface.md),
[dropdown popup](requirements/requirements-dropdown-popup.md),
[progress meter](requirements/requirements-progress-meter.md),
[travel state tab](requirements/requirements-travel-state-tab.md).

## Journal

[docs/project/journal/](journal/README.md) holds L-tier design notes and
incidents. It is append-only and never a source of truth.

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
- [Agent Instruction Standard](architecture/agent-instructions.md) -- direct
  execution and proportional review.
- [Autonomy Boundaries](architecture/autonomy-boundaries.md) -- what the system
  decides alone, and what the owner decides.
- [Resource Policy](policies/resource-policy.md) -- paid services, egress,
  secrets.

## Architecture

- [Source Architecture](architecture/source-architecture.md) -- target source
  shape, boundaries, quality concerns, and migration relationship. Start here.
- Patterns: [feature boundaries](architecture/patterns/feature-boundaries.md),
  [application composition](architecture/patterns/application-composition.md),
  [shell layer](architecture/patterns/shell-layer.md), and
  [styling](architecture/patterns/styling.md).
- [Verification Core](architecture/verification-core.md) -- public verification
  surfaces and outcome-check wiring.

## Delivery

- [Active delivery index](delivery/README.md)

## Verification

- [Quality Platforms](verification/quality-platforms.md)
- [Source References Standard](verification/source-references.md)

## Repo-Wide Requirements

Behavior owned centrally rather than by one feature:
[anchored popup](requirements/requirements-anchored-popup.md),
[dialog surface](requirements/requirements-dialog-surface.md),
[dropdown popup](requirements/requirements-dropdown-popup.md),
[progress meter](requirements/requirements-progress-meter.md),
[travel state tab](requirements/requirements-travel-state-tab.md).

# Project Documentation

This directory owns cross-feature canonical documentation. Feature-owned truth
lives under `docs/<feature>/`; see [docs/README.md](../README.md).

## Direction

- [Vision](vision.md) -- who SaltMarcher is for, and what it is not.

## Architecture

- [Program Technical Needs](architecture/program-technical-needs.md) --
  solution-neutral obligations and measurable quality scenarios derived from
  the confirmed complete local GM-core needs.
- [Source Architecture](architecture/source-architecture.md) -- target source
  shape, boundaries, quality concerns, and migration relationship. Start here.
- Patterns: [feature boundaries](architecture/patterns/feature-boundaries.md),
  [application composition](architecture/patterns/application-composition.md),
  [shell layer](architecture/patterns/shell-layer.md), and
  [styling](architecture/patterns/styling.md).

## Delivery

- [Godot Cutover Roadmap](delivery/roadmap-godot-cutover.md) -- live sequencing,
  deletion gates, evidence, and final JavaFX/SQLite absence criteria.

## Contracts

- [Persistence Lifecycle](contract/persistence-lifecycle.md) -- immutable
  Godot file-store commit, recovery, backup, trash, and portability semantics.

## Repo-Wide Requirements

Behavior owned centrally rather than by one feature:
[anchored popup](requirements/requirements-anchored-popup.md),
[program capabilities](requirements/requirements-program-capabilities.md),
[dialog surface](requirements/requirements-dialog-surface.md),
[dropdown popup](requirements/requirements-dropdown-popup.md),
[progress meter](requirements/requirements-progress-meter.md),
[travel state tab](requirements/requirements-travel-state-tab.md).

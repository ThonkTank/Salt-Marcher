# Project Documentation

This directory owns cross-feature canonical documentation. Feature-owned truth
lives under `docs/<feature>/`; see [docs/README.md](../README.md).

## Direction

- [Vision](vision.md) -- who SaltMarcher is for, and what it is not.

## Architecture

- [Program Technical Needs](architecture/program-technical-needs.md) --
  solution-neutral obligations and measurable quality scenarios derived from
  the confirmed complete local GM-core needs.
- [Electron Target Architecture](architecture/target-architecture.md) -- active
  source shape, boundaries, security model, and data ownership. Start here.
- [Electron Greenfield Migration](architecture/electron-greenfield-migration.md)
  -- versioned roadmap, decisions, progress, and blockers.
- [Superseded JavaFX Source Architecture](architecture/source-architecture.md)
  -- historical reference only.
- Patterns: [feature boundaries](architecture/patterns/feature-boundaries.md),
  [application composition](architecture/patterns/application-composition.md),
  [shell layer](architecture/patterns/shell-layer.md), and
  [styling](architecture/patterns/styling.md).

## Contracts

- [Persistence Lifecycle](contract/persistence-lifecycle.md) -- shared SQLite
  location, connection, version, backup, and recovery semantics.

## Repo-Wide Requirements

Behavior owned centrally rather than by one feature:
[anchored popup](requirements/requirements-anchored-popup.md),
[program capabilities](requirements/requirements-program-capabilities.md),
[dialog surface](requirements/requirements-dialog-surface.md),
[dropdown popup](requirements/requirements-dropdown-popup.md),
[progress meter](requirements/requirements-progress-meter.md),
[travel state tab](requirements/requirements-travel-state-tab.md).

# Project Documentation

This directory owns cross-feature canonical documentation. Feature-owned truth
lives under `docs/<feature>/`; see [docs/README.md](../README.md).

## Direction

- [Vision](vision.md) -- who SaltMarcher is for, and what it is not.
- [Truth Manifest](truth-manifest.md) -- authoritative locations for product,
  architecture, status, and evidence claims.

## Architecture

- [Program Technical Needs](architecture/program-technical-needs.md) --
  solution-neutral obligations and measurable quality scenarios derived from
  the confirmed complete local GM-core needs.
- [Electron Target Architecture](architecture/target-architecture.md) -- active
  source shape, boundaries, security model, and data ownership. Start here.
- [Electron Greenfield Migration](architecture/electron-greenfield-migration.md)
  -- versioned roadmap, decisions, progress, and blockers.
- [ADR 0001](architecture/decisions/0001-shared-encounter-composition-and-preset-ownership.md)
  -- shared composition and installation-owned presets.
- [ADR 0002](architecture/decisions/0002-persist-explicit-combat-partitions.md)
  -- explicit persisted individual/mob partitions.

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

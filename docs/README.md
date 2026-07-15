Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: Root documentation index for SaltMarcher documentation layers
and feature documentation directories.

# SaltMarcher Documentation

## Purpose

This directory is the entry point for project-wide and feature-owned
SaltMarcher documentation. Documentation intent and findability rules are owned
by the [Documentation Standard](project/documentation.md).

## Documentation Layers

- L0 Vision: [Project Vision](project/vision.md) records why SaltMarcher
  exists, for whom, and what it will not become.
- L1 Direction: [Project Roadmap](project/roadmap.md) records Now, Next, and
  Later work.
- L2 Backlog: GitHub Issues record ideas, bugs, UX problems, and questions.
- L3 Behavior: feature requirements under `docs/<feature>/requirements/`
  record target behavior.
- L4 Proof: executable JUnit tests record current behavior evidence.

## Project Documentation

- [Project Documentation Index](project/README.md)
- [Documentation Standard](project/documentation.md)

## Feature Documentation

- [Creatures](creatures/README.md): creature catalog, detail, and
  encounter-candidate reference behavior.
- [Dungeon](dungeon/README.md): dungeon authoring, editing, travel, and domain
  truth.
- [Encounter](encounter/README.md): encounter generation and saved encounter
  plans.
- [Encounter Table](encountertable/README.md): authored encounter-table
  candidate sources.
- [Hex](hex/README.md): hex-map editing and travel behavior.
- [Maps](maps/README.md): shared passive map-canvas behavior and contracts.
- [Party](party/README.md): party composition and party state.
- [Session Planner](sessionplanner/README.md): session-owned planning records.
- [Travel](travel/README.md): deprecated travel domain documentation retained
  for compatibility context.
- [World Planner](worldplanner/README.md): campaign-world planning records.

## References

- [Repository README](../README.md)
- [Agent Guide](../AGENTS.md)

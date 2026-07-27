# SaltMarcher Documentation

## Purpose

This directory is the entry point for project-wide and feature-owned
SaltMarcher product documentation.

## Documentation Layers

- Vision: [Project Vision](project/vision.md) records why SaltMarcher
  exists, for whom, and what it will not become.
- Behavior: feature requirements under `docs/<feature>/requirements/`
  record target behavior.
- Domain documents define business truth and invariants.
- Contracts define APIs, persistence, validation, errors, and compatibility.
- Architecture documents define boundaries, dependencies, and quality-driving
  decisions.

## Project Documentation

- [Project Documentation Index](project/README.md)

## Feature Documentation

- [Actor Autonomy](autonomy/README.md): GM-authorized NPC and monster needs,
  jobs, catch-up, and bounded non-party conflict resolution.
- [Campaign](campaign/README.md): installation-wide Campaign registry and
  active-Campaign pointer persistence.
- [Catalog](catalog/README.md): shared catalog workspace behavior.
- [Creatures](creatures/README.md): creature catalog, detail, and
  encounter-candidate reference behavior.
- [Dungeon](dungeon/README.md): dungeon authoring, editing, travel, and domain
  truth.
- [Encounter](encounter/README.md): encounter generation and saved encounter
  plans.
- [Encounter Table](encountertable/README.md): authored encounter-table
  candidate sources.
- [Hex](hex/README.md): hex-map editing and travel behavior.
- [Items](items/README.md): local imported item reference data.
- [Maps](maps/README.md): shared passive map-canvas behavior and contracts.
- [Party](party/README.md): party composition and party state.
- [Scene](scene/README.md): running-scene behavior and state.
- [Session Generation](sessiongeneration/README.md): deterministic encounter
  and reward generation.
- [Session Planner](sessionplanner/README.md): session-owned planning records.
- [Travel](travel/README.md): feature-neutral global travel-context selection
  across Party, Dungeon, and Hex readbacks.
- [World Planner](worldplanner/README.md): campaign-world planning records.

## References

- [Repository README](../README.md)

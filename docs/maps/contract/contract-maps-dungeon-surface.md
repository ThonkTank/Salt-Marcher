Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Dungeon adopter boundary language between dungeon-facing
Binders and `DungeonApplicationService` for map-surface work.

# Dungeon Map Surface Contract

## Purpose

This contract defines the canonical dungeon-native request and response
language for map load, preview, apply, travel action, and catalog behavior as
the dungeon adoption of the generic maps feature.

Owners:

- provider: `DungeonApplicationService`
- consumers: dungeon-facing Binders and their canvas-facing dungeon map
  `PresentationModel` listener seams

Current code may still route some calls through classes named `*ViewModel`.
Those names do not widen the contract ownership: the canonical outward caller
role is the Binder.

## Rules

- dungeon surface read MUST use one read family
- preview and apply MUST reuse one dungeon edit body
- dungeon surface readback MUST use one top-level surface payload
- travel action execution MUST use one travel-action request family
- map catalog requests and results remain separate from the surface payload
  family
- `DungeonSurfacePayload` is the only domain-to-canvas readback root for
  dungeon map surfaces

## Inbound Request Family

### Surface Read

- `LoadDungeonSurfaceQuery`

Required context:

- `mapId`
- `surfaceKind`

Optional context:

- selection context
- travel position context

### Surface Edit

- `DungeonSurfaceEdit`
- `PreviewDungeonSurfaceEditQuery`
- `ApplyDungeonSurfaceEditCommand`

`DungeonSurfaceEdit` is the one canonical dungeon edit body. Preview and apply
wrap the same body.

### Surface Travel Action

- `MoveDungeonSurfaceActionCommand`

Required fields:

- chosen action id

Optional fields:

- current travel position context

### Map Catalog

- `SearchMapsQuery`
- `CreateDungeonMapCommand`
- `RenameDungeonMapCommand`
- `DeleteDungeonMapCommand`

## Outbound Payload Family

### Surface Payload

- `DungeonSurfacePayload`

Required sections:

- map identity or name context
- `surfaceKind`
- committed map projection
- messages

Optional sections:

- preview map projection
- selection or inspector content
- travel content

### Catalog Results

- `SearchMapsResult`
- `CreateDungeonMapResult`
- `RenameDungeonMapResult`
- `DeleteDungeonMapResult`

## Validation And Error Behavior

- invalid edit or travel attempts MUST return a non-committing result
  represented through payload messages and unchanged committed truth
- preview MUST NOT persist authored truth
- load failures and empty states MUST remain representable without inventing a
  second top-level payload family
- adapters and Binders MUST treat omitted optional sections as absence, not as
  implicit synthetic defaults
- consumers MUST not create a second dungeon-specific render payload beside
  `DungeonSurfacePayload` for canvas projection

## Compatibility Notes

Older split carriers such as separate snapshot, travel-snapshot, or
mutation-result roots are migration debt once this unified surface contract is
adopted in code.

## Verification Notes

- This contract is currently `Review-Owned`.
- Review must reject a second top-level dungeon map surface payload beside
  `DungeonSurfacePayload`.
- Review must reject a second canonical dungeon edit body beside
  `DungeonSurfaceEdit`.

## References

- [Maps Canvas Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-canvas.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
- [Dungeon Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/dungeon/contract/contract-dungeon-persistence.md:1)

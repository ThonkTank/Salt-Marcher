# Hexmap Feature

## Purpose

`hexmap` owns the overworld map, the overworld editor, the shared hex renderer used by both, and the local calendar behavior tied to that feature area.

## Canonical Types and APIs

- `features.world.hexmap.api` — public world-owned boundary for hexmap reads, mutations, and shell wiring.
- `HexGridPane` — shared renderer for read-only and editing workflows.
- `HexMapService` — async map loading and overworld persistence workflow seam.
- `CalendarService` — Forgotten Realms calendar parsing and day conversion seam.

## Where New Code Goes

- Keep runtime and editor hex rendering on the shared renderer.
- Keep debounced party-tile persistence and transactional map resizing in `HexMapService`.
- Keep paint batching on the existing paint-and-flush workflow.
- Keep `TerrainType` in `src/ui/components/` while it remains shared by `HexGridPane` and `TilePropertiesPane`.

## Forbidden Drift

- Do not fork separate runtime and editor renderers for the same hex surface behavior.
- Do not degrade paint drag into per-tile persistence writes.
- Do not repeatedly reparse calendar configuration in hot paths.

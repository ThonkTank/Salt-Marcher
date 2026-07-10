Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Image snapshot parity expectations for Dungeon map rendering
before Dungeon render or view migration.

# Dungeon Render Snapshot Parity Matrix

## Purpose

This document owns the image-snapshot parity net for the Dungeon map render
pipeline. It supplements the existing editor and travel route matrices with a
pixel-level proof that the current old-structure render route can produce a
before/after image pair and compare it with a diff oracle.

The harness does not define new product behavior. It renders existing
production routes twice in the same JVM, requires exact pixel identity for the
same render frame, and requires a non-empty image diff for a deliberate route
change so the oracle itself cannot pass while blind.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-IMG-001` | Editor projection image parity | `DungeonEditorContribution` slots, visible `+` projection control, `DungeonMapView` canvas snapshot | `F6_MULTI_LEVEL_FLOORS` | The editor renders active `z=1` twice from the same published render frame with `changedPixels=0`; the control image diff between prior `z=0` and `z=1` is non-empty; PNG evidence is written under `build/dungeon-map-render-parity-results/render-snapshots/DE-IMG-001/`. | Ready |
| `DE-IMG-002` | Editor wall-preview image parity | `DungeonEditorContribution` slots, `Wand` family control, `DungeonMapView` pointer route, canvas snapshot | `F1_SINGLE_ROOM` | The active wall preview renders twice from the same preview frame with `changedPixels=0`; the control image diff between committed map and preview map is non-empty; no boundary rows persist before commit; PNG evidence is written under `build/dungeon-map-render-parity-results/render-snapshots/DE-IMG-002/`. | Ready |
| `DT-IMG-001` | Travel projection image parity | `DungeonTravelContribution` slots, visible `+` projection control, `DungeonMapView` canvas snapshot | `F18_OFFSET_MULTI_LEVEL_ROOMS` plus party on level `0` | The travel route projects active `z=1` into the render model and snapshots the canvas twice from the same runtime travel frame with `changedPixels=0`; the prior `z=0` image is retained as a diagnostic control image because current old-structure pixels may remain unchanged across the travel projection route; PNG evidence is written under `build/dungeon-map-render-parity-results/render-snapshots/DT-IMG-001/`. | Ready |

## Proof Route

Mechanically enforced by `./gradlew dungeonMapRenderParityHarness --console=plain`.
The task runs through the existing JavaFX harness startup,
isolates `XDG_DATA_HOME`, writes `summary.txt`, and stores generated image
artifacts in the Gradle build directory only.

## References

- [Dungeon Editor Map, Projection, And Controls Matrix](verification-dungeon-editor-map-controls.md)
- [Dungeon Editor Wall Matrix](verification-dungeon-editor-walls.md)
- [Dungeon Travel Map And Projection Controls Matrix](verification-dungeon-travel-map-controls.md)
- [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md)

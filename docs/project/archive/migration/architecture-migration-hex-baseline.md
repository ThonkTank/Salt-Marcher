Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: M2.2 diagnostic baseline metrics for the Hex architecture
migration pilot before target design.

# Hex Migration Baseline

## Purpose

This document records the M2.2 baseline metrics for the Hex pilot area before
any target design, wiring port, or implementation. The numbers are diagnostic:
they define the baseline for the later M2 conformance review, but they do not
approve a design or prescribe implementation.

## Scope

The roadmap's `hex (87 files)` count is reproducible only with these roots:

- `src/domain/hex`
- `src/view/leftbartabs/hexmap`
- `src/data/hex`

The migration-owned product subset is `src/domain/hex` plus
`src/view/leftbartabs/hexmap` with 70 Java files. The 17 `src/data/hex` files
are counted because they make the roadmap number reproducible, but the ledger's
data-layer exclusion still applies: data code is not a normal per-area
migration target unless the approved Hex design requires a gateway signature
adaptation.

Adjacent Hex travel-state files under `src/view/statetabs/travel` are harness
consumers and remain outside the 87-file baseline.

## Reproduction

File count:

```bash
find src/domain/hex src/view/leftbartabs/hexmap src/data/hex \
  -type f -name '*.java' | wc -l
# 87
```

Line count:

```bash
find src/domain/hex src/view/leftbartabs/hexmap src/data/hex \
  -type f -name '*.java' -print0 | sort -z | xargs -0 wc -l
# 5564 total
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count from the same file set is 4,882 lines.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/hex` | 55 | 2,160 | 1,863 | Product structure |
| `src/view/leftbartabs/hexmap` | 15 | 2,400 | 2,134 | Product structure |
| `src/data/hex` | 17 | 1,004 | 885 | Counted separately; not a normal migration target |
| Product subset | 70 | 4,560 | 3,997 | Main M2 design surface |
| Full roadmap set | 87 | 5,564 | 4,882 | M2 measurement denominator |

## Intent-To-Mutation Chains

Counting rule: count meaningful class-boundary hops from user intent source to
first Hex-owned domain or durable mutation. Command/value-record construction
and same-class private helpers are not counted. Persistence internals and
published readback tails are recorded separately when they materially lengthen
the path.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Paint terrain | `HexMapMainView.publishTile` -> `HexMapIntentHandler.consume` -> `HexEditorApplicationService.paintTerrain` -> `PaintHexTerrainUseCase.execute` -> `HexMap.paintTerrain` / `repository.saveTerrain` | 5 | `src/view/leftbartabs/hexmap/HexMapMainView.java:183`, `src/view/leftbartabs/hexmap/HexMapIntentHandler.java:149`, `src/domain/hex/HexEditorApplicationService.java:86`, `src/domain/hex/model/map/usecase/PaintHexTerrainUseCase.java:27` |
| Save marker | `HexMapStateView.publishMarker` -> `HexMapIntentHandler.saveMarker` -> `HexEditorApplicationService.saveMarker` -> `SaveHexMarkerUseCase.execute` -> `HexMap.saveMarker` / `repository.saveMarker` | 5 | `src/view/leftbartabs/hexmap/HexMapStateView.java:169`, `src/view/leftbartabs/hexmap/HexMapIntentHandler.java:224`, `src/domain/hex/HexEditorApplicationService.java:90`, `src/domain/hex/model/map/usecase/SaveHexMarkerUseCase.java:29` |
| Update map metadata | `HexMapStateView.publishMap` -> `HexMapIntentHandler.updateMap` -> `HexEditorApplicationService.updateMap` -> `UpdateHexMapUseCase.execute` -> `HexMap.updateMetadata` / `repository.save`; selected-map write follows through `repository.setSelectedMap` | 5 to first save; 6 including selected-map write | `src/view/leftbartabs/hexmap/HexMapStateView.java:155`, `src/view/leftbartabs/hexmap/HexMapIntentHandler.java:210`, `src/domain/hex/HexEditorApplicationService.java:70`, `src/domain/hex/model/map/usecase/UpdateHexMapUseCase.java:25` |
| Move party token from Hex map | `HexMapMainView.publishTile` -> `HexMapIntentHandler.movePartyToken` -> `HexTravelApplicationService.movePartyToken` -> `MoveHexPartyTokenUseCase.execute` -> `HexTravelPartyPositionApplicationRepository.movePartyToken` -> `HexTravelPartyBoundaryServiceAssembly.movePartyToken` -> `PartyApplicationService.moveCharacters` -> Party mutation path | 8+ cross-area hops | `src/view/leftbartabs/hexmap/HexMapIntentHandler.java:262`, `src/domain/hex/HexTravelApplicationService.java:15`, `src/domain/hex/model/map/usecase/MoveHexPartyTokenUseCase.java:27`, `src/domain/hex/model/map/repository/HexTravelPartyPositionApplicationRepository.java:16-18`, `src/domain/hex/HexTravelPartyBoundaryServiceAssembly.java:21` |

The dominant Hex-owned user-action baseline is 5 meaningful hops to the first
Hex mutation. The cross-area party-token path is longer and must be handled by
the M2 seam statement rather than hidden in the Hex design.

If a review counts durable SQLite row mutation instead of the domain/repository
mutation, map update adds `SqliteHexMapRepository`, `SqliteHexMapLocalGateway`,
`SqliteHexMapWriter`, and `SqliteHexMapSnapshotWriter` before the SQL statement.
If a review counts published readback mutation, successful editor mutations add
`LoadHexEditorStateUseCase.publishLoaded*`, `HexEditorWorkspace.replace`, and
`HexServiceAssembly.publish`.

## Forwarding-Only Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, or proxying to another object without owning meaningful
decision logic. Interfaces are noted as seam overhead but not counted as
forwarding-only classes.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/hex/HexEditorApplicationService.java` | Forwarding-only candidate | Public methods unpack command records and delegate to per-verb use cases (`src/domain/hex/HexEditorApplicationService.java:57-103`). |
| `src/domain/hex/HexTravelApplicationService.java` | Forwarding-only candidate | Null guard plus direct delegation to `MoveHexPartyTokenUseCase` (`src/domain/hex/HexTravelApplicationService.java:15-24`). |
| `src/domain/hex/model/map/usecase/LoadHexEditorUseCase.java` | Forwarding-only candidate | `execute()` only delegates to `LoadHexEditorStateUseCase.execute()` (`src/domain/hex/model/map/usecase/LoadHexEditorUseCase.java:13-14`). |
| `src/domain/hex/model/map/port/HexTravelPositionPort.java` | Forwarding-only candidate | `acceptPartyTravelPosition` directly calls `UpdateHexTravelPositionUseCase.execute` (`src/domain/hex/model/map/port/HexTravelPositionPort.java:17-18`). |
| `src/domain/hex/published/HexEditorModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions (`src/domain/hex/published/HexEditorModel.java:25-31`). |
| `src/domain/hex/published/HexTravelModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions (`src/domain/hex/published/HexTravelModel.java:23-28`). |
| `src/data/hex/HexServiceContribution.java` | Data-layer forwarding candidate, counted separately | `register` delegates to `HexServiceAssembly.register` (`src/data/hex/HexServiceContribution.java:10-12`). |

Baseline count: 6 product/published forwarding-only candidates plus 1
data-layer candidate counted separately.

Seam overhead to account for in the design, but not counted as concrete
forwarding-only classes: `HexEditorPublishedStateRepository`,
`HexTravelPublishedStateRepository`, `HexTravelPartyPositionRepository`, and
`HexTravelPartyPositionWriterRepository` are one-method interfaces.
`HexTravelPartyPositionApplicationRepository` is a thin adapter rather than
pure forwarding because it converts `HexCoordinate` to a stable tile id before
crossing into Party.

## String Boundary Round-Trips

String round-trip means a typed or finite-domain value is converted to a String
for an internal Hex boundary and later parsed, normalized, or matched back into
the same finite-domain meaning. User text fields and persisted display names do
not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Tool key | View constants and content models carry `SELECT`, `PAINT_TERRAIN`, `PLACE_MARKER`, and `MOVE_PARTY` as Strings; `SetHexEditorToolCommand` carries Strings; `SetHexEditorToolUseCase` converts through `HexEditorMode.valueOf`; snapshots publish `HexEditorMode.name()` back to String. | `src/view/leftbartabs/hexmap/HexMapToolContentPartModel.java:5-8`, `src/view/leftbartabs/hexmap/HexMapControlsContentModel.java:151-161`, `src/domain/hex/model/map/usecase/SetHexEditorToolUseCase.java:18-29`, `src/domain/hex/HexEditorSnapshotProjectionServiceAssembly.java:132-137` |
| Terrain key | Terrain leaves the domain as `HexTerrain.name()`, moves through `HexEditorSnapshot` / view content models as String keys, returns through `PaintHexTerrainCommand(String terrain)`, and is parsed with `HexTerrain.valueOf`. | `src/domain/hex/HexEditorSnapshotProjectionServiceAssembly.java:136-137`, `src/view/leftbartabs/hexmap/HexMapMainView.java:86-94`, `src/view/leftbartabs/hexmap/HexMapIntentHandler.java:157-164`, `src/domain/hex/model/map/usecase/PaintHexTerrainUseCase.java:55-58` |
| Marker type | Marker type is presented as String options, sent through `SaveHexMarkerCommand(String type)`, parsed with `HexMarkerKind.valueOf`, and projected back as `marker.type().name()`. | `src/view/leftbartabs/hexmap/HexMapStateContentModel.java:370-383`, `src/view/leftbartabs/hexmap/HexMapIntentHandler.java:240-259`, `src/domain/hex/model/map/usecase/SaveHexMarkerUseCase.java:39-76`, `src/domain/hex/HexEditorSnapshotProjectionServiceAssembly.java:122-129` |
| Catalog map id | `HexMapId` is stringified into shared catalog item ids, then parsed back with `parseId` in Hex intent handling. This may belong to the shared catalog seam, but the Hex route currently pays the round-trip. | `src/view/leftbartabs/hexmap/HexMapContributionModel.java:88-101`, `src/view/leftbartabs/hexmap/HexMapIntentHandler.java:74-82`, `src/view/leftbartabs/hexmap/HexMapIntentHandler.java:280-285` |
| Canvas active tool/terrain | `HexMapMainContentModel` projects tool and terrain keys as Strings, `HexMapMainView` stores them in `Node` properties, and click handling reads them back as Strings for `HexMapMainViewInputEvent`. | `src/view/leftbartabs/hexmap/HexMapMainContentModel.java:66-90`, `src/view/leftbartabs/hexmap/HexMapMainView.java:85-87`, `src/view/leftbartabs/hexmap/HexMapMainView.java:183-194`, `src/view/leftbartabs/hexmap/HexMapMainView.java:235-239` |

Baseline count: 5 product String round-trip families. Data-layer enum
serialization in `src/data/hex/mapper/HexMapMapper.java:56-61` and
`src/data/hex/mapper/HexMapMapper.java:121-128` is counted separately because
persistence stores terrain and marker type as strings.

## Residual Notes For Design

- The M2 target design must use the 70-file product subset as its normal
  structural surface and explicitly name any data-layer gateway signature
  adaptation if one is required.
- The published seams consumed by shell, Travel state, Party, and shared
  catalog surfaces remain byte-compatible unless both sides are migrated in the
  same approved design.
- M2.2 does not authorize a wiring port or implementation. The next step is a
  judge-approved Hex target design with target classes, representative call
  chains, deletion list, seam statement, and untouched-list.

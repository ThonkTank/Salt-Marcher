Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: M4.3 diagnostic baseline metrics for the Dungeon Travel
architecture migration sub-slice before target design.

# Dungeon Travel Migration Baseline

## Purpose

This document records the M4.3 baseline metrics for `dungeon-travel` before
any target design, wiring port, or implementation. The numbers are diagnostic.
They define the baseline for later M4.3 conformance review, but do not approve
a design or prescribe implementation.

## Scope

The roadmap names M4.3 Travel as `runtime/travel/**` plus the travel published
surface. The main runtime denominator is therefore:

- `src/domain/dungeon/model/runtime/travel`
- travel usecase/repository bridge files in `src/domain/dungeon/model/runtime/usecase`
  and `src/domain/dungeon/model/runtime/repository`

The service and published seam that must be visible to the design is:

- top-level `src/domain/dungeon/DungeonTravel*.java`
- `src/domain/dungeon/published/*Travel*.java`

The visible route is measured separately because the M4.3 harness drives real
left-bar controls and state actions through the production UI:

- `src/view/leftbartabs/dungeontravel`

`src/view/statetabs/travel` is an adjacent M5 consumer and is counted
separately. Dungeon authored core, editor runtime, rendering pipeline, and
editor-view packages are other M4 slices. They appear in call-chain evidence
only where current Travel routes consume their published seams.

## Reproduction

Counts use Java files only. LOC means physical Java file lines from `wc -l`,
including blank lines and comments. Secondary nonblank count uses the same file
set with blank lines removed.

Runtime Travel files:

```bash
find src/domain/dungeon/model/runtime/travel -type f -name '*.java' | wc -l
# 30

find src/domain/dungeon/model/runtime/travel -type f -name '*.java' -print0 \
  | sort -z | xargs -0 wc -l | tail -1
# 2758 total

find src/domain/dungeon/model/runtime/travel -type f -name '*.java' -print0 \
  | sort -z | xargs -0 sed '/^[[:space:]]*$/d' | wc -l
# 2358
```

Travel bridge files:

```bash
find src/domain/dungeon/model/runtime/usecase -type f -name '*Travel*.java'
find src/domain/dungeon/model/runtime/repository -type f -name 'Travel*.java'
# 10 files, 889 physical LOC, 774 nonblank LOC
```

Service, published, and visible route roots:

```bash
find src/domain/dungeon -maxdepth 1 -type f -name 'DungeonTravel*.java'
# 7 files, 531 physical LOC, 474 nonblank LOC

find src/domain/dungeon/published -maxdepth 1 -type f -name '*Travel*.java'
# 12 files, 272 physical LOC, 232 nonblank LOC

find src/view/leftbartabs/dungeontravel -maxdepth 1 -type f -name '*.java'
# 10 files, 1443 physical LOC, 1235 nonblank LOC

find src/view/statetabs/travel -maxdepth 1 -type f -name '*.java'
# 5 files, 293 physical LOC, 240 nonblank LOC
```

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/dungeon/model/runtime/travel` | 30 | 2,758 | 2,358 | Main M4.3 runtime travel product structure |
| Travel usecase/repository bridge files | 10 | 889 | 774 | M4.3 bridge ceremony around runtime travel |
| Runtime travel plus bridge | 40 | 3,647 | 3,132 | Primary runtime denominator |
| Top-level `src/domain/dungeon/DungeonTravel*.java` | 7 | 531 | 474 | Service and composition seam |
| `src/domain/dungeon/published/*Travel*.java` | 12 | 272 | 232 | Published travel seam |
| Domain travel service and published set | 59 | 4,450 | 3,838 | Design-visible M4.3 domain measurement set |
| `src/view/leftbartabs/dungeontravel` | 10 | 1,443 | 1,235 | Visible M4.3 route under test |
| Product route with leftbar Travel | 69 | 5,893 | 5,073 | Full M4.3 product-route measurement set |
| Adjacent `src/view/statetabs/travel` | 5 | 293 | 240 | Counted separately; later view/shell work |
| Product route plus adjacent statetab consumer | 74 | 6,186 | 5,313 | Diagnostic only |

## Intent-To-Mutation And Publication Chains

Counting rule: count meaningful class-boundary hops from visible intent entry
to state mutation or current-session publication. Same-class private helpers,
records, and command construction are not counted. UI readback after
publication is listed separately where it materially extends the route.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Projection level or overlay control | `DungeonTravelControlsView.publish` -> `DungeonTravelIntentHandler.consume(DungeonTravelControlsViewInputEvent)` -> `DungeonTravelRuntimeApplicationService.applyDungeonTravelSession` -> `PublishTravelDungeonSessionUseCase.execute` -> `ApplyTravelDungeonSessionUseCase.apply` -> `TravelDungeonSession.setProjectionLevel` or `setOverlay` -> `DungeonTravelRuntimePublishedStateServiceAssembly.publishCurrentSession`; readback then flows through `TravelDungeonModel.subscribe` -> `DungeonTravelBinder.applySnapshot` -> `DungeonMapContentModel.applyTravelSnapshot` and state/control content models | 7 to publication; 10 including visible readback | `src/view/leftbartabs/dungeontravel/DungeonTravelControlsView.java:87-149`, `src/view/leftbartabs/dungeontravel/DungeonTravelIntentHandler.java:43-61`, `src/domain/dungeon/DungeonTravelRuntimeApplicationService.java:22-33`, `src/domain/dungeon/model/runtime/usecase/PublishTravelDungeonSessionUseCase.java:24-59`, `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonSessionUseCase.java:89-104`, `src/domain/dungeon/DungeonTravelRuntimePublishedStateServiceAssembly.java:15-18`, `src/view/leftbartabs/dungeontravel/DungeonTravelBinder.java:59-78` |
| Visible linked transition action | `DungeonTravelStateView.ActionRow` -> `DungeonTravelIntentHandler.consume(DungeonTravelStateViewInputEvent)` -> `DungeonTravelRuntimeApplicationService` -> `PublishTravelDungeonSessionUseCase` -> `ApplyTravelDungeonSessionUseCase.move` -> `ApplyTravelDungeonMovementUseCase.move` -> `MoveDungeonTravelActionUseCase.execute` -> `MoveResolver.moveTransition` -> `TravelSurfaceProjection.project`/`TravelDungeonSessionProjectionMapper` -> `TravelPartyPositionRepository.saveDungeonPosition` -> `DungeonTravelRuntimePublishedStateServiceAssembly.publishCurrentSession`; readback then updates state and map models | 11 to party-position mutation and publication; 13 including visible readback | `src/view/leftbartabs/dungeontravel/DungeonTravelStateView.java:72-108`, `src/view/leftbartabs/dungeontravel/DungeonTravelIntentHandler.java:81-86`, `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonSessionUseCase.java:71-76`, `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonMovementUseCase.java:38-75`, `src/domain/dungeon/model/runtime/usecase/MoveDungeonTravelActionUseCase.java:64-70`, `src/domain/dungeon/model/runtime/usecase/MoveDungeonTravelActionUseCase.java:121-183`, `src/domain/dungeon/model/runtime/travel/projection/TravelSurfaceProjection.java:16-46`, `src/domain/dungeon/DungeonTravelPartyPositionServiceAssembly.java:42-62`, `src/domain/dungeon/DungeonTravelRuntimePublishedStateServiceAssembly.java:15-18` |
| Visible unlinked transition action | Same visible route as linked transition through `MoveResolver.moveTransition`, but the target is absent or unavailable. The route returns a target-unavailable surface without saving party position, then publishes the unchanged-position session surface. | 10 to target-unavailable publication; no party-position save | `src/view/leftbartabs/dungeontravel/DungeonTravelStateView.java:72-108`, `src/domain/dungeon/model/runtime/usecase/MoveDungeonTravelActionUseCase.java:121-132`, `src/domain/dungeon/model/runtime/usecase/MoveDungeonTravelActionUseCase.java:178-183`, `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonMovementUseCase.java:69-75`, `src/domain/dungeon/DungeonTravelRuntimePublishedStateServiceAssembly.java:15-18` |
| Map selection from Travel catalog | `CatalogCrudControlsView` event -> `DungeonTravelIntentHandler.consume(CatalogCrudControlsViewInputEvent)` -> `DungeonTravelRuntimeApplicationService` -> `PublishTravelDungeonSessionUseCase` -> `ApplyTravelDungeonSessionUseCase.selectMap` -> `LoadTravelDungeonSessionSurfaceUseCase.loadOrInitialize` -> `LoadDungeonTravelSurfaceUseCase.execute` -> `TravelSurfaceProjection.project` -> `DungeonTravelRuntimePublishedStateServiceAssembly.publishCurrentSession`; readback updates catalog selection and map content | 9 to publication; 11 including visible readback | `src/view/leftbartabs/dungeontravel/DungeonTravelIntentHandler.java:64-78`, `src/domain/dungeon/model/runtime/usecase/PublishTravelDungeonSessionUseCase.java:48-58`, `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonSessionUseCase.java:79-86`, `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonSessionUseCase.java:116-120`, `src/domain/dungeon/model/runtime/usecase/LoadTravelDungeonSessionSurfaceUseCase.java:72-103`, `src/domain/dungeon/model/runtime/usecase/LoadDungeonTravelSurfaceUseCase.java:52-70`, `src/view/leftbartabs/dungeontravel/DungeonTravelContributionModel.java:56-80` |

The dominant Travel baseline is 11 meaningful hops to successful linked
transition party-position mutation and publication. Even presentation-only
projection controls cross 7 boundaries before publication.

## Forwarding, Proxy, And Ceremony Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, registering, or proxying to another object without
owning meaningful decision logic. Interfaces are noted as seam overhead but not
counted as forwarding-only classes. Projection mappers are design-visible
ceremony, but not counted as strict forwarding-only when they reshape data.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/dungeon/DungeonTravelRuntimeApplicationService.java` | Strict facade candidate | Accepts the published command, unpacks boundary fields, and forwards to `PublishTravelDungeonSessionUseCase`. |
| `src/domain/dungeon/model/runtime/usecase/PublishTravelDungeonSessionUseCase.java` | Apply-and-publish wrapper candidate | Converts boundary action code into a runtime command, delegates to `ApplyTravelDungeonSessionUseCase`, then delegates publication. |
| `src/domain/dungeon/DungeonTravelRuntimeServiceAssembly.java` | Composition/cache candidate | Lazily wires authored, party, usecase, published-state, and service objects without owning Travel decisions. |
| `src/domain/dungeon/DungeonTravelRuntimePublishedStateServiceAssembly.java` | Published-state wrapper candidate | Holds the channel/model pair and maps session snapshots before publishing. |
| `src/domain/dungeon/published/TravelDungeonModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with an empty default. |
| `src/view/leftbartabs/dungeontravel/DungeonTravelContribution.java` | Shell registration/bind wrapper candidate | Provides static tab registration and delegates binding to `DungeonTravelBinder`. |
| `src/view/leftbartabs/dungeontravel/DungeonTravelBinder.java` | View composition candidate, not strict forwarding-only | Constructs models/views, wires subscribers, and applies published snapshots to view models. |
| `src/domain/dungeon/DungeonTravelRuntimeSurfaceProjectionServiceAssembly.java` | Published projection ceremony, not strict forwarding-only | Converts runtime session surface data into published travel snapshots and action snapshots. |
| `src/domain/dungeon/DungeonTravelRuntimeMapProjectionServiceAssembly.java` | Published map projection ceremony, not strict forwarding-only | Converts runtime map data into published map snapshots and enum/string vocabulary. |
| `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonSessionUseCase.java` | Dispatcher/session mutation candidate, not strict forwarding-only | Dispatches command variants, owns projection stabilization, and mutates the in-memory session. |
| `src/domain/dungeon/DungeonTravelPartyStateServiceAssembly.java` | Party seam adapter, not strict forwarding-only | Converts Party published models into Travel active-state data. |
| `src/domain/dungeon/DungeonTravelPartyPositionServiceAssembly.java` | Party mutation adapter, not strict forwarding-only | Converts Travel position data into Party movement commands and checks mutation status. |

Strict forwarding/proxy count: 6 product/published classes. Design-visible
ceremony count: 12 classes in the table above, including composition,
projection, dispatcher, and Party seam adapters.

Structural overhead that is intentionally not counted as pure forwarding:
`MoveDungeonTravelActionUseCase`, `ApplyTravelDungeonMovementUseCase`,
`LoadTravelDungeonSessionSurfaceUseCase`, `LoadDungeonTravelSurfaceUseCase`,
and `TravelSurfaceProjection` own current-position resolution, move status,
target lookup, projection construction, party persistence, or unavailable
target behavior.

## String Boundary Round-Trips

String round-trip means a typed, finite-domain, or selected reference value is
carried as a String across an internal Travel boundary and later parsed,
normalized, or matched back into the same finite-domain meaning. Free-form
labels, names, descriptions, and visible status text do not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Map selection id | Catalog items expose map ids as strings, the intent handler parses them to `long`, `Command.fromBoundary` converts the id back to `String`, and `ApplyTravelDungeonSessionUseCase` parses the string again. | `src/view/leftbartabs/dungeontravel/DungeonTravelContributionModel.java:56-80`, `src/view/leftbartabs/dungeontravel/DungeonTravelIntentHandler.java:64-78`, `src/domain/dungeon/model/runtime/usecase/PublishTravelDungeonSessionUseCase.java:48-58`, `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonSessionUseCase.java:79-86`, `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonSessionUseCase.java:116-120` |
| Overlay mode | Overlay mode crosses view/runtime as `modeKey`; Travel session stores the key string, published settings preserve it, and the view maps it back into a private `OverlayMode` enum with `fromKey`. | `src/view/leftbartabs/dungeontravel/DungeonTravelControlsView.java:135-149`, `src/domain/dungeon/model/runtime/travel/session/TravelDungeonSessionValues.java:18-47`, `src/domain/dungeon/DungeonTravelRuntimeSurfaceProjectionServiceAssembly.java:24-35`, `src/view/leftbartabs/dungeontravel/DungeonTravelContributionModel.java:178-225` |
| Travel kind vocabularies | Internal `LocationKind`, `ContextKind`, `TopologyKind`, `AreaKind`, `FeatureKind`, and `ActionKind` are string-backed value wrappers; published projections convert them with enum `valueOf(...name())`, and Party location import converts Party enum names back into internal Travel kind wrappers. | `src/domain/dungeon/model/runtime/travel/session/TravelDungeonSessionValues.java:62-244`, `src/domain/dungeon/model/runtime/travel/session/TravelDungeonSessionValues.java:285-307`, `src/domain/dungeon/DungeonTravelRuntimeSurfaceProjectionServiceAssembly.java:53-117`, `src/domain/dungeon/DungeonTravelRuntimeMapProjectionServiceAssembly.java:13-96`, `src/domain/dungeon/DungeonTravelPartyStateServiceAssembly.java:71-87` |
| Heading token | Party dungeon travel heading enters Travel as `dungeonLocation.heading().name()`, Travel stores and normalizes it as a string token, published projection converts it with `DungeonTravelHeading.valueOf`, and Party-position save converts the string token back to `PartyTravelHeading`. | `src/domain/dungeon/DungeonTravelPartyStateServiceAssembly.java:74-85`, `src/domain/dungeon/model/runtime/travel/session/TravelDungeonSessionSurface.java:81-103`, `src/domain/dungeon/DungeonTravelRuntimeSurfaceProjectionServiceAssembly.java:74-90`, `src/domain/dungeon/DungeonTravelPartyPositionServiceAssembly.java:50-60`, `src/domain/dungeon/DungeonTravelPartyPositionServiceAssembly.java:76-83` |

Baseline count: 4 product String boundary families.

Related typed-boundary diagnostic, not counted as a String round-trip:

| Family | Baseline boundary | Evidence |
| --- | --- | --- |
| Travel command action code | Published `ApplyTravelDungeonSessionCommand.Action` is reduced to `int actionCode`, then `PublishTravelDungeonSessionUseCase.Command.fromBoundary` maps the integer back to its private `ActionKind` enum before creating runtime commands. | `src/domain/dungeon/published/ApplyTravelDungeonSessionCommand.java:54-75`, `src/domain/dungeon/DungeonTravelRuntimeApplicationService.java:22-33`, `src/domain/dungeon/model/runtime/usecase/PublishTravelDungeonSessionUseCase.java:38-59`, `src/domain/dungeon/model/runtime/usecase/PublishTravelDungeonSessionUseCase.java:95-117` |

Primitive typed-boundary diagnostic count: 1 product family.

Diagnostic non-counts:

- Dungeon map names, area labels, action labels, descriptions, and status text
  are authored/display text and are not parsed back into finite protocol
  values.
- SQL text columns are data-layer concerns unless the M4.3 target design
  requires a gateway signature adaptation.
- CSS/style text and accessibility text in the Travel UI are outside the
  Travel protocol.

## Residual Notes For Design

- The M4.3 target design must name a primary structural denominator. This
  baseline exposes both the 40-file runtime denominator and the 69-file
  product-route denominator because parity is proven through the visible
  left-bar route.
- Published seams consumed by Party, shell, dungeon map rendering, adjacent
  statetabs, M4.4, and M4.5 remain byte-compatible unless the approved design
  migrates both sides in the same reviewed step.
- The frozen M4.3 harness inventory from step 1 is
  `dungeonTravelProjectionLevelHarness`, `dungeonEditorCoreBehaviorHarness`,
  `dungeonMapRenderParityHarness`, `checkBehaviorHarnessTopology`,
  `checkHarnessMapConsistency`, and focused handoff for `src/domain/dungeon`
  plus `src/view/leftbartabs/dungeontravel`.
- The next step is a judge-approved target design with target classes,
  representative call chains, deletion list, seam statement, untouched list,
  frozen parity inventory, and metric targets or individually justified
  exceptions.
- This baseline does not authorize wiring or implementation.

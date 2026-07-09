package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.DungeonTopology;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.graph.DungeonTraversalEndpoint;
import src.domain.dungeon.model.core.graph.DungeonTraversalLink;
import src.domain.dungeon.model.core.graph.DungeonTraversalLinkProjection;
import src.domain.dungeon.model.core.graph.DungeonTraversalSource;
import src.domain.dungeon.model.core.graph.DungeonTraversalSourceKind;
import src.domain.dungeon.model.core.projection.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonAreaType;
import src.domain.dungeon.model.core.projection.DungeonBoundaryFacts;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.core.structure.transition.TransitionDestinationTarget;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts.SelectedAction;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionKind;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurfaceProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelDungeonSessionProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelHeading;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection;
import src.domain.dungeon.model.runtime.travel.projection.TravelTransitionTarget;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionCommand;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.LocationKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.MoveStatus;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.OverworldTarget;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonMovementUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.model.runtime.usecase.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.model.runtime.usecase.LoadTravelDungeonSessionSurfaceUseCase;
import src.domain.dungeon.model.runtime.usecase.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.model.runtime.usecase.StabilizeTravelDungeonProjectionUseCase;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.structure.DungeonMapMetadata;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;
import src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionAnchor;

final class DungeonRuntimeProjectionInvariantHarness {

    private static final String OWNER = "RuntimeProjectionInvariantHarness";

    private DungeonRuntimeProjectionInvariantHarness() {
    }

    static void run(List<String> results) {
        assertRuntimeTraversalProjection();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-PATH-005",
                "Runtime travel traversal actions consume the authored derived traversal-link source");
        assertRuntimeTransitionProjection();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-TRANSITION-005",
                "Runtime travel transition actions recompute from authored transition facts");
        assertRuntimePositionProjectionDefaults();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-TRANSITION-006",
                "Runtime travel position projection chooses a deterministic transition entry before cell fallback");
        assertSelectedMapBootstrapUsesTransitionDefaultEvenWhenOriginCellExists();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-TRANSITION-007",
                "Selected-map travel bootstrap resolves authored transition entry before valid origin-cell fallback");
    }

    private static void assertRuntimeTraversalProjection() {
        Cell source = new Cell(0, 0, 0);
        Cell target = new Cell(1, 0, 0);
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(3L), "Runtime Paths");
        DungeonDerivedState derived = derivedState(List.of(
                        area(DungeonAreaType.ROOM, 10L, "Start", List.of(source)),
                        area(DungeonAreaType.ROOM, 20L, "Ziel", List.of(target))),
                List.of(new DungeonBoundaryFacts(
                        "door",
                        30L,
                        "Tuer",
                        Edge.sideOf(source, Direction.EAST),
                        DungeonTopologyRef.empty())),
                List.of(traversalLink(30L, "Tuer", source, 10L, "Start", target, 20L, "Ziel")));
        TravelSurfaceFacts surface = project(map, derived, new Cell(0, 0, 0));
        TravelActionFacts traversal = firstActionOfKind(surface, TravelActionKind.TRAVERSAL);

        assertEquals("Start", surface.areaLabel(),
                "runtime path projection resolves active authored area");
        assertTrue(traversal != null, "runtime path projection publishes traversal action");
        assertEquals(new Cell(1, 0, 0), traversal.targetPosition().tile(),
                "runtime path projection recomputes traversal target from authored boundary facts");
        assertEquals(TravelTransitionTarget.absent(), traversal.transitionTarget(),
                "runtime path projection keeps traversal state outside transition targets");

        TravelSurfaceFacts noLinkSurface = project(map, derivedState(derived.map().areas(), derived.map().boundaries()),
                new Cell(0, 0, 0));
        assertEquals(null, firstActionOfKind(noLinkSurface, TravelActionKind.TRAVERSAL),
                "runtime path projection must not rebuild traversal links outside derived state");
        assertRuntimeCorridorTraversalProjection();
    }

    private static void assertRuntimeCorridorTraversalProjection() {
        Cell roomTile = new Cell(0, 0, 0);
        Cell corridorStart = new Cell(1, 0, 0);
        Cell corridorEnd = new Cell(2, 0, 0);
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(31L), "Runtime Corridors");
        List<DungeonAreaFacts> areas = List.of(
                area(DungeonAreaType.ROOM, 310L, "Start", List.of(roomTile)),
                area(DungeonAreaType.CORRIDOR, 320L, "Gang 320", List.of(corridorStart, corridorEnd)));
        DungeonMapFacts mapFacts = new DungeonMapFacts(DungeonTopology.SQUARE, 3, 1, areas, List.of());
        DungeonDerivedState withCorridorLinks = new DungeonDerivedState(
                mapFacts,
                List.of(),
                null,
                new DungeonTraversalLinkProjection().project(map, mapFacts));
        TravelSurfaceFacts surface = project(map, withCorridorLinks, corridorStart);
        TravelActionFacts traversal = firstActionOfKind(surface, TravelActionKind.TRAVERSAL);

        assertEquals("Gang 320", surface.areaLabel(),
                "runtime corridor traversal projection resolves active corridor area");
        assertTrue(traversal != null,
                "runtime corridor traversal projection publishes corridor traversal action from derived links");
        assertEquals("Gang 320", traversal.label(),
                "runtime corridor traversal projection keeps corridor source label");
        assertEquals(corridorEnd, traversal.targetPosition().tile(),
                "runtime corridor traversal projection follows the derived corridor segment target");

        TravelSurfaceFacts noLinkSurface = project(map, derivedState(areas, List.of()), corridorStart);
        assertEquals(null, firstActionOfKind(noLinkSurface, TravelActionKind.TRAVERSAL),
                "runtime corridor traversal projection must not rebuild corridor links from corridor cells");
        assertCrossLevelCorridorCellsDoNotCreateCorridorTraversal();
    }

    private static void assertCrossLevelCorridorCellsDoNotCreateCorridorTraversal() {
        Cell lower = new Cell(4, 0, 0);
        Cell upper = new Cell(4, 0, 1);
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(32L), "Runtime Vertical Corridors");
        List<DungeonAreaFacts> areas = List.of(
                area(DungeonAreaType.CORRIDOR, 330L, "Vertical Gang", List.of(lower, upper)));
        DungeonMapFacts mapFacts = new DungeonMapFacts(DungeonTopology.SQUARE, 5, 1, areas, List.of());
        DungeonDerivedState derived = new DungeonDerivedState(
                mapFacts,
                List.of(),
                null,
                new DungeonTraversalLinkProjection().project(map, mapFacts));
        TravelSurfaceFacts surface = project(map, derived, lower);

        assertTrue(derived.traversalLinks().isEmpty(),
                "runtime corridor traversal projection must not derive cross-level corridor links");
        assertEquals(null, firstActionOfKind(surface, TravelActionKind.TRAVERSAL),
                "runtime corridor traversal projection keeps cross-level travel stair-owned");
    }

    private static void assertRuntimeTransitionProjection() {
        Cell anchor = new Cell(2, 0, 0);
        DungeonMap emptyMap = DungeonMapAuthoring.empty(new DungeonMapIdentity(4L), "Runtime Transitions");
        DungeonMap map = emptyMap.withTransitionCatalog(emptyMap.transitionCatalog().withCreated(
                40L,
                emptyMap.metadata().mapId().value(),
                TransitionAnchor.cell(anchor),
                TransitionDestination.dungeonMap(9L, 12L)));
        DungeonDerivedState derived = derivedState(
                List.of(area(DungeonAreaType.ROOM, 11L, "Portalraum", List.of(anchor))),
                List.of());
        TravelSurfaceFacts surface = project(map, derived, new Cell(2, 0, 0));
        TravelActionFacts transition = firstActionOfKind(surface, TravelActionKind.TRANSITION);

        assertEquals("Portalraum", surface.areaLabel(),
                "runtime transition projection resolves active authored area");
        assertTrue(transition != null, "runtime transition projection publishes transition action");
        assertEquals(new TravelPositionFacts(
                        4L,
                        TravelPositionFacts.LocationKind.TRANSITION,
                        40L,
                        new Cell(2, 0, 0),
                        TravelHeading.SOUTH),
                transition.targetPosition(),
                "runtime transition projection recomputes local transition position from authored facts");
        assertEquals(TravelTransitionTarget.dungeonMap(9L, TransitionDestinationTarget.present(12L)),
                transition.transitionTarget(),
                "runtime transition projection recomputes transition target from authored destination facts");

        DungeonMap unlinkedMap = emptyMap.withTransitionCatalog(emptyMap.transitionCatalog().withCreated(
                41L,
                emptyMap.metadata().mapId().value(),
                TransitionAnchor.cell(anchor),
                TransitionDestination.unlinkedEntrance()));
        TravelSurfaceFacts unlinkedSurface = project(unlinkedMap, derived, new Cell(2, 0, 0));
        TravelActionFacts unlinkedTransition = firstActionOfKind(unlinkedSurface, TravelActionKind.TRANSITION);
        assertTrue(unlinkedTransition != null, "runtime transition projection publishes unlinked entrance action");
        assertEquals("Kein Ziel verknuepft", unlinkedTransition.destinationLabel(),
                "runtime transition projection explains missing unlinked entrance destination");
        assertEquals(TravelTransitionTarget.absent(), unlinkedTransition.transitionTarget(),
                "runtime transition projection blocks travel target for unlinked entrance");
        assertUnlinkedTransitionMovementBlocked(
                unlinkedMap,
                unlinkedTransition,
                SelectedAction.atRow(indexOfAction(unlinkedSurface, unlinkedTransition)));
    }

    private static void assertUnlinkedTransitionMovementBlocked(
            DungeonMap unlinkedMap,
            TravelActionFacts unlinkedTransition,
            SelectedAction selectedAction
    ) {
        DungeonMapRepository repository = repositoryOf(
                unlinkedMap,
                DungeonMapAuthoring.empty(new DungeonMapIdentity(99L), "Unused Target"));
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository);
        BuildDungeonDerivedStateUseCase deriveStateUseCase = new BuildDungeonDerivedStateUseCase();
        MoveDungeonTravelActionUseCase moveUseCase = new MoveDungeonTravelActionUseCase(
                loadDungeonMapUseCase,
                repository,
                deriveStateUseCase);
        TravelPositionFacts transitionPosition = java.util.Objects.requireNonNull(
                unlinkedTransition.targetPosition(),
                "unlinkedTransition.targetPosition");
        TravelPositionFacts position = new TravelPositionFacts(
                unlinkedMap.metadata().mapId().value(),
                TravelPositionFacts.LocationKind.TILE,
                0L,
                transitionPosition.tile(),
                TravelHeading.SOUTH);

        MoveResultData moveResult = moveUseCase.execute(new MoveDungeonTravelActionUseCase.Input(
                position,
                selectedAction));
        assertEquals(MoveStatus.TARGET_UNAVAILABLE, moveResult.status(),
                "runtime unlinked entrance movement must report missing destination");
        assertContains(moveResult.surface().statusLabel(), "Übergangsziel ist nicht verfügbar.",
                "runtime unlinked entrance movement explains missing destination");
        assertEquals(null, moveResult.externalTarget(),
                "runtime unlinked entrance movement must not publish an external target");

        CountingTravelPartyPositionRepository partyPositions = new CountingTravelPartyPositionRepository();
        TravelPartyStateRepository partyStateRepository =
                () -> new ActiveTravelStateData(List.of(12L), null);
        LoadDungeonTravelSurfaceUseCase loadSurfaceUseCase = new LoadDungeonTravelSurfaceUseCase(
                loadDungeonMapUseCase,
                deriveStateUseCase);
        ApplyTravelDungeonMovementUseCase applyUseCase = new ApplyTravelDungeonMovementUseCase(
                partyStateRepository,
                partyPositions,
                loadSurfaceUseCase,
                moveUseCase);
        SurfaceData currentSurface = TravelDungeonSessionProjectionMapper.toRuntimeSurface(
                new TravelSurfaceProjection().project(
                        TravelAuthoredSurfaceProjectionMapper.from(
                                unlinkedMap,
                                deriveStateUseCase.execute(unlinkedMap)),
                        position,
                        ""));
        SurfaceData applied = applyUseCase.move(
                currentSurface.position(),
                currentSurface,
                selectedAction);
        assertContains(applied.statusLabel(), "Übergangsziel ist nicht verfügbar.",
                "runtime unlinked entrance apply path explains missing destination");
        assertEquals(0, partyPositions.savedDungeonPositions(),
                "runtime unlinked entrance must not save dungeon movement");
        assertEquals(0, partyPositions.savedOverworldPositions(),
                "runtime unlinked entrance must not save overworld movement");
    }

    private static void assertRuntimePositionProjectionDefaults() {
        assertValidPreferredTileWins();
        assertInvalidOrAbsentPreferredUsesPlacedTransition();
        assertNoPlacedTransitionFallsBackToFirstAuthoredCell();
        assertEmptySurfaceFallsBackToOrigin();
    }

    private static void assertValidPreferredTileWins() {
        Cell preferredTile = new Cell(3, 1, 0);
        TravelAuthoredSurface authoredSurface = surfaceWithAreasAndTransitions(
                5L,
                "Preferred Tile",
                List.of(
                        area(DungeonAreaType.ROOM, 51L, "Start", List.of(new Cell(0, 0, 0))),
                        area(DungeonAreaType.ROOM, 52L, "Goal", List.of(preferredTile))),
                List.of(new src.domain.dungeon.model.core.structure.transition.Transition(
                        70L,
                        5L,
                        "",
                        TransitionAnchor.cell(new Cell(0, 0, 0)),
                        TransitionDestination.dungeonMap(8L, 9L),
                        null)));

        TravelPositionFacts resolved = new TravelSurfaceProjection().resolvePosition(
                authoredSurface,
                new TravelPositionFacts(
                        5L,
                        TravelPositionFacts.LocationKind.TILE,
                        0L,
                        preferredTile,
                        TravelHeading.WEST));

        assertEquals(new TravelPositionFacts(
                        5L,
                        TravelPositionFacts.LocationKind.TILE,
                        0L,
                        preferredTile,
                        TravelHeading.WEST),
                resolved,
                "valid preferred runtime tile must be preserved exactly");
    }

    private static void assertInvalidOrAbsentPreferredUsesPlacedTransition() {
        Cell lowerIdAnchor = new Cell(4, 2, 0);
        TravelAuthoredSurface authoredSurface = surfaceWithAreasAndTransitions(
                6L,
                "Transition Entry",
                List.of(
                        area(DungeonAreaType.ROOM, 61L, "Entry", List.of(lowerIdAnchor)),
                        area(DungeonAreaType.ROOM, 62L, "Other", List.of(new Cell(6, 2, 0)))),
                List.of(
                        new src.domain.dungeon.model.core.structure.transition.Transition(
                                90L,
                                6L,
                                "",
                                TransitionAnchor.cell(new Cell(6, 2, 0)),
                                TransitionDestination.dungeonMap(10L, 11L),
                                null),
                        new src.domain.dungeon.model.core.structure.transition.Transition(
                                80L,
                                6L,
                                "",
                                TransitionAnchor.cell(lowerIdAnchor),
                                TransitionDestination.dungeonMap(10L, 12L),
                                null),
                        new src.domain.dungeon.model.core.structure.transition.Transition(
                                70L,
                                6L,
                                "",
                                TransitionAnchor.none(),
                                TransitionDestination.dungeonMap(10L, 13L),
                                null)));

        TravelSurfaceProjection projection = new TravelSurfaceProjection();
        TravelPositionFacts fromInvalidPreferred = projection.resolvePosition(
                authoredSurface,
                new TravelPositionFacts(
                        6L,
                        TravelPositionFacts.LocationKind.TILE,
                        0L,
                        new Cell(99, 99, 0),
                        TravelHeading.EAST));
        TravelPositionFacts fromAbsentPreferred = projection.resolvePosition(authoredSurface, null);

        assertEquals(new TravelPositionFacts(
                        6L,
                        TravelPositionFacts.LocationKind.TRANSITION,
                        80L,
                        lowerIdAnchor,
                        TravelHeading.EAST),
                fromInvalidPreferred,
                "invalid preferred runtime tile must fall back to the lowest-id placed transition anchor");
        assertEquals(new TravelPositionFacts(
                        6L,
                        TravelPositionFacts.LocationKind.TRANSITION,
                        80L,
                        lowerIdAnchor,
                        TravelHeading.defaultHeading()),
                fromAbsentPreferred,
                "absent preferred runtime tile must fall back to the lowest-id placed transition anchor");
    }

    private static void assertNoPlacedTransitionFallsBackToFirstAuthoredCell() {
        Cell expected = new Cell(1, 1, 0);
        TravelAuthoredSurface authoredSurface = surfaceWithAreasAndTransitions(
                7L,
                "Cell Fallback",
                List.of(
                        area(DungeonAreaType.ROOM, 71L, "B", List.of(new Cell(2, 1, 0))),
                        area(DungeonAreaType.ROOM, 72L, "A", List.of(expected))),
                List.of(new src.domain.dungeon.model.core.structure.transition.Transition(
                        100L,
                        7L,
                        "",
                        TransitionAnchor.none(),
                        TransitionDestination.dungeonMap(12L, 14L),
                        null)));

        TravelPositionFacts resolved = new TravelSurfaceProjection().resolvePosition(
                authoredSurface,
                new TravelPositionFacts(
                        7L,
                        TravelPositionFacts.LocationKind.TILE,
                        0L,
                        new Cell(99, 99, 0),
                        TravelHeading.NORTH));

        assertEquals(new TravelPositionFacts(
                        7L,
                        TravelPositionFacts.LocationKind.TILE,
                        0L,
                        expected,
                        TravelHeading.NORTH),
                resolved,
                "missing placed transition anchor must fall back to the first authored cell");
    }

    private static void assertEmptySurfaceFallsBackToOrigin() {
        TravelPositionFacts resolved = new TravelSurfaceProjection().resolvePosition(
                TravelAuthoredSurface.empty(),
                null);

        assertEquals(new TravelPositionFacts(
                        1L,
                        TravelPositionFacts.LocationKind.TILE,
                        0L,
                        new Cell(0, 0, 0),
                        TravelHeading.defaultHeading()),
                resolved,
                "empty runtime surface must fall back to origin");
    }

    private static void assertSelectedMapBootstrapUsesTransitionDefaultEvenWhenOriginCellExists() {
        long selectedMapId = 8L;
        long entryTransitionId = 140L;
        Cell entryAnchor = new Cell(2, 0, 0);
        DungeonMap selectedMap = authoredTravelBootstrapMap(
                selectedMapId,
                "Selected Bootstrap Map",
                List.of(new Cell(0, 0, 0), entryAnchor),
                entryTransitionId,
                entryAnchor);
        DungeonMap firstMap = authoredTravelBootstrapMap(
                3L,
                "First Map",
                List.of(new Cell(9, 9, 0)),
                0L,
                null);
        DungeonMapRepository repository = repositoryOf(firstMap, selectedMap);
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository);
        BuildDungeonDerivedStateUseCase deriveStateUseCase = new BuildDungeonDerivedStateUseCase();
        LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase =
                new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, deriveStateUseCase);
        TravelPartyStateRepository partyStateRepository = () -> new ActiveTravelStateData(List.of(), null);
        TravelPartyPositionRepository partyPositionRepository = new TravelPartyPositionRepository() {
            @Override
            public boolean saveDungeonPosition(PositionData position, List<Long> characterIds) {
                return true;
            }

            @Override
            public boolean saveOverworldPosition(
                    src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.OverworldTarget target,
                    List<Long> characterIds
            ) {
                return true;
            }
        };
        ApplyTravelDungeonSessionUseCase useCase = new ApplyTravelDungeonSessionUseCase(
                new LoadTravelDungeonSessionSurfaceUseCase(
                        partyStateRepository,
                        partyPositionRepository,
                        loadDungeonTravelSurfaceUseCase),
                new ApplyTravelDungeonMovementUseCase(
                        partyStateRepository,
                        partyPositionRepository,
                        loadDungeonTravelSurfaceUseCase,
                        new MoveDungeonTravelActionUseCase(
                                loadDungeonMapUseCase,
                                repository,
                                deriveStateUseCase)),
                new StabilizeTravelDungeonProjectionUseCase());

        SnapshotData snapshot = useCase.applyCommand(
                TravelDungeonSessionCommand.selectMap(Long.toString(selectedMapId)));
        PositionData position = snapshot.surface() == null ? null : snapshot.surface().position();

        assertEquals(new PositionData(
                        selectedMapId,
                        LocationKind.TRANSITION,
                        entryTransitionId,
                        entryAnchor,
                        "SOUTH"),
                position,
                "selected-map bootstrap must use the authored transition entry even when (0,0,0) is a valid cell");
    }

    private static TravelSurfaceFacts project(DungeonMap map, DungeonDerivedState derived, Cell activeTile) {
        TravelAuthoredSurface authoredSurface = TravelAuthoredSurfaceProjectionMapper.from(map, derived);
        return new TravelSurfaceProjection().project(
                authoredSurface,
                new TravelPositionFacts(
                        map.metadata().mapId().value(),
                        TravelPositionFacts.LocationKind.TILE,
                        0L,
                        activeTile,
                        TravelHeading.SOUTH),
                "");
    }

    private static TravelAuthoredSurface surfaceWithAreasAndTransitions(
            long mapId,
            String mapName,
            List<DungeonAreaFacts> areas,
            List<src.domain.dungeon.model.core.structure.transition.Transition> transitions
    ) {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(mapId), mapName);
        for (src.domain.dungeon.model.core.structure.transition.Transition transition : transitions) {
            map = map.withTransitionCatalog(map.transitionCatalog().withCreated(
                    transition.transitionId(),
                    map.metadata().mapId().value(),
                    transition.anchor(),
                    transition.destination()));
        }
        return TravelAuthoredSurfaceProjectionMapper.from(map, derivedState(areas, List.of()));
    }

    private static DungeonMap authoredTravelBootstrapMap(
            long mapId,
            String mapName,
            List<Cell> roomCells,
            long transitionId,
            Cell transitionAnchor
    ) {
        long clusterId = 41L + mapId;
        long roomId = 81L + mapId;
        DungeonRoomCluster cluster = DungeonRoomCluster.fromPersistenceState(
                clusterId,
                mapId,
                mapName,
                new Cell(0, 0, 0),
                RoomClusterFloorMap.fromCells(roomCells),
                DungeonClusterBoundary.orderedByLevel(List.of()));
        DungeonMap map = new DungeonMap(
                new DungeonMapMetadata(new DungeonMapIdentity(mapId), mapName),
                SpatialTopology.defaultGrid().withRoomClusters(List.of(cluster)),
                new RoomCatalog(List.of(new DungeonRoom(
                        roomId,
                        mapId,
                        clusterId,
                        mapName,
                        Map.of(0, roomCells.getFirst()),
                        null))),
                List.of(),
                new StairCollection(List.of()),
                new TransitionCatalog(List.of()),
                0L);
        if (transitionAnchor == null || transitionId <= 0L) {
            return map;
        }
        return map.withTransitionCatalog(map.transitionCatalog().withCreated(
                transitionId,
                mapId,
                TransitionAnchor.cell(transitionAnchor),
                TransitionDestination.dungeonMap(99L, 7L)));
    }

    private static DungeonMapRepository repositoryOf(DungeonMap firstMap, DungeonMap secondMap) {
        Map<Long, DungeonMap> mapsById = Map.of(
                firstMap.metadata().mapId().value(), firstMap,
                secondMap.metadata().mapId().value(), secondMap);
        return new DungeonMapRepository() {
            @Override
            public DungeonMapIdentity nextMapId() {
                throw new UnsupportedOperationException();
            }

            @Override
            public long nextStairId() {
                throw new UnsupportedOperationException();
            }

            @Override
            public long nextTransitionId() {
                throw new UnsupportedOperationException();
            }

            @Override
            public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
                return Optional.ofNullable(mapId == null ? null : mapsById.get(mapId.value()));
            }

            @Override
            public List<DungeonMap> searchByName(String query) {
                return List.of();
            }

            @Override
            public Optional<DungeonMap> firstMap() {
                return Optional.of(firstMap);
            }

            @Override
            public DungeonMap save(DungeonMap dungeonMap) {
                return dungeonMap;
            }

            @Override
            public List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps) {
                return dungeonMaps == null ? List.of() : List.copyOf(dungeonMaps);
            }

            @Override
            public void delete(DungeonMapIdentity mapId) {
            }
        };
    }

    private static DungeonDerivedState derivedState(
            List<DungeonAreaFacts> areas,
            List<DungeonBoundaryFacts> boundaries
    ) {
        return derivedState(areas, boundaries, List.of());
    }

    private static DungeonDerivedState derivedState(
            List<DungeonAreaFacts> areas,
            List<DungeonBoundaryFacts> boundaries,
            List<DungeonTraversalLink> traversalLinks
    ) {
        return new DungeonDerivedState(
                new DungeonMapFacts(DungeonTopology.SQUARE, 2, 1, areas, boundaries),
                List.of(),
                null,
                traversalLinks);
    }

    private static DungeonAreaFacts area(
            DungeonAreaType kind,
            long id,
            String label,
            List<Cell> cells
    ) {
        return new DungeonAreaFacts(kind, id, 0L, label, cells, DungeonTopologyRef.empty());
    }

    private static DungeonTraversalLink traversalLink(
            long sourceId,
            String label,
            Cell first,
            long firstAreaId,
            String firstAreaLabel,
            Cell second,
            long secondAreaId,
            String secondAreaLabel
    ) {
        return new DungeonTraversalLink(
                "door:" + sourceId + ":" + first + ":" + second,
                new DungeonTraversalSource(DungeonTraversalSourceKind.DOOR, sourceId, label),
                new DungeonTraversalEndpoint(first, firstAreaId, firstAreaLabel),
                new DungeonTraversalEndpoint(second, secondAreaId, secondAreaLabel));
    }

    private static TravelActionFacts firstActionOfKind(TravelSurfaceFacts surface, TravelActionKind kind) {
        for (TravelActionFacts action : surface.actions()) {
            if (action.kind() == kind) {
                return action;
            }
        }
        return null;
    }

    private static int indexOfAction(TravelSurfaceFacts surface, TravelActionFacts expected) {
        List<TravelActionFacts> actions = surface.actions();
        for (int index = 0; index < actions.size(); index++) {
            if (actions.get(index).equals(expected)) {
                return index;
            }
        }
        return -1;
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new IllegalStateException(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertContains(String actual, String expectedFragment, String message) {
        if (actual == null || !actual.contains(expectedFragment)) {
            throw new IllegalStateException(message + " expected to contain <"
                    + expectedFragment + "> but was <" + actual + ">.");
        }
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) {
            throw new IllegalStateException(message);
        }
    }

    private static final class CountingTravelPartyPositionRepository implements TravelPartyPositionRepository {

        private int savedDungeonPositions;
        private int savedOverworldPositions;

        @Override
        public boolean saveDungeonPosition(PositionData position, List<Long> characterIds) {
            savedDungeonPositions++;
            return true;
        }

        @Override
        public boolean saveOverworldPosition(OverworldTarget target, List<Long> characterIds) {
            savedOverworldPositions++;
            return true;
        }

        private int savedDungeonPositions() {
            return savedDungeonPositions;
        }

        private int savedOverworldPositions() {
            return savedOverworldPositions;
        }
    }
}

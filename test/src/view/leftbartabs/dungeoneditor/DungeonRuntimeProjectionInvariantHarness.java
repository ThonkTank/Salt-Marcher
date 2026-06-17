package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.DungeonTopology;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.projection.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonAreaType;
import src.domain.dungeon.model.core.projection.DungeonBoundaryFacts;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionKind;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurfaceProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelHeading;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection;
import src.domain.dungeon.model.runtime.travel.projection.TravelTransitionTarget;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.LocationKind;
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
                "Runtime travel traversal actions recompute from authored area and boundary facts");
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
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 10L, "Start", List.of(source)),
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 20L, "Ziel", List.of(target))),
                List.of(new DungeonBoundaryFacts(
                        "door",
                        30L,
                        "Tuer",
                        Edge.sideOf(source, Direction.EAST),
                        DungeonTopologyRef.empty())));
        TravelSurfaceFacts surface = project(map, derived, new Cell(0, 0, 0));
        TravelActionFacts traversal = firstActionOfKind(surface, TravelActionKind.TRAVERSAL);

        assertEquals("Start", surface.areaLabel(),
                "runtime path projection resolves active authored area");
        assertTrue(traversal != null, "runtime path projection publishes traversal action");
        assertEquals(new Cell(1, 0, 0), traversal.targetPosition().tile(),
                "runtime path projection recomputes traversal target from authored boundary facts");
        assertEquals(null, traversal.transitionTarget(),
                "runtime path projection keeps traversal state outside transition targets");
    }

    private static void assertRuntimeTransitionProjection() {
        Cell anchor = new Cell(2, 0, 0);
        DungeonMap emptyMap = DungeonMapAuthoring.empty(new DungeonMapIdentity(4L), "Runtime Transitions");
        DungeonMap map = emptyMap.withTransitionCatalog(emptyMap.transitionCatalog().withCreated(
                40L,
                emptyMap.metadata().mapId().value(),
                anchor,
                TransitionDestination.dungeonMap(9L, 12L)));
        DungeonDerivedState derived = derivedState(
                List.of(new DungeonAreaFacts(DungeonAreaType.ROOM, 11L, "Portalraum", List.of(anchor))),
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
        assertEquals(TravelTransitionTarget.dungeonMap(9L, 12L), transition.transitionTarget(),
                "runtime transition projection recomputes transition target from authored destination facts");
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
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 51L, "Start", List.of(new Cell(0, 0, 0))),
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 52L, "Goal", List.of(preferredTile))),
                List.of(new src.domain.dungeon.model.core.structure.transition.Transition(
                        70L,
                        5L,
                        "",
                        new Cell(0, 0, 0),
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
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 61L, "Entry", List.of(lowerIdAnchor)),
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 62L, "Other", List.of(new Cell(6, 2, 0)))),
                List.of(
                        new src.domain.dungeon.model.core.structure.transition.Transition(
                                90L,
                                6L,
                                "",
                                new Cell(6, 2, 0),
                                TransitionDestination.dungeonMap(10L, 11L),
                                null),
                        new src.domain.dungeon.model.core.structure.transition.Transition(
                                80L,
                                6L,
                                "",
                                lowerIdAnchor,
                                TransitionDestination.dungeonMap(10L, 12L),
                                null),
                        new src.domain.dungeon.model.core.structure.transition.Transition(
                                70L,
                                6L,
                                "",
                                null,
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
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 71L, "B", List.of(new Cell(2, 1, 0))),
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 72L, "A", List.of(expected))),
                List.of(new src.domain.dungeon.model.core.structure.transition.Transition(
                        100L,
                        7L,
                        "",
                        null,
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

        SnapshotData snapshot = useCase.applyCommand("SELECT_MAP", Long.toString(selectedMapId), 0, "OFF", 0, 1.0, List.of());
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
                transitionAnchor,
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
        return new DungeonDerivedState(
                new DungeonMapFacts(DungeonTopology.SQUARE, 2, 1, areas, boundaries),
                List.of(),
                null,
                List.of());
    }

    private static TravelActionFacts firstActionOfKind(TravelSurfaceFacts surface, TravelActionKind kind) {
        for (TravelActionFacts action : surface.actions()) {
            if (action.kind() == kind) {
                return action;
            }
        }
        return null;
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new IllegalStateException(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) {
            throw new IllegalStateException(message);
        }
    }
}

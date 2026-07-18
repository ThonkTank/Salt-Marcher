package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.dungeon.DungeonTestAssembly;
import features.dungeon.application.travel.DungeonTravelRuntimeApplicationService;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.graph.DungeonTraversalEndpoint;
import features.dungeon.domain.core.graph.DungeonTraversalLink;
import features.dungeon.domain.core.graph.DungeonTraversalLinkProjection;
import features.dungeon.domain.core.graph.DungeonTraversalSource;
import features.dungeon.domain.core.graph.DungeonTraversalSourceKind;
import features.dungeon.domain.core.projection.DungeonAreaFacts;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonBoundaryFacts;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.projection.DungeonDerivedStateProjection;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.domain.core.structure.transition.TransitionDestinationTarget;
import features.dungeon.application.travel.projection.TravelActionFacts;
import features.dungeon.application.travel.projection.TravelActionFacts.SelectedAction;
import features.dungeon.application.travel.projection.TravelActionKind;
import features.dungeon.application.travel.projection.TravelAuthoredSurface;
import features.dungeon.application.travel.projection.TravelAuthoredSurfaceProjectionMapper;
import features.dungeon.application.travel.projection.TravelHeading;
import features.dungeon.application.travel.projection.TravelPositionFacts;
import features.dungeon.application.travel.projection.TravelSurfaceFacts;
import features.dungeon.application.travel.projection.TravelSurfaceProjection;
import features.dungeon.application.travel.projection.TravelTransitionTarget;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.domain.core.structure.DungeonMapMetadata;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.room.RoomClusterFloorMap;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.api.DungeonTravelLocationKind;
import features.dungeon.api.DungeonTravelPosition;
import features.dungeon.api.TravelDungeonAction;
import features.dungeon.api.TravelDungeonModel;
import features.dungeon.api.TravelDungeonSnapshot;
import features.party.api.PartyApi;
import features.party.PartyServiceAssembly;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.PartyDungeonTravelLocationKind;
import features.party.api.PartyDungeonTravelLocationSnapshot;
import features.party.api.PartyTravelHeading;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.PartyTravelTile;

final class DungeonRuntimeProjectionInvariantScenarios {


    private DungeonRuntimeProjectionInvariantScenarios() {
    }

    static void run() {
        assertRuntimeTraversalProjection();

        assertRuntimeTransitionProjection();

        assertRuntimePositionProjectionDefaults();

        assertSelectedMapBootstrapUsesTransitionDefaultEvenWhenOriginCellExists();

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
        DungeonMap map = withTransition(emptyMap, new Transition(
                40L,
                emptyMap.metadata().mapId().value(),
                "",
                TransitionAnchor.cell(anchor),
                TransitionDestination.dungeonMap(9L, 12L),
                null));
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
                        LocationKind.TRANSITION,
                        40L,
                        new Cell(2, 0, 0),
                        TravelHeading.SOUTH),
                transition.targetPosition(),
                "runtime transition projection recomputes local transition position from authored facts");
        assertEquals(TravelTransitionTarget.dungeonMap(9L, TransitionDestinationTarget.present(12L)),
                transition.transitionTarget(),
                "runtime transition projection recomputes transition target from authored destination facts");

        DungeonMap unlinkedMap = withTransition(emptyMap, new Transition(
                41L,
                emptyMap.metadata().mapId().value(),
                "",
                TransitionAnchor.cell(anchor),
                TransitionDestination.unlinkedEntrance(),
                null));
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
        DungeonTestStore repository = repositoryOf(
                unlinkedMap,
                DungeonMapAuthoring.empty(new DungeonMapIdentity(99L), "Unused Target"));
        TravelPositionFacts transitionPosition = java.util.Objects.requireNonNull(
                unlinkedTransition.targetPosition(),
                "unlinkedTransition.targetPosition");
        TravelPositionFacts position = new TravelPositionFacts(
                unlinkedMap.metadata().mapId().value(),
                LocationKind.TILE,
                0L,
                transitionPosition.tile(),
                TravelHeading.SOUTH);

        TravelRuntimeFixture services = travelServices(repository);
        movePartyTokenToTravelPosition(services.party().application(), position);
        DungeonTravelRuntimeApplicationService travel = services.dungeon().travel();
        TravelDungeonModel travelModel = services.dungeon().travelModel();
        PartyTravelPositionsModel partyPositions = services.party().travelPositions();

        travel.refresh();
        TravelDungeonSnapshot beforeSnapshot = travelModel.current();
        TravelDungeonAction publishedAction = publishedActionAt(
                beforeSnapshot,
                selectedAction.rowIndex(),
                "runtime unlinked entrance public route exposes selected transition action");
        assertContains(publishedAction.label(), "Kein Ziel verknuepft",
                "runtime unlinked entrance movement must report missing destination");
        PartyTravelPositionsResult partyBefore = partyPositions.current();

        travel.performAction(selectedAction.rowIndex());

        TravelDungeonSnapshot afterSnapshot = travelModel.current();
        assertContains(afterSnapshot.workspaceState().statusLabel(), "Übergangsziel ist nicht verfügbar.",
                "runtime unlinked entrance apply path explains missing destination");
        assertEquals(beforeSnapshot.travelSurface().position(), afterSnapshot.travelSurface().position(),
                "runtime unlinked entrance movement must not publish an external target");
        PartyTravelPositionsResult partyAfter = partyPositions.current();
        assertEquals(partyBefore.partyTokenLocation(), partyAfter.partyTokenLocation(),
                "runtime unlinked entrance must not save dungeon movement");
        assertEquals(partyBefore.partyTokenCharacterIds(), partyAfter.partyTokenCharacterIds(),
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
                List.of(new features.dungeon.domain.core.structure.transition.Transition(
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
                        LocationKind.TILE,
                        0L,
                        preferredTile,
                        TravelHeading.WEST));

        assertEquals(new TravelPositionFacts(
                        5L,
                        LocationKind.TILE,
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
                        new features.dungeon.domain.core.structure.transition.Transition(
                                90L,
                                6L,
                                "",
                                TransitionAnchor.cell(new Cell(6, 2, 0)),
                                TransitionDestination.dungeonMap(10L, 11L),
                                null),
                        new features.dungeon.domain.core.structure.transition.Transition(
                                80L,
                                6L,
                                "",
                                TransitionAnchor.cell(lowerIdAnchor),
                                TransitionDestination.dungeonMap(10L, 12L),
                                null),
                        new features.dungeon.domain.core.structure.transition.Transition(
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
                        LocationKind.TILE,
                        0L,
                        new Cell(99, 99, 0),
                        TravelHeading.EAST));
        TravelPositionFacts fromAbsentPreferred = projection.resolvePosition(authoredSurface, null);

        assertEquals(new TravelPositionFacts(
                        6L,
                        LocationKind.TRANSITION,
                        80L,
                        lowerIdAnchor,
                        TravelHeading.EAST),
                fromInvalidPreferred,
                "invalid preferred runtime tile must fall back to the lowest-id placed transition anchor");
        assertEquals(new TravelPositionFacts(
                        6L,
                        LocationKind.TRANSITION,
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
                List.of(new features.dungeon.domain.core.structure.transition.Transition(
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
                        LocationKind.TILE,
                        0L,
                        new Cell(99, 99, 0),
                        TravelHeading.NORTH));

        assertEquals(new TravelPositionFacts(
                        7L,
                        LocationKind.TILE,
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
                        LocationKind.TILE,
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
        DungeonTestStore repository = repositoryOf(firstMap, selectedMap);
        TravelRuntimeFixture services = travelServices(repository);
        DungeonTravelRuntimeApplicationService travel = services.dungeon().travel();

        travel.selectMap(selectedMapId);

        TravelDungeonSnapshot snapshot = services.dungeon().travelModel().current();
        DungeonTravelPosition position = snapshot.travelSurface() == null ? null : snapshot.travelSurface().position();
        assertTrue(position != null,
                "selected-map bootstrap must use the authored transition entry even when (0,0,0) is a valid cell");
        assertEquals(selectedMapId, position.mapId().value(),
                "selected-map bootstrap must use the authored transition entry even when (0,0,0) is a valid cell");
        assertEquals(DungeonTravelLocationKind.TRANSITION, position.locationKind(),
                "selected-map bootstrap must use the authored transition entry even when (0,0,0) is a valid cell");
        assertEquals(entryTransitionId, position.ownerId(),
                "selected-map bootstrap must use the authored transition entry even when (0,0,0) is a valid cell");
        assertEquals(entryAnchor, new Cell(position.tile().q(), position.tile().r(), position.tile().level()),
                "selected-map bootstrap must use the authored transition entry even when (0,0,0) is a valid cell");
    }

    private static TravelSurfaceFacts project(DungeonMap map, DungeonDerivedState derived, Cell activeTile) {
        TravelAuthoredSurface authoredSurface = TravelAuthoredSurfaceProjectionMapper.from(map, derived);
        return new TravelSurfaceProjection().project(
                authoredSurface,
                new TravelPositionFacts(
                        map.metadata().mapId().value(),
                        LocationKind.TILE,
                        0L,
                        activeTile,
                        TravelHeading.SOUTH),
                "");
    }

    private static TravelAuthoredSurface surfaceWithAreasAndTransitions(
            long mapId,
            String mapName,
            List<DungeonAreaFacts> areas,
            List<features.dungeon.domain.core.structure.transition.Transition> transitions
    ) {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(mapId), mapName);
        for (features.dungeon.domain.core.structure.transition.Transition transition : transitions) {
            map = withTransition(map, transition);
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
        RoomCluster cluster = RoomCluster.authored(
                clusterId,
                mapId,
                mapName,
                new Cell(0, 0, 0),
                DungeonClusterBoundary.orderedByLevel(List.of()));
        DungeonMap map = new DungeonMap(
                new DungeonMapMetadata(new DungeonMapIdentity(mapId), mapName),
                SpatialTopology.defaultGrid().withRoomClusters(List.of(cluster)),
                new RoomCatalog(List.of(new RoomRegion(
                        roomId,
                        mapId,
                        clusterId,
                        mapName,
                        java.util.Set.copyOf(roomCells),
                        null))),
                List.of(),
                new StairCollection(List.of()),
                new TransitionCatalog(List.of()),
                0L);
        if (transitionAnchor == null || transitionId <= 0L) {
            return map;
        }
        return withTransition(map, new Transition(
                transitionId,
                mapId,
                "",
                TransitionAnchor.cell(transitionAnchor),
                TransitionDestination.dungeonMap(99L, 7L),
                null));
    }

    private static DungeonMap withTransition(DungeonMap map, Transition transition) {
        return map.withExactTransitionChange(null, transition);
    }

    private interface DungeonTestStore extends DungeonCatalogStore, DungeonMapRepository {
    }

    private static DungeonTestStore repositoryOf(DungeonMap firstMap, DungeonMap secondMap) {
        Map<Long, DungeonMap> mapsById = Map.of(
                firstMap.metadata().mapId().value(), firstMap,
                secondMap.metadata().mapId().value(), secondMap);
        return new DungeonTestStore() {
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
            public List<DungeonMapHeader> search(String query) {
                return List.of();
            }

            @Override
            public DungeonMapHeader create(String mapName) {
                throw new UnsupportedOperationException();
            }

            @Override
            public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
                throw new UnsupportedOperationException();
            }

            @Override
            public Optional<DungeonMap> firstMap() {
                return Optional.of(firstMap);
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

    private static DungeonMap loadMap(DungeonMapRepository repository, DungeonMapIdentity mapId) {
        if (mapId != null) {
            Optional<DungeonMap> map = repository.findById(mapId);
            if (map.isPresent()) {
                return map.get();
            }
        }
        return repository.firstMap()
                .orElse(DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Dungeon Map"));
    }

    private static TravelRuntimeFixture travelServices(DungeonTestStore repository) {
        PartyServiceAssembly.Component party =
                PartyServiceAssembly.create(new InMemoryPartyRosterRepository());
        DungeonTestAssembly.Component dungeon = DungeonTestAssembly.create(
                repository,
                repository,
                DungeonTestAssembly.inMemoryUnitOfWork(),
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                platform.execution.DirectExecutionLane.INSTANCE,
                platform.ui.DirectUiDispatcher.INSTANCE,
                platform.diagnostics.NoopDiagnostics.INSTANCE);
        return new TravelRuntimeFixture(dungeon, party);
    }

    private record TravelRuntimeFixture(
            DungeonTestAssembly.Component dungeon,
            PartyServiceAssembly.Component party
    ) {
    }

    private static void movePartyTokenToTravelPosition(
            PartyApi party,
            TravelPositionFacts position
    ) {
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Runtime Guide", "Test", 3, 12, 14),
                MembershipState.ACTIVE));
        party.moveCharacters(new MovePartyCharactersCommand(
                List.of(1L),
                new PartyDungeonTravelLocationSnapshot(
                        position.mapId(),
                        position.locationKind() == LocationKind.TRANSITION
                                ? PartyDungeonTravelLocationKind.TRANSITION
                                : PartyDungeonTravelLocationKind.TILE,
                        position.ownerId(),
                        new PartyTravelTile(position.tile().q(), position.tile().r(), position.tile().level()),
                        partyTravelHeading(position.heading())),
                true));
    }

    private static PartyTravelHeading partyTravelHeading(TravelHeading heading) {
        return switch (heading == null ? "" : heading.name()) {
            case "NORTH" -> PartyTravelHeading.NORTH;
            case "EAST" -> PartyTravelHeading.EAST;
            case "WEST" -> PartyTravelHeading.WEST;
            default -> PartyTravelHeading.SOUTH;
        };
    }

    private static TravelDungeonAction publishedActionAt(
            TravelDungeonSnapshot snapshot,
            int rowIndex,
            String message
    ) {
        List<TravelDungeonAction> actions = snapshot == null || snapshot.workspaceState() == null
                ? List.of()
                : snapshot.workspaceState().actions();
        assertTrue(rowIndex >= 0 && rowIndex < actions.size(), message);
        return actions.get(rowIndex);
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

    private static final class InMemoryPartyRosterRepository implements PartyRosterRepository {

        private PartyRoster roster = new PartyRoster(1L, List.of());

        @Override
        public PartyRoster load() {
            return roster;
        }

        @Override
        public void save(PartyRoster roster) {
            this.roster = roster == null ? new PartyRoster(1L, List.of()) : roster;
        }
    }
}

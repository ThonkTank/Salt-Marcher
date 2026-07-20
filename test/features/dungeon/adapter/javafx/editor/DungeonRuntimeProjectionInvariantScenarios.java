package features.dungeon.adapter.javafx.editor;

import java.util.ArrayList;
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
import features.dungeon.application.travel.projection.TravelActionKind;
import features.dungeon.application.travel.projection.TravelAuthoredSurface;
import features.dungeon.application.travel.projection.TravelHeading;
import features.dungeon.application.travel.projection.TravelPositionFacts;
import features.dungeon.application.travel.projection.TravelSurfaceFacts;
import features.dungeon.application.travel.projection.TravelSurfaceProjection;
import features.dungeon.application.travel.projection.TravelTransitionTarget;
import features.dungeon.application.travel.projection.TravelWindowProjectionMapper;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.domain.core.structure.DungeonMapMetadata;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.room.RoomClusterFloorMap;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.api.DungeonTravelLocationKind;
import features.dungeon.api.DungeonTravelActionId;
import features.dungeon.api.DungeonTravelPosition;
import features.dungeon.api.DungeonChunkKey;
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

        TravelSurfaceFacts windowFactSurface = project(
                map,
                derivedState(derived.map().areas(), derived.map().boundaries()),
                new Cell(0, 0, 0));
        assertTrue(firstActionOfKind(windowFactSurface, TravelActionKind.TRAVERSAL) != null,
                "runtime path projection derives traversal directly from sparse window facts");
        assertRuntimeCorridorTraversalProjection();
    }

    private static void assertRuntimeCorridorTraversalProjection() {
        Cell roomTile = new Cell(0, 0, 0);
        Cell corridorStart = new Cell(1, 0, 0);
        Cell corridorEnd = new Cell(2, 0, 0);
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(31L), "Runtime Corridors");
        List<DungeonAreaFacts> areas = List.of(
                area(DungeonAreaType.ROOM, 310L, "Start", List.of(roomTile)),
                area(DungeonAreaType.CORRIDOR, 320L, "Corridor 320", List.of(corridorStart, corridorEnd)));
        DungeonMapFacts mapFacts = new DungeonMapFacts(DungeonTopology.SQUARE, 3, 1, areas, List.of());
        DungeonDerivedState withCorridorLinks = new DungeonDerivedState(
                mapFacts,
                List.of(),
                null,
                new DungeonTraversalLinkProjection().project(map, mapFacts));
        TravelSurfaceFacts surface = project(map, withCorridorLinks, corridorStart);
        TravelActionFacts traversal = firstActionOfKind(surface, TravelActionKind.TRAVERSAL);

        assertEquals("Corridor 320", surface.areaLabel(),
                "runtime corridor traversal projection resolves active corridor area");
        assertTrue(traversal != null,
                "runtime corridor traversal projection publishes corridor traversal action from derived links");
        assertEquals("Corridor 320", traversal.label(),
                "runtime corridor traversal projection keeps corridor source label");
        assertEquals(corridorEnd, traversal.targetPosition().tile(),
                "runtime corridor traversal projection follows the derived corridor segment target");

        TravelSurfaceFacts windowFactSurface = project(map, derivedState(areas, List.of()), corridorStart);
        assertTrue(firstActionOfKind(windowFactSurface, TravelActionKind.TRAVERSAL) != null,
                "runtime corridor traversal projection derives adjacent movement from sparse corridor facts");
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
                unlinkedTransition.actionId());
        DungeonMap multipleActionMap = withTransition(unlinkedMap, new Transition(
                42L,
                unlinkedMap.metadata().mapId().value(),
                "Second transition.",
                TransitionAnchor.cell(anchor),
                TransitionDestination.overworldTile(7L, 8L),
                null));
        assertActionIdentitySurvivesPresentationReordering(
                project(multipleActionMap, derived, new Cell(2, 0, 0)));
    }

    private static void assertUnlinkedTransitionMovementBlocked(
            DungeonMap unlinkedMap,
            TravelActionFacts unlinkedTransition,
            DungeonTravelActionId actionId
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
                actionId,
                "runtime unlinked entrance public route exposes selected transition action");
        assertContains(publishedAction.label(), "Kein Ziel verknuepft",
                "runtime unlinked entrance movement must report missing destination");
        PartyTravelPositionsResult partyBefore = partyPositions.current();

        travel.performAction(actionId);

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

    private static void assertActionIdentitySurvivesPresentationReordering(TravelSurfaceFacts surface) {
        assertTrue(surface.actions().size() > 1,
                "runtime action reordering invariant requires multiple presentation rows");
        List<TravelActionFacts> reversedActions = surface.actions().reversed();
        TravelSurfaceFacts reordered = new TravelSurfaceFacts(
                surface.mapId(),
                surface.mapName(),
                surface.revision(),
                surface.map(),
                surface.position(),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                reversedActions);
        for (TravelActionFacts expected : surface.actions()) {
            assertEquals(expected, reordered.action(expected.actionId()).orElse(null),
                    "runtime action identity selects the same action after presentation reordering");
        }
        assertTrue(reordered.action(new DungeonTravelActionId("map:4:stale:unknown")).isEmpty(),
                "runtime action identity rejects an unknown or stale id");
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
        TravelAuthoredSurface authoredSurface = windowSurface(map, derived);
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
        return windowSurface(map, derivedState(areas, List.of()));
    }

    private static TravelAuthoredSurface windowSurface(DungeonMap map, DungeonDerivedState derived) {
        List<DungeonWindowEntityFragment> fragments = new ArrayList<>();
        List<DungeonChunkKey> requestedChunks = new ArrayList<>();
        for (DungeonAreaFacts area : derived.map().areas()) {
            List<DungeonChunkKey> areaChunks = chunksFor(map.metadata().mapId().value(), area.cells());
            requestedChunks.addAll(areaChunks);
            if (area.kind().isRoom()) {
                fragments.add(new DungeonWindowEntityFragment.Room(
                        DungeonPatchEntityRef.room(area.id()),
                        area.clusterId(),
                        area.label(),
                        "",
                        area.cells(),
                        List.of(),
                        areaChunks,
                        List.of()));
            } else {
                List<DungeonWindowEntityFragment.CorridorRouteCellFact> routeCells = new ArrayList<>();
                for (int index = 0; index < area.cells().size(); index++) {
                    routeCells.add(new DungeonWindowEntityFragment.CorridorRouteCellFact(
                            0,
                            index,
                            area.cells().get(index)));
                }
                fragments.add(new DungeonWindowEntityFragment.Corridor(
                        DungeonPatchEntityRef.corridor(area.id()),
                        area.cells().isEmpty() ? 0 : area.cells().get(0).level(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        routeCells,
                        areaChunks,
                        List.of()));
            }
        }
        int boundaryIndex = 0;
        for (DungeonBoundaryFacts boundary : derived.map().boundaries()) {
            DungeonWindowEntityFragment.ClusterBoundaryFact fact = windowBoundary(boundary);
            if (fact != null) {
                List<DungeonChunkKey> boundaryChunks = chunksFor(
                        map.metadata().mapId().value(), List.of(fact.cell()));
                requestedChunks.addAll(boundaryChunks);
                fragments.add(new DungeonWindowEntityFragment.RoomCluster(
                        DungeonPatchEntityRef.roomCluster(9_000_000L + boundaryIndex++),
                        "Window boundary facts",
                        List.of(),
                        List.of(fact),
                        boundaryChunks,
                        List.of()));
            }
        }
        List<DungeonEntitySnapshot> closure = map.transitionCatalog().transitions().stream()
                .map(DungeonEntitySnapshot.TransitionSnapshot::new)
                .map(DungeonEntitySnapshot.class::cast)
                .toList();
        DungeonMapHeader header = new DungeonMapHeader(
                map.metadata().mapId(),
                map.metadata().mapName(),
                Math.max(1L, map.revision()));
        List<DungeonWindowChunkHeader> chunkHeaders = requestedChunks.stream()
                .distinct()
                .map(key -> new DungeonWindowChunkHeader(key, header.revision()))
                .toList();
        return TravelWindowProjectionMapper.from(
                header,
                new DungeonWindow(header, 0L, chunkHeaders, fragments, List.of(), List.of(),
                        features.dungeon.application.authored.port.DungeonContinuationPage.empty()),
                closure);
    }

    private static List<DungeonChunkKey> chunksFor(long mapId, Iterable<Cell> cells) {
        java.util.LinkedHashSet<DungeonChunkKey> chunks = new java.util.LinkedHashSet<>();
        for (Cell cell : cells) {
            chunks.add(new DungeonChunkKey(
                    mapId,
                    cell.level(),
                    Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                    Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE)));
        }
        return List.copyOf(chunks);
    }

    private static DungeonWindowEntityFragment.ClusterBoundaryFact windowBoundary(DungeonBoundaryFacts boundary) {
        for (Cell cell : boundary.edge().touchingCells()) {
            for (Direction direction : Direction.values()) {
                if (direction.edgeOf(cell).equals(boundary.edge())) {
                    DungeonWindowEntityFragment.BoundaryKind kind = switch (boundary.kind().toLowerCase()) {
                        case "door" -> DungeonWindowEntityFragment.BoundaryKind.DOOR;
                        case "open" -> DungeonWindowEntityFragment.BoundaryKind.OPEN;
                        default -> DungeonWindowEntityFragment.BoundaryKind.WALL;
                    };
                    return new DungeonWindowEntityFragment.ClusterBoundaryFact(
                            cell,
                            direction,
                            kind,
                            boundary.topologyRef());
                }
            }
        }
        return null;
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
                List.of());
        DungeonMap map = new DungeonMap(
                new DungeonMapMetadata(new DungeonMapIdentity(mapId), mapName),
                SpatialTopology.defaultGrid().withRoomClusters(List.of(cluster)),
                new RoomCatalog(List.of(new RoomRegion(
                        roomId,
                        mapId,
                        clusterId,
                        mapName,
                        java.util.Set.copyOf(roomCells),
                        DungeonRoomNarration.empty()))),
                List.of(),
                new StairCollection(List.of()),
                new TransitionCatalog(List.of()),
                1L);
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

    private interface DungeonTestStore extends DungeonCatalogStore, DungeonWindowStore {
    }

    private static DungeonTestStore repositoryOf(DungeonMap firstMap, DungeonMap secondMap) {
        Map<Long, DungeonMap> mapsById = Map.of(
                firstMap.metadata().mapId().value(), firstMap,
                secondMap.metadata().mapId().value(), secondMap);
        return new DungeonTestStore() {
            @Override
            public List<DungeonMapHeader> search(String query) {
                return mapsById.values().stream().map(DungeonRuntimeProjectionInvariantScenarios::header).toList();
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
            public void delete(DungeonMapIdentity mapId) {
            }

            @Override
            public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
                DungeonMap map = mapsById.get(request.mapId().value());
                if (map == null) {
                    return Optional.empty();
                }
                List<DungeonWindowEntityFragment> fragments = new java.util.ArrayList<>();
                for (RoomRegion room : map.rooms().rooms()) {
                    List<Cell> cells = room.floorCells().stream()
                            .filter(cell -> requested(request, cell))
                            .toList();
                    if (!cells.isEmpty()) {
                        fragments.add(new DungeonWindowEntityFragment.Room(
                                DungeonPatchEntityRef.room(room.roomId()),
                                room.clusterId(), room.name(), "", cells, List.of(),
                                intersecting(request, cells),
                                List.of(DungeonPatchEntityRef.roomCluster(room.clusterId()))));
                    }
                }
                for (Transition transition : map.transitionCatalog().transitions()) {
                    Cell anchor = transition.anchorCell();
                    if (anchor != null && requested(request, anchor)) {
                        fragments.add(new DungeonWindowEntityFragment.Transition(
                                DungeonPatchEntityRef.transition(transition.transitionId()),
                                transition.description(), transition.anchor(), transition.destination(),
                                transition.linkedTransitionId(), intersecting(request, List.of(anchor)), List.of()));
                    }
                }
                List<DungeonWindowChunkHeader> chunkHeaders = request.chunkKeys().stream()
                        .map(key -> new DungeonWindowChunkHeader(key, map.revision()))
                        .toList();
                return Optional.of(new DungeonWindow(
                        header(map), request.requestGeneration(), chunkHeaders, fragments, List.of(), List.of(),
                        features.dungeon.application.authored.port.DungeonContinuationPage.empty()));
            }

            @Override
            public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
                DungeonMap map = mapsById.get(request.mapId().value());
                if (map == null) {
                    return new DungeonIdentityClosureResult.Rejected(
                            DungeonIdentityClosureResult.Reason.MAP_MISSING, request.entityRefs());
                }
                if (map.revision() != request.expectedMapRevision()) {
                    return new DungeonIdentityClosureResult.Rejected(
                            DungeonIdentityClosureResult.Reason.STALE_REVISION, request.entityRefs());
                }
                List<DungeonEntitySnapshot> snapshots = new java.util.ArrayList<>();
                for (DungeonPatchEntityRef ref : request.entityRefs()) {
                    if (ref.kind() == DungeonPatchEntityRef.Kind.TRANSITION) {
                        Transition transition = map.transitionCatalog().transition(ref.id());
                        if (transition == null) {
                            return new DungeonIdentityClosureResult.Rejected(
                                    DungeonIdentityClosureResult.Reason.ENTITY_MISSING, List.of(ref));
                        }
                        snapshots.add(new DungeonEntitySnapshot.TransitionSnapshot(transition));
                    }
                }
                return new DungeonIdentityClosureResult.Complete(header(map), snapshots);
            }

            @Override
            public DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request) {
                DungeonMap map = mapsById.get(request.mapId().value());
                if (map == null) {
                    return new DungeonTravelStartResult.Rejected(
                            DungeonIdentityClosureResult.Reason.MAP_MISSING);
                }
                Transition entry = map.transitionCatalog().transitions().stream()
                        .filter(Transition::isPlaced)
                        .min(java.util.Comparator.comparingLong(Transition::transitionId))
                        .orElse(null);
                if (entry != null) {
                    return new DungeonTravelStartResult.Located(
                            header(map), entry.anchorCell(), entry.transitionId());
                }
                Cell first = map.rooms().rooms().stream()
                        .flatMap(room -> room.floorCells().stream())
                        .min(features.dungeon.domain.core.geometry.CellOrdering::compareCells)
                        .orElse(null);
                return first == null
                        ? new DungeonTravelStartResult.Empty(header(map))
                        : new DungeonTravelStartResult.Located(header(map), first, null);
            }

            @Override
            public features.dungeon.application.authored.port.DungeonTravelChunkKeysResult discoverTravelChunkKeys(
                    features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest request
            ) {
                DungeonMap map = mapsById.get(request.mapId().value());
                if (map == null) {
                    return new features.dungeon.application.authored.port.DungeonTravelChunkKeysResult.Rejected(
                            DungeonIdentityClosureResult.Reason.MAP_MISSING);
                }
                List<Cell> spatialCells = new ArrayList<>();
                map.rooms().rooms().forEach(room -> spatialCells.addAll(room.floorCells()));
                map.transitionCatalog().transitions().stream()
                        .map(Transition::anchorCell)
                        .filter(java.util.Objects::nonNull)
                        .forEach(spatialCells::add);
                List<DungeonChunkKey> chunks = chunksFor(request.mapId().value(), spatialCells).stream()
                        .filter(key -> Math.abs(key.chunkQ() - request.centerChunkQ()) <= 1
                                && Math.abs(key.chunkR() - request.centerChunkR()) <= 1)
                        .toList();
                return new features.dungeon.application.authored.port.DungeonTravelChunkKeysResult.Complete(
                        header(map), chunks);
            }
        };
    }

    private static DungeonMapHeader header(DungeonMap map) {
        return new DungeonMapHeader(map.metadata().mapId(), map.metadata().mapName(), map.revision());
    }

    private static boolean requested(DungeonWindowRequest request, Cell cell) {
        return request.chunkKeys().stream().anyMatch(key -> key.level() == cell.level()
                && cell.q() >= key.minimumQ() && cell.q() <= key.maximumQ()
                && cell.r() >= key.minimumR() && cell.r() <= key.maximumR());
    }

    private static List<features.dungeon.api.DungeonChunkKey> intersecting(
            DungeonWindowRequest request,
            List<Cell> cells
    ) {
        return request.chunkKeys().stream()
                .filter(key -> cells.stream().anyMatch(cell -> key.level() == cell.level()
                        && cell.q() >= key.minimumQ() && cell.q() <= key.maximumQ()
                        && cell.r() >= key.minimumR() && cell.r() <= key.maximumR()))
                .toList();
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
            DungeonTravelActionId actionId,
            String message
    ) {
        List<TravelDungeonAction> actions = snapshot == null || snapshot.workspaceState() == null
                ? List.of()
                : snapshot.workspaceState().actions();
        for (TravelDungeonAction action : actions) {
            if (action.actionId().equals(actionId)) {
                return action;
            }
        }
        throw new IllegalStateException(message + " missing actionId=" + actionId);
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

package features.dungeon.adapter.javafx.editor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.dungeon.DungeonTestAssembly;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.DungeonMapMetadata;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.TransitionEndpoint;
import features.dungeon.domain.core.structure.transition.TransitionCatalog.TransitionLinkDirectionality;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.domain.core.structure.transition.TransitionDestinationTarget;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;

final class DungeonTransitionInvariantScenarios {


    private DungeonTransitionInvariantScenarios() {
    }

    static void run() {
        assertTransitionLocalFacts();

        assertTransitionLinkCollection();
        assertTransitionLinkMissingPreviousMapFallback();

        assertProtectedDeletePolicy();

    }

    private static void assertTransitionLocalFacts() {
        TransitionDestination dungeonDestination = TransitionDestination.dungeonMap(12L, 20L);
        TransitionDestination overworldDestination = TransitionDestination.overworldTile(5L, 9L);
        Transition invalid = new Transition(-1L, -4L, null, null, null, -2L);
        Transition transition = new Transition(
                1L,
                4L,
                " source ",
                TransitionAnchor.cell(new Cell(0, 0, 0)),
                dungeonDestination,
                null);
        Transition linkedTransition =
                new Transition(
                        2L,
                        4L,
                        "",
                        TransitionAnchor.cell(new Cell(1, 0, 0)),
                        overworldDestination,
                        7L);

        assertEquals(0L, invalid.transitionId(), "transition owner normalizes invalid id");
        assertEquals(0L, invalid.mapId(), "transition owner normalizes invalid map id");
        assertEquals("", invalid.description(), "transition owner normalizes null description");
        assertFalse(invalid.isPlaced(), "transition owner reports missing anchor as unplaced");
        assertFalse(invalid.hasLinkedTransition(), "transition owner rejects invalid linked transition id");
        assertEquals(TransitionDestination.unlinkedEntrance(), invalid.destination(),
                "transition owner normalizes null destination to unlinked entrance");
        assertTrue(invalid.destination().isValid(),
                "transition owner treats unlinked entrance as valid authoring placeholder");
        assertEquals("Dungeon-Eingang (unverbunden)", invalid.destination().label(),
                "transition destination label explains unlinked entrance");
        assertEquals(7L, linkedTransition.linkedTransitionId(),
                "transition owner preserves valid local linked transition id");
        assertTrue(dungeonDestination.isValid(), "transition destination validates dungeon map id");
        assertEquals("Dungeon 12 / Übergang 20", dungeonDestination.label(),
                "transition destination label includes linked target transition");
        assertEquals(TransitionDestinationTarget.absent(), TransitionDestinationTarget.fromPositiveId(0L),
                "transition target owner translates legacy zero storage ids to named absence");
        assertEquals(TransitionDestinationTarget.present(20L), dungeonDestination.transitionTarget(),
                "transition destination preserves present target transition as a named value");
        assertTrue(overworldDestination.isValid(), "transition destination validates overworld tile");
        assertEquals("Overworld-Feld 9", overworldDestination.label(),
                "transition destination label uses tile id");
        assertEquals(1L, transition.transitionId(), "transition owner preserves valid id");
        assertEquals(4L, transition.mapId(), "transition owner preserves valid map id");
        assertEquals(TransitionAnchor.cell(new Cell(0, 0, 0)), transition.anchor(),
                "transition owner preserves cell anchor value");
        assertEquals(new Cell(0, 0, 0), transition.anchorCell(),
                "transition owner exposes derived display cell without storing a second anchor fact");
        assertEquals("source", transition.description(), "transition owner trims description");
        assertEquals("Übergang 1", transition.label(), "transition owner derives stable label from id");
        assertTrue(transition.isPlaced(), "transition owner reports placed anchor");
        assertIllegalTransitionAnchor(
                () -> TransitionAnchor.cell(null),
                "transition anchor rejects null cell for CELL anchor");
        assertIllegalTransitionAnchor(
                () -> TransitionAnchor.edge(new Cell(2, 2, 0), null),
                "transition anchor rejects null direction for EDGE anchor");
        assertEquals(TransitionAnchor.edge(new Cell(2, 2, 0), Direction.EAST),
                TransitionAnchor.edge(new Cell(2, 2, 0), Direction.EAST),
                "transition anchor preserves edge coordinate and direction");
        TransitionAnchor edgeAnchor = TransitionAnchor.edge(new Cell(2, 2, 0), Direction.EAST);
        assertEquals(TransitionAnchor.Kind.EDGE, edgeAnchor.kind(),
                "transition anchor preserves EDGE kind");
        assertEquals(Direction.EAST, edgeAnchor.edgeDirection(),
                "transition anchor preserves edge direction");
        assertTrue(edgeAnchor.isPlaced(),
                "transition anchor reports edge anchors as placed");
        assertEquals(new Cell(2, 2, 0), edgeAnchor.displayCell(),
                "transition anchor exposes edge display cell as derived current projection input");
        assertEquals(new Cell(2, 2, 0), edgeAnchor.travelCell(),
                "transition anchor exposes edge travel cell as derived current projection input");
        assertEquals("updated", transition.withDescription(" updated ").description(),
                "transition owner replaces description through value operation");
        assertEquals(overworldDestination, transition.withDestination(overworldDestination).destination(),
                "transition owner replaces destination through value operation");
    }

    private static void assertIllegalTransitionAnchor(
            Runnable action,
            String message
    ) {
        try {
            action.run();
            throw new AssertionError(message);
        } catch (IllegalArgumentException expected) {
            // Expected by the invariant under test.
        }
    }

    private static void assertTransitionLinkCollection() {
        TransitionDestination dungeonDestination = TransitionDestination.dungeonMap(12L, 20L);
        TransitionDestination overworldDestination = TransitionDestination.overworldTile(5L, 9L);
        Transition source = transition(1L, 4L, new Cell(0, 0, 0), dungeonDestination, null);
        Transition oldTarget = transition(2L, 4L, new Cell(1, 0, 0), overworldDestination, 1L);
        Transition target = transition(3L, 4L, new Cell(1, 1, 0), overworldDestination, null);
        Transition sameIdDifferentMap = transition(1L, 5L, new Cell(2, 0, 0), overworldDestination, null);
        java.util.ArrayList<Transition> transitions =
                new java.util.ArrayList<>(List.of(source, oldTarget, target, sameIdDifferentMap));
        transitions.add(null);
        TransitionCatalog catalog = new TransitionCatalog(transitions);
        assertEquals(4, catalog.transitions().size(), "transition catalog filters null transition entries");

        TransitionCatalog oneWayCatalog = catalog.withMapLocalAuthoredTransitionLink(
                link(4L, 1L, 4L, 3L, TransitionLinkDirectionality.ONE_WAY));
        assertEquals(TransitionDestination.dungeonMap(4L, 3L), oneWayCatalog.transitions().getFirst().destination(),
                "transition catalog updates one-way source destination");
        assertEquals(null, oneWayCatalog.transitions().get(1).linkedTransitionId(),
                "transition catalog clears stale reverse link");
        assertEquals(null, oneWayCatalog.transitions().get(2).linkedTransitionId(),
                "transition catalog does not create reverse link for one-way link");

        TransitionCatalog bidirectionalCatalog = catalog.withMapLocalAuthoredTransitionLink(
                link(4L, 1L, 4L, 3L, TransitionLinkDirectionality.BIDIRECTIONAL));
        assertEquals(TransitionDestination.dungeonMap(4L, 3L), bidirectionalCatalog.transitions().getFirst().destination(),
                "transition catalog updates bidirectional source destination");
        assertEquals(null, bidirectionalCatalog.transitions().get(1).linkedTransitionId(),
                "transition catalog clears stale reverse link for bidirectional link");
        assertEquals(1L, bidirectionalCatalog.transitions().get(2).linkedTransitionId(),
                "transition catalog creates bidirectional reverse link");
        assertEquals(sameIdDifferentMap, bidirectionalCatalog.transitions().get(3),
                "transition catalog does not update same transition id on a different map");
        assertEquals(catalog, catalog.withMapLocalAuthoredTransitionLink(
                link(0L, 1L, 4L, 3L, TransitionLinkDirectionality.BIDIRECTIONAL)),
                "transition catalog rejects invalid authored link");
    }

    private static void assertTransitionLinkMissingPreviousMapFallback() {
        long sourceMapId = 41L;
        long targetMapId = 42L;
        long missingPreviousMapId = 99L;
        long sourceTransitionId = 1L;
        long targetTransitionId = 2L;
        long missingPreviousTransitionId = 7L;
        DungeonMap sourceMap = map(
                sourceMapId,
                "Missing previous source",
                transition(
                        sourceTransitionId,
                        sourceMapId,
                        new Cell(0, 0, 0),
                        TransitionDestination.dungeonMap(missingPreviousMapId, missingPreviousTransitionId),
                        null));
        DungeonMap targetMap = map(
                targetMapId,
                "Missing previous target",
                transition(
                        targetTransitionId,
                        targetMapId,
                        new Cell(1, 0, 0),
                        TransitionDestination.overworldTile(5L, 9L),
                        null));
        MissingPreviousMapRepository repository =
                new MissingPreviousMapRepository(sourceMap, targetMap, missingPreviousMapId);
        DungeonTestAssembly.Component services =
                DungeonEditorTestPersistence.createDungeonServices(repository);
        DungeonEditorDungeonState dungeonState = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService.OperationResult result = services
                .editor()
                .openSession(dungeonState, runtimeSession -> runtimeSession.saveTransitionLink(
                        new MapId(sourceMapId),
                        new DungeonAuthoredApplicationService.TransitionLinkInput(
                                sourceTransitionId,
                                targetMapId,
                                targetTransitionId,
                                true)));

        assertTrue(result.present(),
                "transition link use case succeeds when the previous linked map row is missing");
        assertTrue(repository.requestedMapIds().contains(missingPreviousMapId),
                "transition link use case attempts to load the missing previous map");
        assertEquals(List.of(sourceMapId, targetMapId), repository.savedMapIds(),
                "transition link use case saves only source and target when previous map is missing");
        Transition savedSourceTransition =
                transitionById(repository.savedMap(sourceMapId), sourceTransitionId);
        assertEquals(TransitionDestination.dungeonMap(targetMapId, targetTransitionId),
                savedSourceTransition.destination(),
                "transition link use case still rewrites source destination when previous map is missing");
        Transition savedTargetTransition =
                transitionById(repository.savedMap(targetMapId), targetTransitionId);
        assertEquals(sourceTransitionId, savedTargetTransition.linkedTransitionId(),
                "transition link use case still writes target reverse link when previous map is missing");
        assertFalse(repository.savedMapIds().contains(missingPreviousMapId),
                "transition link use case cannot mutate a missing previous map");

        DungeonAuthoredApplicationService.Session authoredSession = services.authored().openSession(dungeonState);
        assertTrue(services.authored().canUndo(new MapId(sourceMapId)),
                "compound transition link is available as one source-map undo step");
        services.authored().undo(new MapId(sourceMapId), authoredSession);
        assertEquals(
                TransitionDestination.dungeonMap(missingPreviousMapId, missingPreviousTransitionId),
                transitionById(repository.savedMap(sourceMapId), sourceTransitionId).destination(),
                "compound undo restores the source destination");
        assertEquals(null,
                transitionById(repository.savedMap(targetMapId), targetTransitionId).linkedTransitionId(),
                "compound undo restores the target reverse link atomically");
        assertTrue(services.authored().canRedo(new MapId(targetMapId)),
                "compound transition link is available as one target-map redo step");
        services.authored().redo(new MapId(targetMapId), authoredSession);
        assertEquals(
                TransitionDestination.dungeonMap(targetMapId, targetTransitionId),
                transitionById(repository.savedMap(sourceMapId), sourceTransitionId).destination(),
                "compound redo reapplies the source destination");
        assertEquals(sourceTransitionId,
                transitionById(repository.savedMap(targetMapId), targetTransitionId).linkedTransitionId(),
                "compound redo reapplies the target reverse link atomically");
    }

    private static void assertProtectedDeletePolicy() {
        TransitionDestination overworldDestination = TransitionDestination.overworldTile(5L, 9L);
        Transition linked = transition(1L, 4L, new Cell(0, 0, 0), overworldDestination, 3L);
        Transition destinationReferenced = transition(2L, 4L, new Cell(1, 0, 0), overworldDestination, null);
        Transition reverseLinked = new Transition(
                3L,
                4L,
                "",
                TransitionAnchor.cell(new Cell(1, 1, 0)),
                TransitionDestination.dungeonMap(4L, 2L),
                null);
        Transition deletable = transition(4L, 4L, new Cell(2, 0, 0), overworldDestination, null);
        TransitionCatalog catalog = new TransitionCatalog(List.of(linked, destinationReferenced, reverseLinked, deletable));

        assertFalse(catalog.canDelete(1L), "transition catalog rejects linked transition delete");
        assertFalse(catalog.canDelete(2L), "transition catalog rejects destination-referenced transition delete");
        assertFalse(catalog.canDelete(3L), "transition catalog rejects reverse-linked transition delete");
        assertTrue(catalog.canDelete(4L), "transition catalog allows unreferenced transition delete");
        assertEquals(List.of(1L, 2L, 3L), transitionIds(catalog.withExactChange(deletable, null)),
                "transition catalog removes deletable transition");
    }

    private static Transition transition(
            long transitionId,
            long mapId,
            Cell anchor,
            TransitionDestination destination,
            Long linkedTransitionId
    ) {
        return new Transition(
                transitionId,
                mapId,
                "",
                TransitionAnchor.cell(anchor),
                destination,
                linkedTransitionId);
    }

    private static DungeonMap map(long mapId, String mapName, Transition... transitions) {
        return new DungeonMap(
                new DungeonMapMetadata(new DungeonMapIdentity(mapId), mapName),
                SpatialTopology.empty(),
                RoomCatalog.empty(),
                List.of(),
                new StairCollection(List.of()),
                new TransitionCatalog(List.of(transitions)),
                0L);
    }

    private static Transition transitionById(DungeonMap map, long transitionId) {
        for (Transition transition : map.transitionCatalog().transitions()) {
            if (transition.transitionId() == transitionId) {
                return transition;
            }
        }
        throw new IllegalStateException("Missing transition " + transitionId);
    }

    private static AuthoredTransitionLink link(
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            TransitionLinkDirectionality directionality
    ) {
        return new AuthoredTransitionLink(
                new TransitionEndpoint(sourceMapId, sourceTransitionId),
                new TransitionEndpoint(targetMapId, targetTransitionId),
                directionality);
    }

    private static List<Long> transitionIds(TransitionCatalog catalog) {
        ArrayList<Long> result = new ArrayList<>();
        for (Transition transition : catalog.transitions()) {
            result.add(transition.transitionId());
        }
        return List.copyOf(result);
    }

    private static final class MissingPreviousMapRepository implements DungeonMapRepository {
        private final Map<Long, DungeonMap> mapsById = new LinkedHashMap<>();
        private final long missingPreviousMapId;
        private final List<Long> requestedMapIds = new ArrayList<>();
        private final Map<Long, DungeonMap> savedMapsById = new LinkedHashMap<>();

        private MissingPreviousMapRepository(
                DungeonMap sourceMap,
                DungeonMap targetMap,
                long missingPreviousMapId
        ) {
            mapsById.put(sourceMap.metadata().mapId().value(), sourceMap);
            mapsById.put(targetMap.metadata().mapId().value(), targetMap);
            this.missingPreviousMapId = missingPreviousMapId;
        }

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
            long id = mapId == null ? 0L : mapId.value();
            requestedMapIds.add(id);
            return id == missingPreviousMapId
                    ? Optional.empty()
                    : Optional.ofNullable(mapsById.get(id));
        }

        @Override
        public List<DungeonMap> searchByName(String query) {
            return List.of();
        }

        @Override
        public Optional<DungeonMap> firstMap() {
            return mapsById.values().stream().findFirst();
        }

        @Override
        public DungeonMap save(DungeonMap dungeonMap) {
            return dungeonMap;
        }

        @Override
        public List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps) {
            savedMapsById.clear();
            for (DungeonMap dungeonMap : dungeonMaps == null ? List.<DungeonMap>of() : dungeonMaps) {
                savedMapsById.put(dungeonMap.metadata().mapId().value(), dungeonMap);
                mapsById.put(dungeonMap.metadata().mapId().value(), dungeonMap);
            }
            return List.copyOf(savedMapsById.values());
        }

        @Override
        public void delete(DungeonMapIdentity mapId) {
        }

        private List<Long> requestedMapIds() {
            return List.copyOf(requestedMapIds);
        }

        private List<Long> savedMapIds() {
            return List.copyOf(savedMapsById.keySet());
        }

        private DungeonMap savedMap(long mapId) {
            DungeonMap map = savedMapsById.get(mapId);
            if (map == null) {
                throw new IllegalStateException("Missing saved map " + mapId);
            }
            return map;
        }
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

    private static void assertFalse(boolean value, String message) {
        if (value) {
            throw new IllegalStateException(message);
        }
    }
}

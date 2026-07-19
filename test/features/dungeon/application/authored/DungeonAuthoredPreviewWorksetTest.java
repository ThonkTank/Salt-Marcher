package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonFeatureType;
import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;
import platform.execution.DirectExecutionLane;

final class DungeonAuthoredPreviewWorksetTest {
    @Test
    void repeatedPointerPreviewsUseTheLoadedWorksetWithoutRepositoryReads() {
        TestCatalog catalog = new TestCatalog();
        RecordingWindowStore windowStore = new RecordingWindowStore();
        DungeonAuthoredApplicationService service = new DungeonAuthoredApplicationService(
                catalog,
                windowStore,
                features.dungeon.DungeonTestAssembly.inMemoryUnitOfWork(),
                new TestDungeonIdentityAllocator(),
                DirectExecutionLane.INSTANCE,
                new DungeonAuthoredPublishedState(DirectUiDispatcher.INSTANCE));
        DungeonEditorDungeonState dungeonState = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService.Session session = service.openSession(dungeonState);
        DungeonEditorWorkspaceValues.MapId mapId = new DungeonEditorWorkspaceValues.MapId(1L);
        session.loadViewport(mapId, 0, 0, 0, 63, 63);
        var surface = dungeonState.committedFacts(mapId).surface();
        var handle = surface.map().editorHandles().stream()
                .filter(candidate -> candidate.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL)
                .findFirst()
                .orElseThrow();
        DungeonEditorSessionValues.MoveHandlePreview preview = new DungeonEditorSessionValues.MoveHandlePreview(
                handle.ref(), 1, 0, 0);

        session.executeInMemoryPreview(surface, preview);
        session.executeInMemoryPreview(surface, preview);
        session.executeInMemoryPreview(surface, new DungeonEditorSessionValues.RoomRectanglePreview(
                new Cell(2, 2, 0), new Cell(3, 3, 0), false));

        assertEquals(1, windowStore.loadCalls);
    }

    @Test
    void corridorPreviewUsesTheCanonicalCommittedRouteWithoutReads() {
        Workset workset = workset();
        Cell doorCorridorCell = new Cell(0, 0, 0);
        Cell anchorCell = new Cell(2, 2, 0);
        var room = area(DungeonAreaType.ROOM, 10L, 10L, List.of(new Cell(1, 0, 0)));
        var map = map(List.of(room));
        var preview = new DungeonEditorSessionValues.CorridorCreatePreview(
                new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                        88L, anchorCell, DungeonTopologyRef.corridorAnchor(301L)),
                new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                        1L, 10L, new Cell(-1, 0, 0), Direction.EAST, DungeonTopologyRef.door(101L)));

        var candidate = execute(workset, map, preview);

        List<Cell> expected = new OrthogonalCorridorRoutingPolicy()
                .route(doorCorridorCell, anchorCell, java.util.Set.of(new Cell(1, 0, 0)))
                .cells();
        assertEquals(expected, candidate.areas().stream()
                .filter(area -> area.kind().isCorridor())
                .findFirst()
                .orElseThrow()
                .cells());
        assertNoReads(workset);
    }

    @Test
    void crossLevelCorridorPreviewPublishesTheCommittedCorridorAndBoundStairGeometryWithoutReads() {
        Workset workset = workset();
        var preview = new DungeonEditorSessionValues.CorridorCreatePreview(
                new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                        1L, 10L, new Cell(-1, 0, 0), Direction.EAST, DungeonTopologyRef.door(101L)),
                new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                        2L, 20L, new Cell(2, 0, 1), Direction.WEST, DungeonTopologyRef.door(202L)));

        var candidate = execute(workset, map(List.of()), preview);

        List<Cell> expected = List.of(
                new Cell(0, 0, 0),
                new Cell(1, 0, 0),
                new Cell(1, 0, 1));
        assertEquals(expected, candidate.areas().stream()
                .filter(area -> area.kind().isCorridor())
                .findFirst()
                .orElseThrow()
                .cells());
        assertEquals(expected, candidate.features().stream()
                .filter(feature -> feature.kind() == DungeonFeatureType.STAIR)
                .findFirst()
                .orElseThrow()
                .cells());
        assertNoReads(workset);
    }

    @Test
    void roomPaintMergesEveryIntersectedClusterWhenDragStartsOutsideWithoutReads() {
        Workset workset = workset();
        var first = area(DungeonAreaType.ROOM, 11L, 10L, List.of(new Cell(1, 0, 0)));
        var second = area(DungeonAreaType.ROOM, 22L, 20L, List.of(new Cell(3, 0, 0)));
        var preview = new DungeonEditorSessionValues.RoomRectanglePreview(
                new Cell(0, 0, 0), new Cell(4, 0, 0), false);

        var candidate = execute(workset, map(List.of(first, second)), preview);

        assertTrue(candidate.areas().stream().filter(area -> area.kind().isRoom())
                .allMatch(area -> area.clusterId() == 10L));
        assertTrue(candidate.areas().stream().flatMap(area -> area.cells().stream()).toList()
                .containsAll(List.of(
                        new Cell(0, 0, 0), new Cell(1, 0, 0), new Cell(2, 0, 0),
                        new Cell(3, 0, 0), new Cell(4, 0, 0))));
        assertNoReads(workset);
    }

    @Test
    void corridorDeletionPreviewPublishesTheVisibleDeletionResultWithoutReads() {
        Workset workset = workset();
        var room = area(DungeonAreaType.ROOM, 11L, 10L, List.of(new Cell(0, 0, 0)));
        var corridor = area(DungeonAreaType.CORRIDOR, 88L, 0L,
                List.of(new Cell(1, 0, 0), new Cell(2, 0, 0)));
        var preview = new DungeonEditorSessionValues.DeleteCorridorPreview(
                CorridorDeletionTarget.wholeCorridor(88L));

        var candidate = execute(workset, map(List.of(room, corridor)), preview);

        assertTrue(candidate.areas().stream().noneMatch(area -> area.kind().isCorridor() && area.id() == 88L));
        assertNoReads(workset);
    }

    private static Workset workset() {
        TestCatalog catalog = new TestCatalog();
        RecordingWindowStore windowStore = new RecordingWindowStore();
        DungeonAuthoredApplicationService service = new DungeonAuthoredApplicationService(
                catalog,
                windowStore,
                features.dungeon.DungeonTestAssembly.inMemoryUnitOfWork(),
                new TestDungeonIdentityAllocator(),
                DirectExecutionLane.INSTANCE,
                new DungeonAuthoredPublishedState(DirectUiDispatcher.INSTANCE));
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        DungeonEditorWorkspaceValues.MapId mapId = new DungeonEditorWorkspaceValues.MapId(1L);
        session.loadViewport(mapId, 0, 0, 0, 63, 63);
        return new Workset(windowStore, state, session, mapId);
    }

    private static DungeonEditorWorkspaceValues.MapSnapshot execute(
            Workset workset,
            DungeonEditorWorkspaceValues.MapSnapshot map,
            DungeonEditorSessionValues.Preview preview
    ) {
        var surface = new DungeonEditorSessionSnapshot.SurfaceData(
                workset.mapId(), 1L, 1L, "Map", 1, map, null, null);
        workset.session().executeInMemoryPreview(surface, preview);
        var candidate = workset.state().currentFacts(
                workset.mapId(), DungeonEditorSessionValues.Selection.empty(), preview).surface().previewMap();
        assertNotNull(candidate);
        return candidate;
    }

    private static DungeonEditorWorkspaceValues.Area area(
            DungeonAreaType kind,
            long id,
            long clusterId,
            List<Cell> cells
    ) {
        return new DungeonEditorWorkspaceValues.Area(kind, id, clusterId, kind.name(), cells, null);
    }

    private static DungeonEditorWorkspaceValues.MapSnapshot map(
            List<DungeonEditorWorkspaceValues.Area> areas
    ) {
        return new DungeonEditorWorkspaceValues.MapSnapshot(
                DungeonTopology.SQUARE, 16, 16, areas, List.of(), List.of(), List.of());
    }

    private static void assertNoReads(Workset workset) {
        assertEquals(1, workset.windowStore().loadCalls);
    }

    private record Workset(
            RecordingWindowStore windowStore,
            DungeonEditorDungeonState state,
            DungeonAuthoredApplicationService.Session session,
            DungeonEditorWorkspaceValues.MapId mapId
    ) {
    }

    private static final class TestCatalog implements DungeonCatalogStore {
        private final DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Map");

        @Override
        public List<DungeonMapHeader> search(String query) {
            return List.of(header(map));
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

        private static DungeonMapHeader header(DungeonMap dungeonMap) {
            return new DungeonMapHeader(
                    dungeonMap.metadata().mapId(),
                    dungeonMap.metadata().mapName(),
                    dungeonMap.revision());
        }
    }

    private static final class RecordingWindowStore implements DungeonWindowStore {
        private int loadCalls;

        @Override
        public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
            loadCalls++;
            List<Cell> cells = List.of(new Cell(0, 0, 0), new Cell(1, 0, 0));
            List<DungeonWindowEntityFragment.ClusterBoundaryFact> boundaries = List.of(
                    boundary(new Cell(0, 0, 0), Direction.NORTH, 101L),
                    boundary(new Cell(1, 0, 0), Direction.NORTH, 102L));
            var cluster = new DungeonWindowEntityFragment.RoomCluster(
                    DungeonPatchEntityRef.roomCluster(1L),
                    "Cluster 1",
                    cells.stream().map(cell -> new DungeonWindowEntityFragment.ClusterMemberCellFact(
                            1L, "Raum 1", cell)).toList(),
                    boundaries,
                    List.of(request.chunkKeys().stream()
                            .filter(key -> key.chunkQ() == 0 && key.chunkR() == 0)
                            .findFirst().orElseThrow()),
                    List.of(DungeonPatchEntityRef.room(1L)));
            var room = new DungeonWindowEntityFragment.Room(
                    DungeonPatchEntityRef.room(1L),
                    1L,
                    "Raum 1",
                    "",
                    cells,
                    List.of(),
                    cluster.intersectingRequestedChunks(),
                    List.of(DungeonPatchEntityRef.roomCluster(1L)));
            return Optional.of(new DungeonWindow(
                    new DungeonMapHeader(request.mapId(), "Map", 1L),
                    request.requestGeneration(),
                    request.chunkKeys().stream().map(key -> new DungeonWindowChunkHeader(key, 1L)).toList(),
                    List.of(room, cluster),
                    List.of()));
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            return new DungeonIdentityClosureResult.Rejected(
                    DungeonIdentityClosureResult.Reason.ENTITY_MISSING,
                    request.entityRefs());
        }

        private static DungeonWindowEntityFragment.ClusterBoundaryFact boundary(
                Cell cell,
                Direction direction,
                long topologyId
        ) {
            return new DungeonWindowEntityFragment.ClusterBoundaryFact(
                    cell,
                    direction,
                    DungeonWindowEntityFragment.BoundaryKind.WALL,
                    DungeonTopologyRef.wall(topologyId));
        }
    }
}

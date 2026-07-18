package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonCompoundUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.authored.port.DungeonUnitOfWork;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.execution.DirectExecutionLane;
import platform.ui.DirectUiDispatcher;

final class DungeonUnitOfWorkApplicationTest {

    @Test
    void roomCommandAutomaticallyCommitsDependentCorridorChangeAndImpact() {
        DungeonMap map = mapWithDependentCorridorAtRevision(7L);
        InMemoryStore store = new InMemoryStore(map);
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();

        service.applyRoomRectangle(
                new MapId(1L),
                new Cell(3, 1, 0),
                new Cell(3, 1, 0),
                false,
                service.openSession(state));

        DungeonPatch committedPatch = unitOfWork.lastPatch();
        assertFalse(committedPatch.changes().stream().anyMatch(CorridorChange.class::isInstance),
                "derived route impact must not become an authored corridor mutation");
        assertTrue(committedPatch.resultFacts().affectedEntities().stream().anyMatch(
                ref -> ref.kind() == DungeonPatchEntityRef.Kind.CORRIDOR));
        assertEquals(8L, acceptedRevision(state));
    }

    @Test
    void ordinaryRoomCommandAutomaticallyPlansOwningClusterImpact() {
        DungeonMap map = mapWithRoomAtRevision(7L);
        InMemoryStore store = new InMemoryStore(map);
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();

        service.applyRoomRectangle(
                new MapId(1L),
                new Cell(3, 1, 0),
                new Cell(3, 1, 0),
                false,
                service.openSession(state));

        DungeonPatch committedPatch = unitOfWork.lastPatch();
        assertTrue(committedPatch.changes().stream().anyMatch(RoomRegionChange.class::isInstance));
        assertTrue(committedPatch.resultFacts().affectedEntities().stream().anyMatch(
                        ref -> ref.kind() == DungeonPatchEntityRef.Kind.ROOM_CLUSTER),
                "the application planner must add the owning cluster impact");
        assertEquals(8L, acceptedRevision(state));
    }

    @Test
    void ordinaryCommitUndoAndRedoUsePatchCommitsWithoutPostCommitReadback() {
        InMemoryStore store = new InMemoryStore(mapAtRevision(7L));
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        MapId mapId = new MapId(1L);

        long markerId = service.createFeatureMarker(
                mapId, FeatureMarkerKind.POI, new Cell(4, 5, 0), session);

        assertEquals(1L, markerId);
        assertEquals(List.of(7L), unitOfWork.expectedRevisions());
        assertEquals(1, store.findByIdCalls);
        assertEquals(8L, acceptedRevision(state));
        assertTrue(service.canUndo(mapId));

        service.undo(mapId, session);

        assertEquals(List.of(7L, 8L), unitOfWork.expectedRevisions());
        assertEquals(1, store.findByIdCalls, "undo reuses the committed in-memory workset");
        assertEquals(9L, acceptedRevision(state));
        assertTrue(service.canRedo(mapId));

        service.redo(mapId, session);

        assertEquals(List.of(7L, 8L, 9L), unitOfWork.expectedRevisions());
        assertEquals(1, store.findByIdCalls, "redo reuses the committed in-memory workset");
        assertEquals(10L, acceptedRevision(state));
    }

    @Test
    void mapNotFoundMovesNeitherWorksetNorHistoryAndPublishesInvalidTarget() {
        InMemoryStore store = new InMemoryStore(mapAtRevision(7L));
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        unitOfWork.rejectNext(DungeonUnitOfWorkResult.Reason.MAP_NOT_FOUND);
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        MapId mapId = new MapId(1L);

        assertEquals(0L, service.createFeatureMarker(
                mapId, FeatureMarkerKind.POI, new Cell(4, 5, 0), session));

        DungeonEditorCommandOutcome.Rejected rejected = assertInstanceOf(
                DungeonEditorCommandOutcome.Rejected.class,
                state.committedFacts(mapId).commandOutcome());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET, rejected.reason());
        assertFalse(service.canUndo(mapId));
        assertFalse(service.canRedo(mapId));

        assertEquals(1L, service.createFeatureMarker(
                mapId, FeatureMarkerKind.POI, new Cell(4, 5, 0), session));

        assertEquals(List.of(7L, 7L), unitOfWork.expectedRevisions(),
                "the missing-map candidate was never installed in the workset");
        assertEquals(8L, acceptedRevision(state));
        assertTrue(service.canUndo(mapId));
    }

    @Test
    void thrownStorageFailureLeavesPublicationWorksetAndHistoryUntouched() {
        InMemoryStore store = new InMemoryStore(mapAtRevision(7L));
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        unitOfWork.failNext(new IllegalStateException("injected storage failure"));
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        MapId mapId = new MapId(1L);
        var beforeFailure = state.committedFacts(mapId);

        assertThrows(IllegalStateException.class, () -> service.createFeatureMarker(
                mapId, FeatureMarkerKind.POI, new Cell(4, 5, 0), session));

        assertEquals(beforeFailure, state.committedFacts(mapId));
        assertFalse(service.canUndo(mapId));
        assertFalse(service.canRedo(mapId));

        assertEquals(1L, service.createFeatureMarker(
                mapId, FeatureMarkerKind.POI, new Cell(4, 5, 0), session));

        assertEquals(List.of(7L, 7L), unitOfWork.expectedRevisions(),
                "the failed candidate was never installed in the workset");
        assertEquals(8L, acceptedRevision(state));
        assertTrue(service.canUndo(mapId));
    }

    @Test
    void thrownUndoAndRedoFailuresLeavePublicationWorksetAndHistoryStacksUntouched() {
        InMemoryStore store = new InMemoryStore(mapAtRevision(7L));
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        MapId mapId = new MapId(1L);
        assertEquals(1L, service.createFeatureMarker(
                mapId, FeatureMarkerKind.POI, new Cell(4, 5, 0), session));

        var beforeUndoFailure = state.committedFacts(mapId);
        unitOfWork.failNext(new IllegalStateException("injected undo storage failure"));
        assertThrows(IllegalStateException.class, () -> service.undo(mapId, session));

        assertEquals(beforeUndoFailure, state.committedFacts(mapId));
        assertEquals(8L, acceptedRevision(state));
        assertTrue(service.canUndo(mapId));
        assertFalse(service.canRedo(mapId));

        service.undo(mapId, session);
        assertEquals(9L, acceptedRevision(state));
        assertFalse(service.canUndo(mapId));
        assertTrue(service.canRedo(mapId));

        var beforeRedoFailure = state.committedFacts(mapId);
        unitOfWork.failNext(new IllegalStateException("injected redo storage failure"));
        assertThrows(IllegalStateException.class, () -> service.redo(mapId, session));

        assertEquals(beforeRedoFailure, state.committedFacts(mapId));
        assertEquals(9L, acceptedRevision(state));
        assertFalse(service.canUndo(mapId));
        assertTrue(service.canRedo(mapId));

        service.redo(mapId, session);
        assertEquals(List.of(7L, 8L, 8L, 9L, 9L), unitOfWork.expectedRevisions());
        assertEquals(10L, acceptedRevision(state));
        assertTrue(service.canUndo(mapId));
        assertFalse(service.canRedo(mapId));
    }

    @Test
    void staleCommitMovesNeitherWorksetNorHistoryAndPublishesTypedRejection() {
        InMemoryStore store = new InMemoryStore(mapAtRevision(7L));
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        unitOfWork.rejectNext(DungeonUnitOfWorkResult.Reason.STALE_REVISION);
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        MapId mapId = new MapId(1L);

        assertEquals(0L, service.createFeatureMarker(
                mapId, FeatureMarkerKind.POI, new Cell(4, 5, 0), session));

        DungeonEditorCommandOutcome.Rejected rejected = assertInstanceOf(
                DungeonEditorCommandOutcome.Rejected.class,
                state.committedFacts(mapId).commandOutcome());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION, rejected.reason());
        assertFalse(service.canUndo(mapId));

        assertEquals(1L, service.createFeatureMarker(
                mapId, FeatureMarkerKind.POI, new Cell(4, 5, 0), session));

        assertEquals(List.of(7L, 7L), unitOfWork.expectedRevisions(),
                "the rejected candidate was never installed in the workset");
        assertEquals(8L, acceptedRevision(state));
        assertTrue(service.canUndo(mapId));
    }

    private static DungeonAuthoredApplicationService service(
            InMemoryStore store,
            DungeonUnitOfWork unitOfWork
    ) {
        return new DungeonAuthoredApplicationService(
                store,
                store,
                FailFastWindowStore.INSTANCE,
                unitOfWork,
                DirectExecutionLane.INSTANCE,
                new DungeonAuthoredPublishedState(DirectUiDispatcher.INSTANCE));
    }

    private static long acceptedRevision(DungeonEditorDungeonState state) {
        DungeonEditorCommandOutcome.Accepted accepted = assertInstanceOf(
                DungeonEditorCommandOutcome.Accepted.class,
                state.committedFacts(new MapId(1L)).commandOutcome());
        return accepted.authoredRevision();
    }

    private static DungeonMap mapAtRevision(long revision) {
        return DungeonMapAuthoring.committedContent(
                DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Map"),
                revision);
    }

    private static DungeonMap mapWithRoomAtRevision(long revision) {
        DungeonMap room = DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Impact map")
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(2, 2, 0));
        return DungeonMapAuthoring.committedContent(room, revision);
    }

    private static DungeonMap mapWithDependentCorridorAtRevision(long revision) {
        DungeonMap rooms = DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Impact map")
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(2, 2, 0))
                .paintRoomRectangle(new Cell(7, 1, 0), new Cell(8, 2, 0));
        var first = rooms.rooms().rooms().getFirst();
        var second = rooms.rooms().rooms().getLast();
        DungeonMap connected = rooms.createCorridor(
                new OrthogonalCorridorRoutingPolicy(),
                0L,
                DungeonCorridorEndpoint.door(
                        first.roomId(), first.clusterId(), new Cell(2, 1, 0), Direction.EAST,
                        DungeonTopologyRef.empty()),
                DungeonCorridorEndpoint.door(
                        second.roomId(), second.clusterId(), new Cell(7, 1, 0), Direction.WEST,
                        DungeonTopologyRef.empty()));
        return DungeonMapAuthoring.committedContent(connected, revision);
    }

    private static final class RecordingUnitOfWork implements DungeonUnitOfWork {
        private final List<DungeonPatch> patches = new ArrayList<>();
        private DungeonUnitOfWorkResult.Reason nextRejection;
        private RuntimeException nextFailure;

        @Override
        public DungeonUnitOfWorkResult commit(DungeonPatch patch) {
            patches.add(patch);
            if (nextFailure != null) {
                RuntimeException failure = nextFailure;
                nextFailure = null;
                throw failure;
            }
            if (nextRejection != null) {
                DungeonUnitOfWorkResult.Reason rejection = nextRejection;
                nextRejection = null;
                return new DungeonUnitOfWorkResult.Rejected(rejection);
            }
            return new DungeonUnitOfWorkResult.Committed(
                    patch.mapId(),
                    patch.committedRevision(),
                    patch.touchedChunks().stream().collect(java.util.stream.Collectors.toUnmodifiableMap(
                            key -> key,
                            ignored -> patch.committedRevision())),
                    patch.resultFacts());
        }

        @Override
        public DungeonCompoundUnitOfWorkResult commit(DungeonCompoundPatch patch) {
            throw new AssertionError("single-map application route used the compound-patch overload");
        }

        private List<Long> expectedRevisions() {
            return patches.stream().map(DungeonPatch::expectedRevision).toList();
        }

        private DungeonPatch lastPatch() {
            return patches.getLast();
        }

        private void rejectNext(DungeonUnitOfWorkResult.Reason reason) {
            nextRejection = reason;
        }

        private void failNext(RuntimeException failure) {
            nextFailure = failure;
        }
    }

    private static final class InMemoryStore implements DungeonCatalogStore, DungeonMapRepository {
        private final DungeonMap map;
        private int findByIdCalls;

        private InMemoryStore(DungeonMap map) {
            this.map = map;
        }

        @Override public long nextStairId() { return 1L; }
        @Override public long nextTransitionId() { return 1L; }

        @Override
        public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
            findByIdCalls++;
            if (findByIdCalls > 1) {
                throw new AssertionError("repository read attempted after initial workset hydration");
            }
            return map.metadata().mapId().equals(mapId) ? Optional.of(map) : Optional.empty();
        }

        @Override public Optional<DungeonMap> firstMap() {
            throw new AssertionError("fallback repository read attempted after requested-map hydration");
        }

        @Override
        public List<DungeonMapHeader> search(String query) {
            return List.of(new DungeonMapHeader(map.metadata().mapId(), map.metadata().mapName(), map.revision()));
        }

        @Override public DungeonMapHeader create(String mapName) { throw new UnsupportedOperationException(); }
        @Override public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
            throw new UnsupportedOperationException();
        }
        @Override public void delete(DungeonMapIdentity mapId) { throw new UnsupportedOperationException(); }
    }

    private enum FailFastWindowStore implements DungeonWindowStore {
        INSTANCE;

        @Override
        public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
            throw new AssertionError("Window read attempted during patch commit publication");
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            throw new AssertionError("identity-closure read attempted during patch commit publication");
        }
    }
}

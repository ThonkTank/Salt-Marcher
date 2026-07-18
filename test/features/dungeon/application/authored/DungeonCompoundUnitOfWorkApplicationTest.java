package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
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
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.execution.DirectExecutionLane;
import platform.ui.DirectUiDispatcher;

final class DungeonCompoundUnitOfWorkApplicationTest {

    @Test
    void transitionLinkUndoAndRedoUseOneCompoundCommitWithoutPostCommitReads() {
        InMemoryStore store = twoMapStore();
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        long initialRevision = store.revision(11L);

        assertTrue(session.saveAuthoredTransitionLink(new MapId(11L), 1L, 12L, 2L, true));

        assertEquals(1, unitOfWork.compoundPatches.size());
        assertEquals(List.of(11L, 12L), unitOfWork.mapIds(0));
        assertEquals(List.of(initialRevision, initialRevision), unitOfWork.expectedRevisions(0));
        assertEquals(0, unitOfWork.singleCommitCalls);
        assertEquals(initialRevision + 1L, acceptedRevision(state, 11L));
        assertTrue(service.canUndo(new MapId(11L)));
        assertTrue(service.canUndo(new MapId(12L)));
        int readsAfterCommand = store.findByIdCalls;

        service.undo(new MapId(11L), session);

        assertEquals(readsAfterCommand, store.findByIdCalls,
                "compound undo must reuse the committed authored workset");
        assertEquals(List.of(initialRevision + 1L, initialRevision + 1L), unitOfWork.expectedRevisions(1));
        assertEquals(initialRevision + 2L, acceptedRevision(state, 11L));
        assertTrue(service.canRedo(new MapId(12L)));

        service.redo(new MapId(12L), session);

        assertEquals(readsAfterCommand, store.findByIdCalls,
                "compound redo must reuse the committed authored workset");
        assertEquals(List.of(initialRevision + 2L, initialRevision + 2L), unitOfWork.expectedRevisions(2));
        assertEquals(initialRevision + 3L, acceptedRevision(state, 12L));
        assertEquals(3, unitOfWork.compoundPatches.size());
        assertEquals(0, unitOfWork.singleCommitCalls);
    }

    @Test
    void rejectedCompoundUndoLeavesPublicationWorksetAndSharedHistoryCurrent() {
        InMemoryStore store = twoMapStore();
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        long initialRevision = store.revision(11L);
        assertTrue(session.saveAuthoredTransitionLink(new MapId(11L), 1L, 12L, 2L, true));
        var beforeRejection = state.committedFacts(new MapId(11L));
        int readsAfterCommand = store.findByIdCalls;

        unitOfWork.rejectNext(12L, DungeonUnitOfWorkResult.Reason.STALE_REVISION);
        service.undo(new MapId(11L), session);

        DungeonEditorCommandOutcome.Rejected rejected = assertInstanceOf(
                DungeonEditorCommandOutcome.Rejected.class,
                state.committedFacts(new MapId(11L)).commandOutcome());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION, rejected.reason());
        assertEquals(
                beforeRejection.committedSnapshot(),
                state.committedFacts(new MapId(11L)).committedSnapshot());
        assertEquals(readsAfterCommand, store.findByIdCalls);
        assertTrue(service.canUndo(new MapId(11L)));
        assertTrue(service.canUndo(new MapId(12L)));
        assertFalse(service.canRedo(new MapId(11L)));

        unitOfWork.failNext(new IllegalStateException("injected compound undo failure"));
        assertThrows(IllegalStateException.class, () -> service.undo(new MapId(12L), session));
        assertEquals(readsAfterCommand, store.findByIdCalls);
        assertTrue(service.canUndo(new MapId(11L)));
        assertTrue(service.canUndo(new MapId(12L)));
        assertFalse(service.canRedo(new MapId(12L)));

        service.undo(new MapId(12L), session);

        assertEquals(List.of(initialRevision + 1L, initialRevision + 1L), unitOfWork.expectedRevisions(1));
        assertEquals(List.of(initialRevision + 1L, initialRevision + 1L), unitOfWork.expectedRevisions(2),
                "the failed candidate was never installed");
        assertEquals(List.of(initialRevision + 1L, initialRevision + 1L), unitOfWork.expectedRevisions(3),
                "the rejected candidate was never installed");
        assertFalse(service.canUndo(new MapId(11L)));
        assertTrue(service.canRedo(new MapId(12L)));
    }

    @Test
    void failedOrMismatchedTransitionCommitInstallsNeitherCandidateNorHistory() {
        InMemoryStore store = twoMapStore();
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        long initialRevision = store.revision(11L);

        unitOfWork.failNext(new IllegalStateException("injected compound storage failure"));
        assertThrows(IllegalStateException.class, () -> session.saveAuthoredTransitionLink(
                new MapId(11L), 1L, 12L, 2L, true));
        assertFalse(service.canUndo(new MapId(11L)));
        assertFalse(service.canUndo(new MapId(12L)));

        unitOfWork.omitLastMapNext();
        assertThrows(IllegalStateException.class, () -> session.saveAuthoredTransitionLink(
                new MapId(11L), 1L, 12L, 2L, true));
        assertFalse(service.canUndo(new MapId(11L)));

        unitOfWork.mismatchFirstRevisionNext();
        assertThrows(IllegalStateException.class, () -> session.saveAuthoredTransitionLink(
                new MapId(11L), 1L, 12L, 2L, true));
        assertFalse(service.canUndo(new MapId(11L)));

        assertTrue(session.saveAuthoredTransitionLink(new MapId(11L), 1L, 12L, 2L, true));

        assertEquals(List.of(initialRevision, initialRevision), unitOfWork.expectedRevisions(0));
        assertEquals(List.of(initialRevision, initialRevision), unitOfWork.expectedRevisions(1));
        assertEquals(List.of(initialRevision, initialRevision), unitOfWork.expectedRevisions(2),
                "mismatched adapter results must not install candidates");
        assertEquals(List.of(initialRevision, initialRevision), unitOfWork.expectedRevisions(3),
                "failed adapter contracts must not install candidates");
        assertEquals(initialRevision + 1L, acceptedRevision(state, 11L));
        assertTrue(service.canUndo(new MapId(12L)));
    }

    @Test
    void oneMapCompoundHistoryAlwaysUsesTheCompoundOverload() {
        InMemoryStore store = twoMapStore();
        RecordingUnitOfWork unitOfWork = new RecordingUnitOfWork();
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService service = service(store, unitOfWork);
        DungeonAuthoredApplicationService.Session session = service.openSession(state);

        assertTrue(session.saveAuthoredTransitionLink(new MapId(11L), 1L, 12L, 2L, false));
        assertEquals(1, unitOfWork.compoundPatches.getFirst().patches().size());

        service.undo(new MapId(11L), session);

        assertEquals(2, unitOfWork.compoundPatches.size());
        assertEquals(1, unitOfWork.compoundPatches.getLast().patches().size());
        assertEquals(0, unitOfWork.singleCommitCalls);
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

    private static long acceptedRevision(DungeonEditorDungeonState state, long mapId) {
        DungeonEditorCommandOutcome.Accepted accepted = assertInstanceOf(
                DungeonEditorCommandOutcome.Accepted.class,
                state.committedFacts(new MapId(mapId)).commandOutcome());
        return accepted.authoredRevision();
    }

    private static InMemoryStore twoMapStore() {
        return new InMemoryStore(List.of(
                transitionMap(11L, 1L, "Source"),
                transitionMap(12L, 2L, "Target")));
    }

    private static DungeonMap transitionMap(long mapId, long transitionId, String name) {
        DungeonMap empty = DungeonMapAuthoring.empty(new DungeonMapIdentity(mapId), name);
        Transition transition = new Transition(
                transitionId,
                mapId,
                name + " transition",
                TransitionAnchor.cell(new Cell((int) transitionId, 0, 0)),
                TransitionDestination.unlinkedEntrance(),
                null);
        return empty.withTransitionCatalog(new TransitionCatalog(List.of(transition)));
    }

    private static final class RecordingUnitOfWork implements DungeonUnitOfWork {
        private final List<DungeonCompoundPatch> compoundPatches = new ArrayList<>();
        private int singleCommitCalls;
        private DungeonUnitOfWorkResult.Reason nextRejection;
        private long nextRejectedMapId;
        private RuntimeException nextFailure;
        private boolean omitLastMap;
        private boolean mismatchFirstRevision;

        @Override
        public DungeonUnitOfWorkResult commit(DungeonPatch patch) {
            singleCommitCalls++;
            throw new AssertionError("compound application route used the single-patch overload");
        }

        @Override
        public DungeonCompoundUnitOfWorkResult commit(DungeonCompoundPatch patch) {
            compoundPatches.add(patch);
            if (nextFailure != null) {
                RuntimeException failure = nextFailure;
                nextFailure = null;
                throw failure;
            }
            if (nextRejection != null) {
                DungeonUnitOfWorkResult.Reason reason = nextRejection;
                nextRejection = null;
                return new DungeonCompoundUnitOfWorkResult.Rejected(
                        new DungeonMapIdentity(nextRejectedMapId), reason);
            }
            List<DungeonPatch> committedPatches = omitLastMap
                    ? patch.patches().subList(0, patch.patches().size() - 1)
                    : patch.patches();
            omitLastMap = false;
            List<DungeonUnitOfWorkResult.Committed> committedMaps = new ArrayList<>(
                    committedPatches.stream().map(RecordingUnitOfWork::committed).toList());
            if (mismatchFirstRevision) {
                DungeonUnitOfWorkResult.Committed first = committedMaps.getFirst();
                committedMaps.set(0, new DungeonUnitOfWorkResult.Committed(
                        first.mapId(),
                        first.committedRevision() + 1L,
                        first.chunkRevisions(),
                        first.resultFacts()));
                mismatchFirstRevision = false;
            }
            return new DungeonCompoundUnitOfWorkResult.Committed(
                    committedMaps);
        }

        private static DungeonUnitOfWorkResult.Committed committed(DungeonPatch patch) {
            return new DungeonUnitOfWorkResult.Committed(
                    patch.mapId(),
                    patch.committedRevision(),
                    patch.touchedChunks().stream().collect(java.util.stream.Collectors.toUnmodifiableMap(
                            key -> key,
                            ignored -> patch.committedRevision())),
                    patch.resultFacts());
        }

        private List<Long> mapIds(int commitIndex) {
            return compoundPatches.get(commitIndex).patches().stream()
                    .map(patch -> patch.mapId().value())
                    .sorted()
                    .toList();
        }

        private List<Long> expectedRevisions(int commitIndex) {
            return compoundPatches.get(commitIndex).patches().stream()
                    .sorted(java.util.Comparator.comparingLong(patch -> patch.mapId().value()))
                    .map(DungeonPatch::expectedRevision)
                    .toList();
        }

        private void rejectNext(long mapId, DungeonUnitOfWorkResult.Reason reason) {
            nextRejectedMapId = mapId;
            nextRejection = reason;
        }

        private void failNext(RuntimeException failure) {
            nextFailure = failure;
        }

        private void omitLastMapNext() {
            omitLastMap = true;
        }

        private void mismatchFirstRevisionNext() {
            mismatchFirstRevision = true;
        }
    }

    private static final class InMemoryStore implements DungeonCatalogStore, DungeonMapRepository {
        private final Map<Long, DungeonMap> maps = new LinkedHashMap<>();
        private int findByIdCalls;

        private InMemoryStore(List<DungeonMap> maps) {
            for (DungeonMap map : maps) {
                this.maps.put(map.metadata().mapId().value(), map);
            }
        }

        @Override public long nextStairId() { return 1L; }
        @Override public long nextTransitionId() { return 1L; }

        @Override
        public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
            findByIdCalls++;
            return Optional.ofNullable(maps.get(mapId.value()));
        }

        @Override public Optional<DungeonMap> firstMap() { return maps.values().stream().findFirst(); }

        private long revision(long mapId) {
            return maps.get(mapId).revision();
        }

        @Override
        public List<DungeonMapHeader> search(String query) {
            return maps.values().stream()
                    .map(map -> new DungeonMapHeader(
                            map.metadata().mapId(), map.metadata().mapName(), map.revision()))
                    .toList();
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
            throw new AssertionError("Window read attempted during compound commit publication");
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            throw new AssertionError("identity-closure read attempted during compound commit publication");
        }
    }
}

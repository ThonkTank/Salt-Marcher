package features.dungeon.application.editor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import features.dungeon.DungeonTestAssembly;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.editor.DungeonEditorIntent;
import features.dungeon.api.editor.DungeonEditorPointerGesture;
import features.dungeon.api.editor.DungeonEditorPointerInput;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolOptions;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.editor.DungeonEditorViewportInput;
import features.party.PartyServiceAssembly;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;

final class DungeonEditorRuntimeThreadOwnershipTest {

    @Test
    void stalePointerInputPublishesTypedRejectionWithoutChangingAuthoredState() {
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");
        DungeonEditorApi api = new DungeonEditorApiFacade(
                createRuntimeDirect(repository),
                DirectUiDispatcher.INSTANCE);
        DungeonEditorState before = api.current();

        api.dispatch(new DungeonEditorIntent.Pointer(new DungeonEditorPointerInput(
                0L,
                DungeonEditorPointerInput.Action.PRESSED,
                DungeonEditorToolSelection.select(),
                new DungeonEditorPointerGesture(
                        DungeonEditorPointerGesture.Button.PRIMARY,
                        false,
                        false),
                0.0,
                0.0,
                List.of(DungeonEditorPointerInput.Target.empty()),
                0,
                DungeonEditorIntent.TransitionDestinationInput.empty())));

        DungeonEditorState after = api.current();
        DungeonEditorCommandOutcome.Rejected rejected =
                (DungeonEditorCommandOutcome.Rejected) after.commandStatus().outcome();
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.STALE_REVISION, rejected.reason());
        assertEquals(before.selectedWindow(), after.selectedWindow(),
                "stale pointer input leaves authored state and revision unchanged");
        assertTrue(after.publicationRevision() > before.publicationRevision(),
                "stale pointer rejection publishes one new atomic editor state");
    }

    @Test
    void editorApiPublishesTheTypedToolOptionSelectedByItsConsumer() {
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");
        DungeonEditorFeatureRuntimeRoot runtime = createRuntimeDirect(repository);
        DungeonEditorApi api = new DungeonEditorApiFacade(runtime, DirectUiDispatcher.INSTANCE);
        DungeonEditorToolSelection pathSelection = DungeonEditorToolSelection.family(
                DungeonEditorToolFamily.WALL);
        DungeonEditorToolSelection singleSelection = new DungeonEditorToolSelection(
                DungeonEditorToolFamily.WALL,
                new DungeonEditorToolOptions.Wall(DungeonEditorToolOptions.Wall.Mode.SINGLE));

        api.dispatch(new DungeonEditorIntent.SetTool(pathSelection));
        long pathRevision = api.current().publicationRevision();
        api.dispatch(new DungeonEditorIntent.SetTool(singleSelection));

        assertEquals(singleSelection, api.current().toolSelection());
        assertTrue(api.current().publicationRevision() > pathRevision,
                "an option-only change must publish even when its legacy tool value stays equal");
    }

    @Test
    void editorApiPublishesOneAtomicStateAndDispatchesThroughTheRuntimeOwner() {
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");
        DungeonEditorFeatureRuntimeRoot runtime = createRuntimeDirect(repository);
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        DungeonEditorApi api = new DungeonEditorApiFacade(runtime, dispatcher);
        api.dispatch(new DungeonEditorIntent.SetViewport(
                new DungeonEditorViewportInput(0, -8, -8, 8, 8)));
        List<DungeonEditorState> delivered = new ArrayList<>();
        api.subscribe(delivered::add);

        api.dispatch(new DungeonEditorIntent.CreateMap("Second"));

        DungeonEditorState current = api.current();
        assertEquals(2, repository.size());
        assertEquals(2, current.catalog().size());
        assertEquals("Second", current.selectedWindow().mapName());
        assertTrue(current.publicationRevision() > 0L);
        assertTrue(delivered.isEmpty(), "API publications must cross the supplied UI dispatcher");

        dispatcher.runAll();

        assertEquals(1, delivered.size());
        DungeonEditorState published = delivered.getFirst();
        assertEquals(current.publicationRevision(), published.publicationRevision());
        assertEquals(current.catalog(), published.catalog());
        assertEquals(current.selectedMapId(), published.selectedMapId());
        assertEquals(current.selectedWindow(), published.selectedWindow());
        assertEquals(current.selection(), published.selection());
        assertEquals(current.preview(), published.preview());
        assertEquals(current.inspector(), published.inspector());
        assertEquals(current.commandStatus(), published.commandStatus());
        assertEquals(DungeonEditorToolFamily.SELECT, published.toolSelection().family());
        assertEquals(DungeonEditorToolOptions.none(), published.toolSelection().options());
    }

    @Test
    void constructionDefersInitialReadbackAndDeliversTheCompletedOwnerFrame() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");

        DungeonEditorFeatureRuntimeRoot runtime = createRuntime(repository, lane, dispatcher);
        List<DungeonEditorState> delivered = new ArrayList<>();
        runtime.subscribe(delivered::add);

        assertEquals(0, repository.reads,
                "runtime construction must not perform persistence-backed readback on the caller");
        assertEquals(null, runtime.currentState().selectedMapId());
        assertEquals(2, lane.pending(), "initialization must precede queued subscriber registration");

        lane.runNext();

        assertTrue(repository.reads > 0, "initial readback must run on the supplied execution lane");
        assertEquals(1, runtime.currentState().catalog().size());
        assertEquals("Only", runtime.currentState().catalog().getFirst().mapName());
        assertTrue(delivered.isEmpty(), "subscriber registration is still queued behind initialization");

        lane.runNext();

        assertEquals(1, delivered.size());
        assertEquals("Only", delivered.getFirst().catalog().getFirst().mapName());
        dispatcher.runAll();
        lane.runAll();
        assertEquals(1, delivered.size(), "deferred model callbacks must not duplicate the completed frame");
    }

    @Test
    void directLanePreservesSynchronousInitialReadback() {
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");

        DungeonEditorFeatureRuntimeRoot runtime = createRuntimeDirect(repository);

        assertTrue(repository.reads > 0);
        assertEquals("Only", runtime.currentState().catalog().getFirst().mapName());
    }

    @Test
    void queuesMapSwitchDraftAndSubscriptionLifecycleOnOneOwner() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "First");
        repository.seed(2L, "Second");
        DungeonEditorFeatureRuntimeRoot runtime = createRuntime(repository, lane, dispatcher);
        List<DungeonEditorState> delivered = new ArrayList<>();

        Runnable unsubscribe = runtime.subscribe(delivered::add);
        lane.runNext();
        lane.runNext();
        runtime.selectMap(2L);
        runtime.beginInlineLabelEdit(activeEdit("before-owner-run"));

        assertFalse(runtime.currentState().draft().inlineLabel().active(),
                "caller methods must not mutate the cached frame before owner execution");
        assertEquals(2, lane.pending());

        lane.runNext();
        assertEquals(2L, runtime.currentState().selectedMapId().value());
        assertFalse(runtime.currentState().draft().inlineLabel().active());
        assertTrue(repository.reads > 0, "map switch must exercise repository-backed readback on the owner lane");

        lane.runNext();
        assertTrue(runtime.currentState().draft().inlineLabel().active());
        assertEquals("before-owner-run", runtime.currentState().draft().inlineLabel().text());
        assertEquals(2L, runtime.currentState().selectedMapId().value());

        dispatcher.runAll();
        lane.runAll();
        int deliveredBeforeClose = delivered.size();
        unsubscribe.run();
        runtime.updateInlineLabelEditDraft("after-close");
        lane.runAll();

        assertEquals(deliveredBeforeClose, delivered.size(),
                "queued unsubscribe must close runtime delivery before later owner publications");
        assertEquals("after-close", runtime.currentState().draft().inlineLabel().text());
    }

    @Test
    void unsubscribeBeforeQueuedRegistrationNeverOpensDelivery() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");
        DungeonEditorFeatureRuntimeRoot runtime = createRuntime(repository, lane, dispatcher);
        List<DungeonEditorState> delivered = new ArrayList<>();

        Runnable unsubscribe = runtime.subscribe(delivered::add);
        unsubscribe.run();
        lane.runAll();
        runtime.selectMap(1L);
        lane.runAll();

        assertTrue(delivered.isEmpty());
    }

    @Test
    void queuedRegistrationReplaysAnOwnerFrameThatCompletedAheadOfIt() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");
        DungeonEditorFeatureRuntimeRoot runtime = createRuntime(repository, lane, dispatcher);
        List<DungeonEditorState> delivered = new ArrayList<>();

        runtime.selectMap(1L);
        runtime.subscribe(delivered::add);
        lane.runAll();

        assertEquals(1, delivered.size());
        assertEquals(1L, delivered.getFirst().selectedMapId().value());
    }

    private static DungeonEditorFeatureRuntimeRoot createRuntime(
            InMemoryDungeonRepository repository,
            QueuedExecutionLane lane,
            UiDispatcher dispatcher
    ) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                new InMemoryPartyRepository(), lane, dispatcher, (id, type) -> { });
        lane.runAll();
        DungeonTestAssembly.Component dungeon = DungeonTestAssembly.create(
                repository,
                repository,
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                lane,
                dispatcher,
                (id, type) -> { });
        return DungeonEditorFeatureRuntimeRoot.create(new DungeonEditorRuntimeDependencies(
                dungeon.editorControls(), dungeon.editorMapSurface(), dungeon.editorState(),
                dungeon.editor(),
                lane,
                dispatcher));
    }

    private static DungeonEditorFeatureRuntimeRoot createRuntimeDirect(InMemoryDungeonRepository repository) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                new InMemoryPartyRepository(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                (id, type) -> { });
        DungeonTestAssembly.Component dungeon = DungeonTestAssembly.create(
                repository,
                repository,
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                (id, type) -> { });
        return DungeonEditorFeatureRuntimeRoot.create(new DungeonEditorRuntimeDependencies(
                dungeon.editorControls(), dungeon.editorMapSurface(), dungeon.editorState(),
                dungeon.editor(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE));
    }

    private static DungeonEditorInlineLabelEditSession activeEdit(String text) {
        return DungeonEditorInlineLabelEditSession.active(
                new DungeonEditorInlineLabelEditSession.Target(
                        DungeonEditorRuntimeLabelTarget.room(11L),
                        "ROOM",
                        11L,
                        0L,
                        "ROOM",
                        11L),
                text,
                new DungeonEditorInlineLabelEditSession.Placement(1.0, 1.0, 4.0, 1.0, 0.0));
    }

    private static final class QueuedExecutionLane implements ExecutionLane {
        private final Deque<Runnable> work = new ArrayDeque<>();
        private boolean running;

        @Override
        public void execute(Runnable task) {
            if (running) {
                task.run();
            } else {
                work.addLast(task);
            }
        }

        int pending() {
            return work.size();
        }

        void runNext() {
            if (work.isEmpty()) {
                return;
            }
            running = true;
            try {
                work.removeFirst().run();
            } finally {
                running = false;
            }
        }

        void runAll() {
            while (!work.isEmpty()) {
                runNext();
            }
        }

        @Override
        public void close() {
            work.clear();
        }
    }

    private static final class QueuedUiDispatcher implements UiDispatcher {
        private final Deque<Runnable> updates = new ArrayDeque<>();

        @Override
        public void dispatch(Runnable update) {
            updates.addLast(update);
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
        }
    }

    private static final class InMemoryPartyRepository implements PartyRosterRepository {
        private PartyRoster roster = new PartyRoster(1L, List.of());

        @Override
        public PartyRoster load() {
            return roster;
        }

        @Override
        public void save(PartyRoster nextRoster) {
            roster = nextRoster;
        }
    }

    private static final class InMemoryDungeonRepository
            implements DungeonCatalogStore, DungeonWindowStore {
        private final Map<Long, DungeonMap> maps = new LinkedHashMap<>();
        private int reads;

        void seed(long mapId, String name) {
            DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(mapId), name);
            maps.put(mapId, map);
        }

        int size() {
            return maps.size();
        }

        @Override
        public List<DungeonMapHeader> search(String query) {
            reads++;
            String safeQuery = query == null ? "" : query.toLowerCase(java.util.Locale.ROOT);
            return maps.values().stream()
                    .filter(map -> map.metadata().mapName().toLowerCase(java.util.Locale.ROOT).contains(safeQuery))
                    .map(InMemoryDungeonRepository::header)
                    .toList();
        }

        @Override
        public DungeonMapHeader create(String mapName) {
            long mapId = maps.keySet().stream().mapToLong(Long::longValue).max().orElse(0L) + 1L;
            DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(mapId), mapName);
            maps.put(mapId, map);
            return header(map);
        }

        @Override
        public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
            DungeonMap renamed = DungeonMapAuthoring.rename(maps.get(mapId.value()), mapName);
            maps.put(mapId.value(), renamed);
            return header(renamed);
        }

        @Override
        public void delete(DungeonMapIdentity mapId) {
            maps.remove(mapId.value());
        }

        @Override
        public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
            reads++;
            DungeonMap map = maps.get(request.mapId().value());
            if (map == null) {
                return Optional.empty();
            }
            return Optional.of(new DungeonWindow(
                    header(map),
                    request.requestGeneration(),
                    request.chunkKeys().stream()
                            .map(key -> new DungeonWindowChunkHeader(key, 0L))
                            .toList(),
                    List.of(),
                    List.of()));
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            reads++;
            DungeonMap map = maps.get(request.mapId().value());
            if (map == null) {
                return new DungeonIdentityClosureResult.Rejected(
                        DungeonIdentityClosureResult.Reason.MAP_MISSING,
                        request.entityRefs());
            }
            if (map.revision() != request.expectedMapRevision()) {
                return new DungeonIdentityClosureResult.Rejected(
                        DungeonIdentityClosureResult.Reason.STALE_REVISION,
                        request.entityRefs());
            }
            if (!request.entityRefs().isEmpty()) {
                return new DungeonIdentityClosureResult.Rejected(
                        DungeonIdentityClosureResult.Reason.ENTITY_MISSING,
                        request.entityRefs());
            }
            return new DungeonIdentityClosureResult.Complete(header(map), List.of());
        }

        private static DungeonMapHeader header(DungeonMap map) {
            return new DungeonMapHeader(
                    map.metadata().mapId(),
                    map.metadata().mapName(),
                    map.revision());
        }
    }
}

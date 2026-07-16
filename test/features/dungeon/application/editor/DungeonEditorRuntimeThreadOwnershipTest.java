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
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.party.PartyServiceAssembly;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;

final class DungeonEditorRuntimeThreadOwnershipTest {

    @Test
    void constructionDefersInitialReadbackAndDeliversTheCompletedOwnerFrame() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");

        DungeonEditorFeatureRuntimeRoot runtime = createRuntime(repository, lane, dispatcher);
        List<DungeonEditorRenderFrame> delivered = new ArrayList<>();
        runtime.subscribe(delivered::add);

        assertEquals(0, repository.reads,
                "runtime construction must not perform persistence-backed readback on the caller");
        assertEquals(0L, runtime.currentFrame().preparedFacts().selectedMapIdValue());
        assertEquals(2, lane.pending(), "initialization must precede queued subscriber registration");

        lane.runNext();

        assertTrue(repository.reads > 0, "initial readback must run on the supplied execution lane");
        assertEquals(1, runtime.currentFrame().preparedFacts().mapEntries().size());
        assertEquals("Only", runtime.currentFrame().preparedFacts().mapEntries().getFirst().mapName());
        assertTrue(delivered.isEmpty(), "subscriber registration is still queued behind initialization");

        lane.runNext();

        assertEquals(1, delivered.size());
        assertEquals("Only", delivered.getFirst().preparedFacts().mapEntries().getFirst().mapName());
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
        assertEquals("Only", runtime.currentFrame().preparedFacts().mapEntries().getFirst().mapName());
    }

    @Test
    void queuesMapSwitchDraftAndSubscriptionLifecycleOnOneOwner() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "First");
        repository.seed(2L, "Second");
        DungeonEditorFeatureRuntimeRoot runtime = createRuntime(repository, lane, dispatcher);
        List<DungeonEditorRenderFrame> delivered = new ArrayList<>();

        Runnable unsubscribe = runtime.subscribe(delivered::add);
        lane.runNext();
        lane.runNext();
        runtime.selectMap(2L);
        runtime.beginInlineLabelEdit(activeEdit("before-owner-run"));

        assertFalse(runtime.currentFrame().inlineLabelEditSession().active(),
                "caller methods must not mutate the cached frame before owner execution");
        assertEquals(2, lane.pending());

        lane.runNext();
        assertEquals(2L, runtime.currentFrame().preparedFacts().selectedMapIdValue());
        assertFalse(runtime.currentFrame().inlineLabelEditSession().active());
        assertTrue(repository.reads > 0, "map switch must exercise repository-backed readback on the owner lane");

        lane.runNext();
        assertTrue(runtime.currentFrame().inlineLabelEditSession().active());
        assertEquals("before-owner-run", runtime.currentFrame().inlineLabelEditSession().draftText());
        assertEquals(2L, runtime.currentFrame().preparedFacts().selectedMapIdValue());

        dispatcher.runAll();
        lane.runAll();
        int deliveredBeforeClose = delivered.size();
        unsubscribe.run();
        runtime.updateInlineLabelEditDraft("after-close");
        lane.runAll();

        assertEquals(deliveredBeforeClose, delivered.size(),
                "queued unsubscribe must close runtime delivery before later owner publications");
        assertEquals("after-close", runtime.currentFrame().inlineLabelEditSession().draftText());
    }

    @Test
    void unsubscribeBeforeQueuedRegistrationNeverOpensDelivery() {
        QueuedExecutionLane lane = new QueuedExecutionLane();
        QueuedUiDispatcher dispatcher = new QueuedUiDispatcher();
        InMemoryDungeonRepository repository = new InMemoryDungeonRepository();
        repository.seed(1L, "Only");
        DungeonEditorFeatureRuntimeRoot runtime = createRuntime(repository, lane, dispatcher);
        List<DungeonEditorRenderFrame> delivered = new ArrayList<>();

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
        List<DungeonEditorRenderFrame> delivered = new ArrayList<>();

        runtime.selectMap(1L);
        runtime.subscribe(delivered::add);
        lane.runAll();

        assertEquals(1, delivered.size());
        assertEquals(1L, delivered.getFirst().preparedFacts().selectedMapIdValue());
    }

    private static DungeonEditorFeatureRuntimeRoot createRuntime(
            DungeonMapRepository repository,
            QueuedExecutionLane lane,
            UiDispatcher dispatcher
    ) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                new InMemoryPartyRepository(), lane, dispatcher, (id, type) -> { });
        lane.runAll();
        DungeonTestAssembly.Component dungeon = DungeonTestAssembly.create(
                repository,
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                lane,
                dispatcher,
                (id, type) -> { });
        return DungeonEditorFeatureRuntimeRoot.create(new DungeonEditorRuntimeDependencies(
                new DungeonEditorRuntimeDependencies.CompatibilityReadbackModels(
                        dungeon.editorControls(), dungeon.editorMapSurface(), dungeon.editorState()),
                dungeon.editor(),
                lane,
                dispatcher));
    }

    private static DungeonEditorFeatureRuntimeRoot createRuntimeDirect(DungeonMapRepository repository) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                new InMemoryPartyRepository(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                (id, type) -> { });
        DungeonTestAssembly.Component dungeon = DungeonTestAssembly.create(
                repository,
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                (id, type) -> { });
        return DungeonEditorFeatureRuntimeRoot.create(new DungeonEditorRuntimeDependencies(
                new DungeonEditorRuntimeDependencies.CompatibilityReadbackModels(
                        dungeon.editorControls(), dungeon.editorMapSurface(), dungeon.editorState()),
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

    private static final class InMemoryDungeonRepository implements DungeonMapRepository {
        private final Map<Long, DungeonMap> maps = new LinkedHashMap<>();
        private int reads;

        void seed(long mapId, String name) {
            DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(mapId), name);
            maps.put(mapId, map);
        }

        @Override
        public DungeonMapIdentity nextMapId() {
            return new DungeonMapIdentity(maps.keySet().stream().mapToLong(Long::longValue).max().orElse(0L) + 1L);
        }

        @Override
        public long nextStairId() {
            return 1L;
        }

        @Override
        public long nextTransitionId() {
            return 1L;
        }

        @Override
        public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
            reads++;
            return Optional.ofNullable(maps.get(mapId.value()));
        }

        @Override
        public List<DungeonMap> searchByName(String query) {
            reads++;
            String safeQuery = query == null ? "" : query.toLowerCase(java.util.Locale.ROOT);
            return maps.values().stream()
                    .filter(map -> map.metadata().mapName().toLowerCase(java.util.Locale.ROOT).contains(safeQuery))
                    .toList();
        }

        @Override
        public Optional<DungeonMap> firstMap() {
            reads++;
            return maps.values().stream().findFirst();
        }

        @Override
        public DungeonMap save(DungeonMap dungeonMap) {
            maps.put(dungeonMap.metadata().mapId().value(), dungeonMap);
            return dungeonMap;
        }

        @Override
        public List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps) {
            for (DungeonMap dungeonMap : dungeonMaps) {
                save(dungeonMap);
            }
            return List.copyOf(dungeonMaps);
        }

        @Override
        public void delete(DungeonMapIdentity mapId) {
            maps.remove(mapId.value());
        }
    }
}

package features.worldplanner.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.worldplanner.WorldPlannerServiceAssembly;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import features.worldplanner.domain.world.WorldPlannerState;
import features.worldplanner.domain.world.port.WorldPlannerReferencePort;
import features.worldplanner.domain.world.repository.WorldPlannerRepository;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.CreateWorldNpcCommand;
import features.worldplanner.api.WorldPlannerReadStatus;

final class WorldPlannerRuntimeBoundaryTest {

    @Test
    void startupCommandsAndStableFailureStateRespectRuntimeBoundaries() {
        ControllableLane lane = new ControllableLane();
        QueuedUiDispatcher ui = new QueuedUiDispatcher();
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        RecordingRepository repository = new RecordingRepository();
        WorldPlannerServiceAssembly assembly = new WorldPlannerServiceAssembly(
                repository,
                new FailingCreatureReferences(),
                lane,
                ui,
                diagnostics);
        WorldPlannerApplicationService application = assembly.createApplicationService();
        var model = assembly.snapshotModel();
        List<WorldPlannerReadStatus> observed = new ArrayList<>();
        model.subscribe(snapshot -> observed.add(snapshot.status()));

        assertEquals(0, repository.loadCount, "assembly access does not load on the caller");
        assertEquals(1, lane.size(), "initial load is queued once");
        lane.runNext();
        assertEquals(1, repository.loadCount);
        assertEquals(List.of(), observed, "initial publication waits for UI dispatch");
        ui.runAll();
        assertEquals(List.of(WorldPlannerReadStatus.SUCCESS), observed);

        application.createLocation(new CreateWorldLocationCommand("Harbor", ""));
        assertEquals(0, repository.saveCount, "mutation does not load or save on the caller");
        lane.runNext();
        assertEquals(1, repository.saveCount);
        assertEquals(1, model.current().locations().size());

        application.createNpc(new CreateWorldNpcCommand("Blocked", 7L, "", "", "", ""));
        lane.runNext();
        assertEquals(1, repository.saveCount, "reference failure performs no write");
        assertEquals(WorldPlannerReadStatus.STORAGE_ERROR, model.current().status());
        assertEquals(1, model.current().locations().size(), "last stable state is preserved");
        assertEquals(List.of("worldplanner.reference.failure"), diagnostics.ids());
    }

    private static final class RecordingRepository implements WorldPlannerRepository {

        private WorldPlannerState state = WorldPlannerState.empty();
        private int loadCount;
        private int saveCount;

        @Override
        public WorldPlannerState load() {
            loadCount++;
            return state;
        }

        @Override
        public WorldPlannerState save(WorldPlannerState nextState) {
            saveCount++;
            state = nextState;
            return state;
        }
    }

    private static final class FailingCreatureReferences implements WorldPlannerReferencePort {

        @Override
        public boolean creatureStatblockExists(long creatureStatblockId) {
            throw new IllegalStateException("fixture payload must not reach diagnostics");
        }

        @Override
        public boolean encounterTableExists(long encounterTableId) {
            return true;
        }
    }

    private static final class ControllableLane implements ExecutionLane {

        private final List<Runnable> work = new ArrayList<>();

        @Override
        public void execute(Runnable task) {
            work.add(task);
        }

        int size() {
            return work.size();
        }

        void runNext() {
            work.removeFirst().run();
        }

        @Override
        public void close() {
        }
    }

    private static final class QueuedUiDispatcher implements UiDispatcher {

        private final List<Runnable> updates = new ArrayList<>();

        @Override
        public void dispatch(Runnable update) {
            updates.add(update);
        }

        void runAll() {
            List.copyOf(updates).forEach(Runnable::run);
            updates.clear();
        }
    }

    private static final class RecordingDiagnostics implements Diagnostics {

        private final List<String> ids = new ArrayList<>();

        @Override
        public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
            ids.add(id.value());
        }

        List<String> ids() {
            return List.copyOf(ids);
        }
    }
}

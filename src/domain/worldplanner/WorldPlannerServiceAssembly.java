package src.domain.worldplanner;

import java.util.Objects;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class WorldPlannerServiceAssembly {

    private static final String LOAD_FAILURE = "World Planner konnte nicht geladen werden.";
    private static final DiagnosticId LOAD_DIAGNOSTIC = new DiagnosticId("worldplanner.load.storage-failure");

    private final WorldPlannerRepository repository;
    private final WorldPlannerReferencePort referenceValidator;
    private final WorldPlannerSnapshotModel snapshotModel;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;
    private boolean initialSnapshotScheduled;

    public WorldPlannerServiceAssembly(
            WorldPlannerRepository repository,
            WorldPlannerReferencePort referenceValidator
    ) {
        this(
                repository,
                referenceValidator,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public WorldPlannerServiceAssembly(
            WorldPlannerRepository repository,
            WorldPlannerReferencePort referenceValidator,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.referenceValidator = Objects.requireNonNull(referenceValidator, "referenceValidator");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        snapshotModel = new WorldPlannerSnapshotModel(Objects.requireNonNull(uiDispatcher, "uiDispatcher"));
    }

    public WorldPlannerApplicationService createApplicationService() {
        scheduleInitialSnapshot();
        return new WorldPlannerApplicationService(
                repository,
                referenceValidator,
                snapshotModel,
                executionLane,
                diagnostics);
    }

    public WorldPlannerSnapshotModel snapshotModel() {
        scheduleInitialSnapshot();
        return snapshotModel;
    }

    private synchronized void scheduleInitialSnapshot() {
        if (initialSnapshotScheduled) {
            return;
        }
        initialSnapshotScheduled = true;
        executionLane.execute(this::publishInitialSnapshot);
    }

    private void publishInitialSnapshot() {
        try {
            snapshotModel.publish(WorldPlannerSnapshotProjection.from(repository.load()));
        } catch (IllegalStateException exception) {
            diagnostics.failure(LOAD_DIAGNOSTIC, exception.getClass());
            snapshotModel.publishStorageError(LOAD_FAILURE);
        }
    }
}

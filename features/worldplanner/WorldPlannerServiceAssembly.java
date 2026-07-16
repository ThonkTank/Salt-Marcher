package features.worldplanner;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import shell.api.InspectorSink;
import features.creatures.api.CreatureCatalogModel;
import features.creatures.api.CreatureReferenceApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableReferenceApi;
import features.worldplanner.adapter.javafx.WorldPlannerInspectorController;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;
import features.worldplanner.api.WorldPlannerApi;
import features.worldplanner.api.WorldPlannerEncounterSink;
import features.worldplanner.domain.world.port.WorldPlannerReferencePort;
import features.worldplanner.domain.world.repository.WorldPlannerRepository;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.worldplanner.application.WorldPlannerApplicationService;
import features.worldplanner.application.WorldPlannerPublishedState;
import features.worldplanner.application.WorldPlannerSnapshotProjection;

public final class WorldPlannerServiceAssembly {

    private static final String LOAD_FAILURE = "World Planner konnte nicht geladen werden.";
    private static final DiagnosticId LOAD_DIAGNOSTIC = new DiagnosticId("worldplanner.load.storage-failure");

    private final WorldPlannerRepository repository;
    private final WorldPlannerReferencePort referenceValidator;
    private final WorldPlannerPublishedState publishedState;
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

    public static Component create(
            SqliteDatabase database,
            CreatureReferenceApi creatures,
            EncounterTableReferenceApi encounterTables,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        WorldPlannerServiceAssembly assembly = new WorldPlannerServiceAssembly(
                new SqliteWorldPlannerRepository(Objects.requireNonNull(database, "database")),
                WorldPlannerReferenceAssembly.catalogReferences(creatures, encounterTables),
                executionLane,
                uiDispatcher,
                diagnostics);
        return new Component(assembly.createApplicationService(), assembly.snapshotModel());
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
        publishedState = new WorldPlannerPublishedState(Objects.requireNonNull(uiDispatcher, "uiDispatcher"));
    }

    public WorldPlannerApplicationService createApplicationService() {
        scheduleInitialSnapshot();
        return new WorldPlannerApplicationService(
                repository,
                referenceValidator,
                publishedState,
                executionLane,
                diagnostics);
    }

    public WorldPlannerSnapshotModel snapshotModel() {
        scheduleInitialSnapshot();
        return publishedState.snapshotModel();
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
            publishedState.publish(WorldPlannerSnapshotProjection.from(repository.load()));
        } catch (IllegalStateException exception) {
            diagnostics.failure(LOAD_DIAGNOSTIC, exception.getClass());
            publishedState.publishStorageError(LOAD_FAILURE);
        }
    }

    public static final class Component {

        private final WorldPlannerApplicationService application;
        private final WorldPlannerSnapshotModel snapshot;
        private @Nullable WorldPlannerInspectorController activeInspectorController;

        private Component(
                WorldPlannerApplicationService application,
                WorldPlannerSnapshotModel snapshot
        ) {
            this.application = Objects.requireNonNull(application, "application");
            this.snapshot = Objects.requireNonNull(snapshot, "snapshot");
        }

        public WorldPlannerApi application() {
            return application;
        }

        public WorldPlannerSnapshotModel snapshot() {
            return snapshot;
        }

        public void openNpcInspector(
                long npcId,
                WorldPlannerEncounterSink encounter,
                CreatureCatalogModel creatureCatalog,
                EncounterTableCatalogModel encounterTableCatalog,
                InspectorSink inspector
        ) {
            inspectorController(
                    application, encounter, snapshot, creatureCatalog, encounterTableCatalog, inspector)
                    .openNpcInspector(npcId);
        }

        public void openFactionInspector(
                long factionId,
                WorldPlannerEncounterSink encounter,
                CreatureCatalogModel creatureCatalog,
                EncounterTableCatalogModel encounterTableCatalog,
                InspectorSink inspector
        ) {
            inspectorController(
                    application, encounter, snapshot, creatureCatalog, encounterTableCatalog, inspector)
                    .openFactionInspector(factionId);
        }

        public void openLocationInspector(
                long locationId,
                WorldPlannerEncounterSink encounter,
                CreatureCatalogModel creatureCatalog,
                EncounterTableCatalogModel encounterTableCatalog,
                InspectorSink inspector
        ) {
            inspectorController(
                    application, encounter, snapshot, creatureCatalog, encounterTableCatalog, inspector)
                    .openLocationInspector(locationId);
        }

        public void openNpcCreator(
                WorldPlannerEncounterSink encounter,
                CreatureCatalogModel creatureCatalog,
                EncounterTableCatalogModel encounterTableCatalog,
                InspectorSink inspector
        ) {
            inspectorController(application, encounter, snapshot, creatureCatalog, encounterTableCatalog, inspector)
                    .openNpcCreator();
        }

        public void openFactionCreator(
                WorldPlannerEncounterSink encounter,
                CreatureCatalogModel creatureCatalog,
                EncounterTableCatalogModel encounterTableCatalog,
                InspectorSink inspector
        ) {
            inspectorController(application, encounter, snapshot, creatureCatalog, encounterTableCatalog, inspector)
                    .openFactionCreator();
        }

        public void openLocationCreator(
                WorldPlannerEncounterSink encounter,
                CreatureCatalogModel creatureCatalog,
                EncounterTableCatalogModel encounterTableCatalog,
                InspectorSink inspector
        ) {
            inspectorController(application, encounter, snapshot, creatureCatalog, encounterTableCatalog, inspector)
                    .openLocationCreator();
        }

        private synchronized WorldPlannerInspectorController inspectorController(
                WorldPlannerApi application,
                WorldPlannerEncounterSink encounter,
                WorldPlannerSnapshotModel snapshot,
                CreatureCatalogModel creatureCatalog,
                EncounterTableCatalogModel encounterTableCatalog,
                InspectorSink inspector
        ) {
            if (activeInspectorController != null && activeInspectorController.matches(
                    encounter, snapshot, creatureCatalog, encounterTableCatalog, inspector)) {
                return activeInspectorController;
            }
            if (activeInspectorController != null) {
                activeInspectorController.close();
            }
            activeInspectorController = new WorldPlannerInspectorController(
                    application, encounter, snapshot, creatureCatalog, encounterTableCatalog, inspector);
            return activeInspectorController;
        }
    }
}

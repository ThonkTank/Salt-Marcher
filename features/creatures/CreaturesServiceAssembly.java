package features.creatures;

import java.util.Objects;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.creatures.api.CreaturesApi;
import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.application.CreatureCatalogProjection;
import features.creatures.application.CreaturesApplicationService;
import features.creatures.application.CreaturesPublishedState;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.creatures.api.CreatureDetailModel;
import features.creatures.api.CreatureDetailResult;
import features.creatures.api.CreatureEncounterCandidatesModel;
import features.creatures.api.CreatureReferenceIndexModel;
import features.creatures.api.CreatureLookupStatus;
import features.creatures.api.CreatureReferenceApi;

public final class CreaturesServiceAssembly {

    private static final DiagnosticId REFERENCE_FAILURE = new DiagnosticId("creatures.reference.storage-failure");

    private CreaturesServiceAssembly() {
    }

    public static Component create(CreatureCatalogPort catalogPort) {
        return create(
                catalogPort,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public static Component create(
            SqliteDatabase database,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        return create(
                new SqliteCreatureCatalogQueryAdapter(Objects.requireNonNull(database, "database")),
                executionLane,
                uiDispatcher,
                diagnostics);
    }

    public static Component create(
            CreatureCatalogPort catalogPort,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        CreatureCatalogPort safeCatalogPort = Objects.requireNonNull(catalogPort, "catalogPort");
        ExecutionLane safeExecutionLane = Objects.requireNonNull(executionLane, "executionLane");
        UiDispatcher safeUiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        CreaturesPublishedState publishedState = new CreaturesPublishedState(safeUiDispatcher);
        CreatureReferenceIndexModel referenceIndex = publishedState.referenceIndexModel();
        CreatureDetailModel detail = publishedState.detailModel();
        CreatureEncounterCandidatesModel encounterCandidates = publishedState.encounterCandidatesModel();
        CreaturesApplicationService application = new CreaturesApplicationService(
                safeCatalogPort,
                publishedState,
                safeExecutionLane,
                safeDiagnostics);
        CreatureReferenceApi references = creatureId -> {
            if (creatureId <= 0L) {
                return new CreatureDetailResult(CreatureLookupStatus.NOT_FOUND, null);
            }
            try {
                var found = safeCatalogPort.loadCreatureDetail(creatureId);
                return new CreatureDetailResult(
                        found == null ? CreatureLookupStatus.NOT_FOUND : CreatureLookupStatus.SUCCESS,
                        CreatureCatalogProjection.creatureDetail(found));
            } catch (IllegalStateException exception) {
                safeDiagnostics.failure(REFERENCE_FAILURE, exception.getClass());
                return new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);
            }
        };
        return new Component(application, application, references, referenceIndex, detail, encounterCandidates);
    }

    public record Component(
            CreaturesApi application,
            CreatureCatalogQueryApi catalogQueries,
            CreatureReferenceApi references,
            CreatureReferenceIndexModel referenceIndex,
            CreatureDetailModel detail,
            CreatureEncounterCandidatesModel encounterCandidates
    ) {
        public void openInspector(shell.api.InspectorSink inspector, long creatureId) {
            features.creatures.adapter.javafx.details.CreatureDetailsView.openInspector(
                    inspector,
                    detail,
                    creatureId);
        }
    }
}

package src.domain.creatures;

import java.util.Objects;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureReferenceApi;

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
            CreatureCatalogPort catalogPort,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        CreatureCatalogPort safeCatalogPort = Objects.requireNonNull(catalogPort, "catalogPort");
        ExecutionLane safeExecutionLane = Objects.requireNonNull(executionLane, "executionLane");
        UiDispatcher safeUiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        CreatureFilterOptionsModel filterOptions = new CreatureFilterOptionsModel(safeUiDispatcher);
        CreatureCatalogModel catalog = new CreatureCatalogModel(safeUiDispatcher);
        CreatureDetailModel detail = new CreatureDetailModel(safeUiDispatcher);
        CreatureEncounterCandidatesModel encounterCandidates = new CreatureEncounterCandidatesModel(safeUiDispatcher);
        CreaturesApplicationService application = new CreaturesApplicationService(
                safeCatalogPort,
                filterOptions,
                catalog,
                detail,
                encounterCandidates,
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
        return new Component(application, references, filterOptions, catalog, detail, encounterCandidates);
    }

    public record Component(
            CreaturesApplicationService application,
            CreatureReferenceApi references,
            CreatureFilterOptionsModel filterOptions,
            CreatureCatalogModel catalog,
            CreatureDetailModel detail,
            CreatureEncounterCandidatesModel encounterCandidates
    ) {
    }
}

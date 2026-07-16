package src.domain.encountertable;

import java.util.Objects;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableReferenceApi;

public final class EncounterTableServiceAssembly {

    private static final DiagnosticId REFERENCE_FAILURE =
            new DiagnosticId("encountertable.reference.storage-failure");

    private EncounterTableServiceAssembly() {
    }

    public static Component create(EncounterTableCatalogPort catalogPort) {
        return create(
                catalogPort,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public static Component create(
            EncounterTableCatalogPort catalogPort,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        EncounterTableCatalogPort safeCatalogPort = Objects.requireNonNull(catalogPort, "catalogPort");
        ExecutionLane safeExecutionLane = Objects.requireNonNull(executionLane, "executionLane");
        UiDispatcher safeUiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        EncounterTableCatalogModel catalog = new EncounterTableCatalogModel(safeUiDispatcher);
        EncounterTableCandidatesModel candidates = new EncounterTableCandidatesModel(safeUiDispatcher);
        EncounterTableReferenceApi references = () -> {
            try {
                return new EncounterTableCatalogResult(
                        EncounterTableReadStatus.SUCCESS,
                        EncounterTableCatalogProjection.summaries(safeCatalogPort.loadSummaries()));
            } catch (IllegalStateException exception) {
                safeDiagnostics.failure(REFERENCE_FAILURE, exception.getClass());
                return new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, java.util.List.of());
            }
        };
        return new Component(
                new EncounterTableApplicationService(
                        safeCatalogPort,
                        catalog,
                        candidates,
                        safeExecutionLane,
                        safeDiagnostics),
                references,
                catalog,
                candidates);
    }

    public record Component(
            EncounterTableApplicationService application,
            EncounterTableReferenceApi references,
            EncounterTableCatalogModel catalog,
            EncounterTableCandidatesModel candidates
    ) {
    }
}

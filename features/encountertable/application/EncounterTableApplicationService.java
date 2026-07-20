package features.encountertable.application;

import java.util.List;
import java.util.Objects;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;
import features.encountertable.api.EncounterTableCandidatesResult;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.RefreshEncounterTableCatalogCommand;
import features.encountertable.api.RefreshEncounterTableCandidatesCommand;

public final class EncounterTableApplicationService implements features.encountertable.api.EncounterTableApi {

    private static final DiagnosticId CATALOG_FAILURE =
            new DiagnosticId("encountertable.catalog.storage-failure");
    private static final DiagnosticId CANDIDATES_FAILURE =
            new DiagnosticId("encountertable.candidates.storage-failure");

    private final EncounterTableCatalogPort catalog;
    private final EncounterTablePublishedState publishedState;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;

    public EncounterTableApplicationService(
            EncounterTableCatalogPort catalog,
            EncounterTablePublishedState publishedState
    ) {
        this(
                catalog,
                publishedState,
                DirectExecutionLane.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    public EncounterTableApplicationService(
            EncounterTableCatalogPort catalog,
            EncounterTablePublishedState publishedState,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public void refreshCatalog(RefreshEncounterTableCatalogCommand command) {
        Objects.requireNonNull(command, "command");
        executionLane.execute(this::refreshCatalogInLane);
    }

    private void refreshCatalogInLane() {
        try {
            publishedState.publishCatalog(new EncounterTableCatalogResult(
                    EncounterTableReadStatus.SUCCESS,
                    EncounterTableCatalogProjection.summaries(catalog.loadSummaries())));
        } catch (IllegalStateException exception) {
            diagnostics.failure(CATALOG_FAILURE, exception.getClass());
            publishedState.publishCatalog(
                    new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of()));
        }
    }

    public void refreshCandidates(RefreshEncounterTableCandidatesCommand command) {
        executionLane.execute(() -> refreshCandidatesInLane(command));
    }

    private void refreshCandidatesInLane(RefreshEncounterTableCandidatesCommand command) {
        try {
            if (command == null) {
                publishStorageError();
                return;
            }
            publishedState.publishCandidates(new EncounterTableCandidatesResult(
                    EncounterTableReadStatus.SUCCESS,
                    EncounterTableCatalogProjection.candidates(catalog.loadGenerationCandidates(
                            command.tableIds(),
                            normalizedMaximumXp(command.maximumXp())))));
        } catch (IllegalStateException exception) {
            diagnostics.failure(CANDIDATES_FAILURE, exception.getClass());
            publishStorageError();
        }
    }

    private void publishStorageError() {
        publishedState.publishCandidates(
                new EncounterTableCandidatesResult(EncounterTableReadStatus.STORAGE_ERROR, List.of()));
    }

    private static int normalizedMaximumXp(int maximumXp) {
        return maximumXp <= 0 ? Integer.MAX_VALUE : maximumXp;
    }
}

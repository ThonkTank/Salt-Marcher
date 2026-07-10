package src.domain.encountertable;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.encountertable.published.EncounterTableCandidatesResult;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;
import src.domain.encountertable.published.RefreshEncounterTableCandidatesCommand;

public final class EncounterTableApplicationService {

    private final EncounterTableCatalogPort catalog;
    private final EncounterTableCatalogModel catalogModel;
    private final EncounterTableCandidatesModel candidatesModel;

    public EncounterTableApplicationService(
            EncounterTableCatalogPort catalog,
            EncounterTableCatalogModel catalogModel,
            EncounterTableCandidatesModel candidatesModel
    ) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.catalogModel = Objects.requireNonNull(catalogModel, "catalogModel");
        this.candidatesModel = Objects.requireNonNull(candidatesModel, "candidatesModel");
    }

    public void refreshCatalog(RefreshEncounterTableCatalogCommand command) {
        Objects.requireNonNull(command, "command");
        try {
            catalogModel.publish(new EncounterTableCatalogResult(
                    EncounterTableReadStatus.SUCCESS,
                    EncounterTableCatalogProjection.summaries(catalog.loadSummaries())));
        } catch (IllegalStateException exception) {
            catalogModel.publish(new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of()));
        }
    }

    public void refreshCandidates(RefreshEncounterTableCandidatesCommand command) {
        try {
            if (command == null) {
                publishStorageError();
                return;
            }
            candidatesModel.publish(new EncounterTableCandidatesResult(
                    EncounterTableReadStatus.SUCCESS,
                    EncounterTableCatalogProjection.candidates(catalog.loadGenerationCandidates(
                            command.tableIds(),
                            normalizedMaximumXp(command.maximumXp())))));
        } catch (IllegalStateException exception) {
            publishStorageError();
        }
    }

    private void publishStorageError() {
        candidatesModel.publish(new EncounterTableCandidatesResult(EncounterTableReadStatus.STORAGE_ERROR, List.of()));
    }

    private static int normalizedMaximumXp(int maximumXp) {
        return maximumXp <= 0 ? Integer.MAX_VALUE : maximumXp;
    }
}

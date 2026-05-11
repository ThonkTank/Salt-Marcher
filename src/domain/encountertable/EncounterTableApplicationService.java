package src.domain.encountertable;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.application.LoadEncounterTableSummariesUseCase;
import src.domain.encountertable.model.catalog.model.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.repository.EncounterTableCatalogRepository;
import src.domain.encountertable.model.catalog.repository.EncounterTablePublishedStateRepository;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;

@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterTableApplicationService {

    private final LoadEncounterTableSummariesUseCase loadSummariesUseCase;
    private final EncounterTablePublishedStateRepository publishedStateRepository;

    public EncounterTableApplicationService(
            EncounterTableCatalogRepository catalog,
            EncounterTablePublishedStateRepository publishedStateRepository
    ) {
        EncounterTableCatalogRepository safeCatalog = Objects.requireNonNull(catalog, "catalog");
        this.loadSummariesUseCase = new LoadEncounterTableSummariesUseCase(safeCatalog);
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void refreshCatalog(RefreshEncounterTableCatalogCommand command) {
        Objects.requireNonNull(command, "command");
        try {
            publishedStateRepository.publishCatalog(new EncounterTableCatalogResult(
                    EncounterTableReadStatus.SUCCESS,
                    toPublishedSummaries(loadSummariesUseCase.execute())));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCatalog(new EncounterTableCatalogResult(
                    EncounterTableReadStatus.STORAGE_ERROR,
                    List.of()));
        }
    }

    private static List<EncounterTableSummary> toPublishedSummaries(List<EncounterTableSummaryData> summaries) {
        return summaries.stream()
                .map(summary -> new EncounterTableSummary(
                        summary.tableId(),
                        summary.name(),
                        summary.linkedLootTableId()))
                .toList();
    }
}

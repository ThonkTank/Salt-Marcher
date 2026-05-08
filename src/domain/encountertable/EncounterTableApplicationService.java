package src.domain.encountertable;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.application.LoadEncounterTableSummariesUseCase;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.catalog.value.EncounterTableSummaryData;
import src.domain.encountertable.published.EncounterTableSummary;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;
import src.domain.encountertable.runtime.port.EncounterTablePublishedStateRepository;

@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterTableApplicationService {

    private final LoadEncounterTableSummariesUseCase loadSummariesUseCase;
    private final EncounterTablePublishedStateRepository publishedStateRepository;

    public EncounterTableApplicationService(
            EncounterTableCatalog catalog,
            EncounterTablePublishedStateRepository publishedStateRepository
    ) {
        EncounterTableCatalog safeCatalog = Objects.requireNonNull(catalog, "catalog");
        this.loadSummariesUseCase = new LoadEncounterTableSummariesUseCase(safeCatalog);
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void refreshCatalog(RefreshEncounterTableCatalogCommand command) {
        Objects.requireNonNull(command, "command");
        try {
            publishedStateRepository.publishCatalog(new EncounterTablePublishedStateRepository.CatalogPublication(
                    EncounterTablePublishedStateRepository.CatalogStatus.SUCCESS,
                    loadSummariesUseCase.execute()));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCatalog(new EncounterTablePublishedStateRepository.CatalogPublication(
                    EncounterTablePublishedStateRepository.CatalogStatus.STORAGE_ERROR,
                    List.of()));
        }
    }
}

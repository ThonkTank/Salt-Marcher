package src.domain.encountertable;

import java.util.Objects;
import src.domain.encountertable.application.LoadEncounterTableSummariesUseCase;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.model.catalog.repository.EncounterTablePublishedStateRepository;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;

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
                    EncounterTablePublishedStateRepository.SUCCESS,
                    loadSummariesUseCase.execute()));
        } catch (RuntimeException exception) {
            publishedStateRepository.publishCatalog(new EncounterTablePublishedStateRepository.CatalogPublication(
                    EncounterTablePublishedStateRepository.STORAGE_ERROR,
                    java.util.List.of()));
        }
    }
}

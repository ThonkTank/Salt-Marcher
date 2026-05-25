package src.domain.encountertable.model.catalog.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.model.catalog.repository.EncounterTablePublishedStateRepository;

public final class LoadEncounterTableSummariesUseCase {

    private final EncounterTableCatalogPort catalog;
    private final EncounterTablePublishedStateRepository publishedStateRepository;

    public LoadEncounterTableSummariesUseCase(
            EncounterTableCatalogPort catalog,
            EncounterTablePublishedStateRepository publishedStateRepository
    ) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute() {
        try {
            publishedStateRepository.publishCatalog(new EncounterTablePublishedStateRepository.CatalogPublication(
                    EncounterTablePublishedStateRepository.SUCCESS,
                    catalog.loadSummaries()));
        } catch (IllegalStateException exception) {
            publishedStateRepository.publishCatalog(new EncounterTablePublishedStateRepository.CatalogPublication(
                    EncounterTablePublishedStateRepository.STORAGE_ERROR,
                    List.of()));
        }
    }
}

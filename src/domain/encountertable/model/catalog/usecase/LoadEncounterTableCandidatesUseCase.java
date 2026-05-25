package src.domain.encountertable.model.catalog.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.model.catalog.repository.EncounterTablePublishedStateRepository;

public final class LoadEncounterTableCandidatesUseCase {

    private final EncounterTableCatalogPort catalog;
    private final EncounterTablePublishedStateRepository publishedStateRepository;

    public LoadEncounterTableCandidatesUseCase(
            EncounterTableCatalogPort catalog,
            EncounterTablePublishedStateRepository publishedStateRepository
    ) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(boolean commandPresent, List<Long> tableIds, int maximumXp) {
        try {
            if (!commandPresent) {
                publishStorageError();
                return;
            }
            publishedStateRepository.publishCandidates(new EncounterTablePublishedStateRepository.CandidatesPublication(
                    EncounterTablePublishedStateRepository.SUCCESS,
                    catalog.loadGenerationCandidates(tableIds, normalizedMaximumXp(maximumXp))));
        } catch (IllegalStateException exception) {
            publishStorageError();
        }
    }

    private void publishStorageError() {
        publishedStateRepository.publishCandidates(new EncounterTablePublishedStateRepository.CandidatesPublication(
                EncounterTablePublishedStateRepository.STORAGE_ERROR,
                List.of()));
    }

    private static int normalizedMaximumXp(int maximumXp) {
        return maximumXp <= 0 ? Integer.MAX_VALUE : maximumXp;
    }
}

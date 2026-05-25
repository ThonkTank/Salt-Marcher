package src.domain.creatures.model.catalog.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.CreatureProfile;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;

public final class LoadCreatureDetailUseCase {

    private final CreatureCatalogPort lookup;
    private final CreaturesPublishedStateRepository publishedStateRepository;

    public LoadCreatureDetailUseCase(
            CreatureCatalogPort lookup,
            CreaturesPublishedStateRepository publishedStateRepository
    ) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(long creatureId) {
        try {
            if (creatureId <= 0) {
                publish(CreaturesPublishedStateRepository.NOT_FOUND, null);
                return;
            }
            CreatureProfile detail = lookup.loadCreatureDetail(creatureId);
            publish(
                    detail == null
                            ? CreaturesPublishedStateRepository.NOT_FOUND
                            : CreaturesPublishedStateRepository.SUCCESS,
                    detail);
        } catch (IllegalStateException exception) {
            publish(CreaturesPublishedStateRepository.STORAGE_ERROR, null);
        }
    }

    private void publish(String status, @Nullable CreatureProfile detail) {
        publishedStateRepository.publishCreatureDetail(
                new CreaturesPublishedStateRepository.CreatureDetailPublication(status, detail));
    }
}

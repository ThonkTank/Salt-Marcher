package src.domain.creatures.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.repository.CreatureCatalogRepository;

import java.util.Objects;

final class LoadCreatureDetailUseCase {

    private final CreatureCatalogRepository repository;

    LoadCreatureDetailUseCase(CreatureCatalogRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    @Nullable CreatureDetail execute(long creatureId) {
        if (creatureId <= 0) {
            return null;
        }
        return repository.loadCreatureDetail(creatureId);
    }
}

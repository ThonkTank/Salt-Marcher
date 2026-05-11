package src.domain.creatures.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.repository.CreatureCatalogRepository;
import src.domain.creatures.model.catalog.repository.CreatureCatalogRepository.CreatureProfile;

import java.util.Objects;

public final class LoadCreatureDetailUseCase {

    private final CreatureCatalogRepository lookup;

    public LoadCreatureDetailUseCase(CreatureCatalogRepository lookup) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
    }

    public @Nullable CreatureProfile execute(long creatureId) {
        if (creatureId <= 0) {
            return null;
        }
        return lookup.loadCreatureDetail(creatureId);
    }
}

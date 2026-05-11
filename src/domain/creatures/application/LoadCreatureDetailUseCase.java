package src.domain.creatures.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.CreatureProfile;

import java.util.Objects;

public final class LoadCreatureDetailUseCase {

    private final CreatureCatalogPort lookup;

    public LoadCreatureDetailUseCase(CreatureCatalogPort lookup) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
    }

    public @Nullable CreatureProfile execute(long creatureId) {
        if (creatureId <= 0) {
            return null;
        }
        return lookup.loadCreatureDetail(creatureId);
    }
}

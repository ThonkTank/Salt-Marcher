package src.domain.creatures.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.catalog.port.CreatureCatalogLookup.CreatureProfile;

import java.util.Objects;

public final class LoadCreatureDetailUseCase {

    private final CreatureCatalogLookup queryPort;

    public LoadCreatureDetailUseCase(CreatureCatalogLookup queryPort) {
        this.queryPort = Objects.requireNonNull(queryPort, "queryPort");
    }

    public @Nullable CreatureProfile execute(long creatureId) {
        if (creatureId <= 0) {
            return null;
        }
        return queryPort.loadCreatureDetail(creatureId);
    }
}

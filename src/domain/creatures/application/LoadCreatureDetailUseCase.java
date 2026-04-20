package src.domain.creatures.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

import java.util.Objects;

final class LoadCreatureDetailUseCase {

    private final CreatureCatalogQueryPort queryPort;

    LoadCreatureDetailUseCase(CreatureCatalogQueryPort queryPort) {
        this.queryPort = Objects.requireNonNull(queryPort, "queryPort");
    }

    @Nullable CreatureDetail execute(long creatureId) {
        if (creatureId <= 0) {
            return null;
        }
        return queryPort.loadCreatureDetail(creatureId);
    }
}

package src.domain.creatures.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.catalog.repository.CreatureCatalogRepository;

import java.util.Objects;

final class LoadCreatureDetailUseCase {

    private final CreatureCatalogRepository queryPort;

    LoadCreatureDetailUseCase(CreatureCatalogRepository queryPort) {
        this.queryPort = Objects.requireNonNull(queryPort, "queryPort");
    }

    @Nullable CreatureDetail execute(long creatureId) {
        if (creatureId <= 0) {
            return null;
        }
        return queryPort.loadCreatureDetail(creatureId);
    }
}

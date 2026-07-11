package src.domain.dungeon;

import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;

final class DungeonTravelPartyPositionServiceAssembly {

    TravelPartyPositionRepository repository(ServiceRegistry registry) {
        return DungeonTravelPartyGateway.from(Objects.requireNonNull(registry, "registry"));
    }
}

package src.data.dungeon;

import shell.api.ServiceRegistry;
import src.data.dungeon.repository.ApplicationTravelDungeonSessionRepository;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.DungeonTravelApplicationService;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;

final class DungeonServiceAssembly {

    void register(ServiceRegistry.Builder services) {
        services.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
        services.registerFactory(
                TravelDungeonSessionRepository.class,
                this::travelDungeonSessionRepository);
    }

    private TravelDungeonSessionRepository travelDungeonSessionRepository(ServiceRegistry registry) {
        return new ApplicationTravelDungeonSessionRepository(
                registry.require(PartyApplicationService.class),
                registry.require(ActivePartyModel.class),
                registry.require(PartyTravelPositionsModel.class),
                registry.require(PartyMutationModel.class),
                registry.require(DungeonTravelApplicationService.class),
                registry.require(DungeonTravelModel.class));
    }
}

package src.data.dungeon;

import shell.api.ServiceRegistry;
import src.data.dungeon.repository.ApplicationTravelPartyPositionRepository;
import src.data.dungeon.repository.ApplicationTravelPartyStateRepository;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;

final class DungeonServiceAssembly {

    void register(ServiceRegistry.Builder services) {
        services.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
        services.registerFactory(
                TravelPartyStateRepository.class,
                this::travelPartyStateRepository);
        services.registerFactory(
                TravelPartyPositionRepository.class,
                this::travelPartyPositionRepository);
    }

    private TravelPartyStateRepository travelPartyStateRepository(ServiceRegistry registry) {
        return new ApplicationTravelPartyStateRepository(
                registry.require(ActivePartyModel.class),
                registry.require(PartyTravelPositionsModel.class));
    }

    private TravelPartyPositionRepository travelPartyPositionRepository(ServiceRegistry registry) {
        return new ApplicationTravelPartyPositionRepository(
                registry.require(PartyApplicationService.class),
                registry.require(PartyMutationModel.class));
    }
}

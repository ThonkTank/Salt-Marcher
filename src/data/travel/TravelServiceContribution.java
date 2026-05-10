package src.data.travel;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.travel.repository.ApplicationTravelPartyStateRepository;
import src.domain.dungeon.DungeonTravelApplicationService;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.travel.TravelApplicationService;

public final class TravelServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public TravelServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.registerFactory(
                TravelApplicationService.class,
                services -> new TravelApplicationService(
                        new ApplicationTravelPartyStateRepository(
                                services.require(PartyApplicationService.class),
                                services.require(ActivePartyModel.class),
                                services.require(PartyTravelPositionsModel.class),
                                services.require(PartyMutationModel.class)),
                        services.require(DungeonTravelApplicationService.class),
                        services.require(DungeonTravelModel.class)));
    }
}

package src.data.travel;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.travel.repository.ApplicationTravelDungeonSessionRepository;
import src.data.travel.repository.ApplicationTravelPartyStateRepository;
import src.domain.dungeon.DungeonTravelApplicationService;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;

public final class TravelServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public TravelServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.registerFactory(
                DungeonTravelRuntimeApplicationService.class,
                services -> {
                    ApplicationTravelPartyStateRepository partyStateRepository =
                            new ApplicationTravelPartyStateRepository(
                                    services.require(PartyApplicationService.class),
                                    services.require(ActivePartyModel.class),
                                    services.require(PartyTravelPositionsModel.class),
                                    services.require(PartyMutationModel.class));
                    ApplicationTravelDungeonSessionRepository dungeonSessionRepository =
                            new ApplicationTravelDungeonSessionRepository(
                                    partyStateRepository,
                                    services.require(DungeonTravelApplicationService.class),
                                    services.require(DungeonTravelModel.class));
                    return new DungeonTravelRuntimeApplicationService(
                            new ApplyTravelDungeonSessionUseCase(dungeonSessionRepository));
                });
    }
}

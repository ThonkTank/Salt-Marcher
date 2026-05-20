package src.data.travel;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.travel.repository.ApplicationTravelDungeonSessionRepository;
import src.data.travel.repository.ApplicationTravelPartyStateRepository;
import src.domain.dungeon.DungeonTravelApplicationService;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;

public final class TravelServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public TravelServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        services.registerFactory(
                DungeonTravelRuntimeApplicationService.class,
                registry -> new DungeonTravelRuntimeApplicationService(new ApplyTravelDungeonSessionUseCase(
                        new ApplicationTravelDungeonSessionRepository(
                                partyStateRepository(registry),
                                registry.require(DungeonTravelApplicationService.class),
                                registry.require(DungeonTravelModel.class)))));
    }

    private static ApplicationTravelPartyStateRepository partyStateRepository(ServiceRegistry registry) {
        return new ApplicationTravelPartyStateRepository(
                registry.require(PartyApplicationService.class),
                registry.require(ActivePartyModel.class),
                registry.require(PartyTravelPositionsModel.class),
                registry.require(PartyMutationModel.class));
    }
}

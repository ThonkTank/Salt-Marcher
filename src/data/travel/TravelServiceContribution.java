package src.data.travel;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.party.PartyApplicationService;
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
                        services.require(PartyApplicationService.class),
                        services.require(DungeonApplicationService.class)));
    }
}

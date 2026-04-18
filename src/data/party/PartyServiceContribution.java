package src.data.party;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.party.gateway.local.SqlitePartyLocalGateway;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.domain.party.PartyApplicationService;
import src.domain.party.repository.PartyRosterRepository;

/**
 * Root service entrypoint for the party feature.
 */
public final class PartyServiceContribution implements ServiceContribution {

    public PartyServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        PartyRosterRepository repository = new SqlitePartyRosterRepository(new SqlitePartyLocalGateway());
        PartyApplicationService service = new PartyApplicationService(repository);
        builder.register(
                PartyRosterRepository.class,
                repository);
        builder.register(
                PartyApplicationService.class,
                service);
        builder.register(
                PartyApplicationService.Factory.class,
                () -> service);
    }
}

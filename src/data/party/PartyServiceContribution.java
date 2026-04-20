package src.data.party;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.domain.party.PartyApplicationService;
import src.domain.party.roster.port.PartyRosterRepository;

/**
 * Root service entrypoint for the party feature.
 */
public final class PartyServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public PartyServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        PartyRosterRepository repository = new SqlitePartyRosterRepository();
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

package src.data.party;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;

/**
 * Source-adapter service entrypoint for the party feature.
 */
public final class PartyServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.register(PartyRosterRepository.class, new SqlitePartyRosterRepository());
    }
}

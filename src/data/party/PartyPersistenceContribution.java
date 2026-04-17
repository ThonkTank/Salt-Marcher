package src.data.party;

import shell.host.PersistenceContribution;
import shell.host.PersistenceRegistry;
import src.data.party.datasource.local.SqlitePartyLocalDataSource;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.domain.party.repository.PartyRosterRepository;

/**
 * Root persistence entrypoint for the party feature.
 */
public final class PartyPersistenceContribution implements PersistenceContribution {

    @Override
    public void register(PersistenceRegistry.Builder builder) {
        builder.register(
                PartyRosterRepository.class,
                new SqlitePartyRosterRepository(new SqlitePartyLocalDataSource()));
    }
}

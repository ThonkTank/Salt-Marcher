package src.data.party.repository;

import shell.host.RuntimeServiceProvider;
import shell.host.RuntimeServiceRegistry;
import src.data.party.datasource.local.SqlitePartyLocalDataSource;
import src.domain.party.repository.PartyRosterRepository;

public final class PartyRuntimeServiceProvider implements RuntimeServiceProvider {

    @Override
    public void register(RuntimeServiceRegistry.Builder builder) {
        builder.register(
                PartyRosterRepository.class,
                new SqlitePartyRosterRepository(new SqlitePartyLocalDataSource()));
    }
}

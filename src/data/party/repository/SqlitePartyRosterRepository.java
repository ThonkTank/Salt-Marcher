package src.data.party.repository;

import src.data.party.datasource.local.SqlitePartyLocalDataSource;
import src.data.party.mapper.PartyRosterMapper;
import src.domain.party.entity.PartyRoster;
import src.domain.party.repository.PartyRosterRepository;

import java.util.Objects;

public final class SqlitePartyRosterRepository implements PartyRosterRepository {

    private final SqlitePartyLocalDataSource dataSource;

    public SqlitePartyRosterRepository(SqlitePartyLocalDataSource dataSource) {
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
    }

    @Override
    public PartyRoster load() {
        return PartyRosterMapper.toDomain(dataSource.load());
    }

    @Override
    public void save(PartyRoster roster) {
        dataSource.save(PartyRosterMapper.toRecord(roster));
    }
}

package src.data.party.repository;

import src.data.party.datasource.local.InMemoryPartyRosterDataSource;
import src.data.party.mapper.PartyRosterMapper;
import src.domain.party.entity.PartyRoster;
import src.domain.party.repository.PartyRosterRepository;

import java.util.Objects;

public final class InMemoryPartyRosterRepository implements PartyRosterRepository {

    private final InMemoryPartyRosterDataSource dataSource;

    public InMemoryPartyRosterRepository(InMemoryPartyRosterDataSource dataSource) {
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

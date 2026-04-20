package src.domain.party.roster.repository;

import src.domain.party.roster.aggregate.PartyRoster;

public interface PartyRosterRepository {

    PartyRoster load();

    void save(PartyRoster roster);
}

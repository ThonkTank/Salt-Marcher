package features.party.domain.roster.repository;

import features.party.domain.roster.PartyRoster;

public interface PartyRosterRepository {

    PartyRoster load();

    void save(PartyRoster roster);
}

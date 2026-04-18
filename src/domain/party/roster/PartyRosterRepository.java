package src.domain.party.roster;

import src.domain.party.roster.PartyRoster;

public interface PartyRosterRepository {

    PartyRoster load();

    void save(PartyRoster roster);
}

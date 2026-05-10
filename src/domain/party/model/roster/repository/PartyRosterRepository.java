package src.domain.party.model.roster.repository;

import src.domain.party.model.roster.model.PartyRoster;

public interface PartyRosterRepository {

    PartyRoster load();

    void save(PartyRoster roster);
}

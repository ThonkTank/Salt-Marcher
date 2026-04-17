package src.domain.party.repository;

import src.domain.party.entity.PartyRoster;

public interface PartyRosterRepository {

    PartyRoster load();

    void save(PartyRoster roster);
}

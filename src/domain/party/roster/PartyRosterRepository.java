package src.domain.party.roster;

public interface PartyRosterRepository {

    PartyRoster load();

    void save(PartyRoster roster);
}

package src.domain.party.usecase;

import src.domain.party.entity.PartyRoster;
import src.domain.party.repository.PartyRosterRepository;

public final class PartyRosterStore implements PartyRosterRepository {

    private PartyRoster roster;

    private PartyRosterStore(PartyRoster roster) {
        this.roster = roster;
    }

    public static PartyRosterStore empty() {
        return new PartyRosterStore(PartyRoster.empty());
    }

    @Override
    public PartyRoster load() {
        return roster;
    }

    @Override
    public void save(PartyRoster roster) {
        this.roster = roster == null ? PartyRoster.empty() : roster;
    }
}

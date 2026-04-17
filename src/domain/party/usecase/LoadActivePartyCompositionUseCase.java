package src.domain.party.usecase;

import src.domain.party.partyAPI;
import src.domain.party.entity.PartyRoster;
import src.domain.party.repository.PartyRosterRepository;

public final class LoadActivePartyCompositionUseCase {

    private final PartyRosterRepository repository;

    public LoadActivePartyCompositionUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public partyAPI.ActivePartyComposition execute() {
        PartyRoster roster = repository.load();
        return new partyAPI.ActivePartyComposition(
                roster.activeLevelsByComposition(),
                roster.averageActiveLevel());
    }
}

package src.domain.party.usecase;

import src.domain.party.partyAPI;
import src.domain.party.entity.PartyRosterProjection;
import src.domain.party.repository.PartyRosterRepository;

public final class LoadActivePartyCompositionUseCase {

    private final PartyRosterRepository repository;

    public LoadActivePartyCompositionUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public partyAPI.ActivePartyComposition execute() {
        PartyRosterProjection roster = repository.load().projection();
        return new partyAPI.ActivePartyComposition(
                roster.activeLevelsByComposition(),
                roster.averageActiveLevel());
    }
}

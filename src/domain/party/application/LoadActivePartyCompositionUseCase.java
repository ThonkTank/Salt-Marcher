package src.domain.party.application;

import src.domain.party.api.ActivePartyComposition;
import src.domain.party.entity.PartyRosterProjection;
import src.domain.party.repository.PartyRosterRepository;

public final class LoadActivePartyCompositionUseCase {

    private final PartyRosterRepository repository;

    public LoadActivePartyCompositionUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public ActivePartyComposition execute() {
        PartyRosterProjection roster = repository.load().projection();
        return new ActivePartyComposition(
                roster.activeLevelsByComposition(),
                roster.averageActiveLevel());
    }
}

package src.domain.party.model.roster.usecase;

import src.domain.party.model.roster.PartyCharacter;
import src.domain.party.model.roster.repository.PartyRosterRepository;

import java.util.List;

public final class LoadActivePartyUseCase {

    private final PartyRosterRepository repository;

    public LoadActivePartyUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public List<PartyCharacter> execute() {
        return repository.load().projection().activeMembers();
    }
}

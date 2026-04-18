package src.domain.party.application;

import src.domain.party.entity.PartyCharacter;
import src.domain.party.repository.PartyRosterRepository;

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

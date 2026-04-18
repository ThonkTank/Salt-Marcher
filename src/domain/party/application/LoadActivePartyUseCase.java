package src.domain.party.application;

import src.domain.party.roster.PartyCharacter;
import src.domain.party.roster.PartyRosterRepository;

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

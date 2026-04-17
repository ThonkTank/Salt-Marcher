package src.domain.party.usecase;

import src.domain.party.entity.PartyRoster;
import src.domain.party.partyAPI;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyMutationStatus;

public final class CreateCharacterUseCase {

    private final PartyRosterRepository repository;

    public CreateCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(partyAPI.CharacterDraft draft, PartyMembership membership) {
        PartyRoster.MutationResult mutation = repository.load().createCharacter(draft, membership);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

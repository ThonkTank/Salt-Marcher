package src.domain.party.application;

import src.domain.party.api.CharacterDraft;
import src.domain.party.roster.PartyRoster;
import src.domain.party.roster.PartyRosterRepository;
import src.domain.party.roster.PartyMembership;
import src.domain.party.roster.PartyMutationStatus;

public final class CreateCharacterUseCase {

    private final PartyRosterRepository repository;

    public CreateCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(CharacterDraft draft, PartyMembership membership) {
        PartyRoster.MutationResult mutation = repository.load().createCharacter(draft, membership);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

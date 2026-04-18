package src.domain.party.application;

import src.domain.party.api.CharacterDraft;
import src.domain.party.roster.PartyRoster;
import src.domain.party.roster.PartyRosterRepository;
import src.domain.party.roster.PartyMutationStatus;

public final class UpdateCharacterUseCase {

    private final PartyRosterRepository repository;

    public UpdateCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(long id, CharacterDraft draft) {
        PartyRoster.MutationResult mutation = repository.load().updateCharacter(id, draft);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

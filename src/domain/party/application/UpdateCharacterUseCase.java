package src.domain.party.application;

import src.domain.party.published.CharacterDraft;
import src.domain.party.published.MutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class UpdateCharacterUseCase {

    private final PartyRosterRepository repository;

    public UpdateCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public MutationStatus execute(long id, CharacterDraft draft) {
        PartyRoster.MutationResult mutation = repository.load().updateCharacter(id, draft);
        if (mutation.status() == MutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

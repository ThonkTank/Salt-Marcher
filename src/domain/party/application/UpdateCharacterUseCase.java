package src.domain.party.application;

import src.domain.party.model.roster.model.PartyCharacterDraft;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class UpdateCharacterUseCase {

    private final PartyRosterRepository repository;

    public UpdateCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(long id, PartyCharacterDraft draft) {
        PartyRoster.MutationResult mutation = repository.load().updateCharacter(id, draft);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

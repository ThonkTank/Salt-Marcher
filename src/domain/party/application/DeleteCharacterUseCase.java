package src.domain.party.application;

import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class DeleteCharacterUseCase {

    private final PartyRosterRepository repository;

    public DeleteCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(long id) {
        PartyRoster.MutationResult mutation = repository.load().deleteCharacter(id);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

package src.domain.party.usecase;

import src.domain.party.entity.PartyRoster;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.valueobject.PartyMutationStatus;

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

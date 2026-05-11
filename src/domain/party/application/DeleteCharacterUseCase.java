package src.domain.party.application;

import src.domain.party.published.MutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class DeleteCharacterUseCase {

    private final PartyRosterRepository repository;

    public DeleteCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public MutationStatus execute(long id) {
        PartyRoster.MutationResult mutation = repository.load().deleteCharacter(id);
        if (mutation.status() == MutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

package src.domain.party.application;

import src.domain.party.roster.aggregate.PartyRoster;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyMutationStatus;

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

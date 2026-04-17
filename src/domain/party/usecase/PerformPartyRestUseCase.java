package src.domain.party.usecase;

import src.domain.party.entity.PartyRoster;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.valueobject.PartyMutationStatus;
import src.domain.party.valueobject.PartyRestType;

public final class PerformPartyRestUseCase {

    private final PartyRosterRepository repository;

    public PerformPartyRestUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(PartyRestType restType) {
        PartyRoster.MutationResult mutation = repository.load().performRest(restType);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

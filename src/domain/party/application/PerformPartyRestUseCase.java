package src.domain.party.application;

import src.domain.party.roster.aggregate.PartyRoster;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyMutationStatus;
import src.domain.party.roster.value.PartyRestType;

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

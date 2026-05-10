package src.domain.party.application;

import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRestType;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

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

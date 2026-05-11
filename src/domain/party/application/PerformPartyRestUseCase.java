package src.domain.party.application;

import src.domain.party.published.MutationStatus;
import src.domain.party.published.RestType;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class PerformPartyRestUseCase {

    private final PartyRosterRepository repository;

    public PerformPartyRestUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public MutationStatus execute(RestType restType) {
        PartyRoster.MutationResult mutation = repository.load().performRest(restType);
        if (mutation.status() == MutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

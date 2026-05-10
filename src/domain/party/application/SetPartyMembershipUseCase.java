package src.domain.party.application;

import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class SetPartyMembershipUseCase {

    private final PartyRosterRepository repository;

    public SetPartyMembershipUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(long id, PartyMembership membership) {
        PartyRoster.MutationResult mutation = repository.load().setMembership(id, membership);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

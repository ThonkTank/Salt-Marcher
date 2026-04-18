package src.domain.party.application;

import src.domain.party.roster.PartyRoster;
import src.domain.party.roster.PartyRosterRepository;
import src.domain.party.roster.PartyMembership;
import src.domain.party.roster.PartyMutationStatus;

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

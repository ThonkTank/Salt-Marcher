package src.domain.party.usecase;

import src.domain.party.entity.PartyRoster;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyMutationStatus;

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

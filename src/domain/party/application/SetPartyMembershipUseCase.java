package src.domain.party.application;

import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class SetPartyMembershipUseCase {

    private final PartyRosterRepository repository;

    public SetPartyMembershipUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public MutationStatus execute(long id, MembershipState membership) {
        PartyRoster.MutationResult mutation = repository.load().setMembership(id, membership);
        if (mutation.status() == MutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

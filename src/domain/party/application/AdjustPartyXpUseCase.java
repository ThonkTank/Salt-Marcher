package src.domain.party.application;

import java.util.List;
import src.domain.party.roster.aggregate.PartyRoster;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyMutationStatus;

public final class AdjustPartyXpUseCase {

    private final PartyRosterRepository repository;

    public AdjustPartyXpUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(List<Long> ids, int xpDelta) {
        PartyRoster.MutationResult mutation = repository.load().adjustXp(ids, xpDelta);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

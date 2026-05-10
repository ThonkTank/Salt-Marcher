package src.domain.party.application;

import java.util.List;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

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

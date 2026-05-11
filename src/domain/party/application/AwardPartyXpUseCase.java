package src.domain.party.application;

import java.util.List;
import src.domain.party.published.MutationStatus;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class AwardPartyXpUseCase {

    private final AdjustPartyXpUseCase adjustPartyXpUseCase;

    public AwardPartyXpUseCase(PartyRosterRepository repository) {
        this.adjustPartyXpUseCase = new AdjustPartyXpUseCase(repository);
    }

    public MutationStatus execute(List<Long> ids, int xpPerCharacter) {
        return adjustPartyXpUseCase.execute(ids, Math.max(0, xpPerCharacter));
    }
}

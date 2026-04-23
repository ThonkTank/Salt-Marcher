package src.domain.party.application;

import java.util.List;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyMutationStatus;

public final class AwardPartyXpUseCase {

    private final AdjustPartyXpUseCase adjustPartyXpUseCase;

    public AwardPartyXpUseCase(PartyRosterRepository repository) {
        this.adjustPartyXpUseCase = new AdjustPartyXpUseCase(repository);
    }

    public PartyMutationStatus execute(List<Long> ids, int xpPerCharacter) {
        return adjustPartyXpUseCase.execute(ids, Math.max(0, xpPerCharacter));
    }
}

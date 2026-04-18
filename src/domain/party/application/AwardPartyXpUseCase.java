package src.domain.party.application;

import src.domain.party.roster.PartyRoster;
import src.domain.party.roster.PartyRosterRepository;
import src.domain.party.roster.PartyMutationStatus;

import java.util.List;

public final class AwardPartyXpUseCase {

    private final PartyRosterRepository repository;

    public AwardPartyXpUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(List<Long> ids, int xpPerCharacter) {
        PartyRoster.MutationResult mutation = repository.load().awardXp(ids, xpPerCharacter);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

package src.domain.party.application;

import java.util.List;
import src.domain.party.roster.aggregate.PartyRoster;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyMutationStatus;
import src.domain.party.roster.value.PartyTravelLocation;

public final class MovePartyCharactersUseCase {

    private final PartyRosterRepository repository;

    public MovePartyCharactersUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(
            List<Long> characterIds,
            PartyTravelLocation location,
            boolean attachToPartyToken
    ) {
        PartyRoster roster = repository.load();
        PartyRoster.MutationResult result = roster.moveCharacters(characterIds, location, attachToPartyToken);
        if (result.status() == PartyMutationStatus.SUCCESS) {
            repository.save(result.roster());
        }
        return result.status();
    }
}

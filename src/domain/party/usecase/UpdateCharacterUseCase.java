package src.domain.party.usecase;

import src.domain.party.entity.PartyRoster;
import src.domain.party.partyAPI;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.valueobject.PartyMutationStatus;

public final class UpdateCharacterUseCase {

    private final PartyRosterRepository repository;

    public UpdateCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(long id, partyAPI.CharacterDraft draft) {
        PartyRoster.MutationResult mutation = repository.load().updateCharacter(id, draft);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

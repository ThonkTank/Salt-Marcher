package src.domain.party.application;

import src.domain.party.roster.value.PartyCharacterDraft;
import src.domain.party.roster.aggregate.PartyRoster;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyMembership;
import src.domain.party.roster.value.PartyMutationStatus;

public final class CreateCharacterUseCase {

    private final PartyRosterRepository repository;

    public CreateCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public PartyMutationStatus execute(PartyCharacterDraft draft, PartyMembership membership) {
        PartyRoster.MutationResult mutation = repository.load().createCharacter(draft, membership);
        if (mutation.status() == PartyMutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

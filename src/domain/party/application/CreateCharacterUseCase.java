package src.domain.party.application;

import src.domain.party.published.CharacterDraft;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationStatus;
import src.domain.party.model.roster.model.PartyRoster;
import src.domain.party.model.roster.repository.PartyRosterRepository;

public final class CreateCharacterUseCase {

    private final PartyRosterRepository repository;

    public CreateCharacterUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public MutationStatus execute(CharacterDraft draft, MembershipState membership) {
        PartyRoster.MutationResult mutation = repository.load().createCharacter(draft, membership);
        if (mutation.status() == MutationStatus.SUCCESS) {
            repository.save(mutation.roster());
        }
        return mutation.status();
    }
}

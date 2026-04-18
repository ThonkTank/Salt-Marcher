package src.domain.party.application;

import src.domain.party.api.CharacterDraft;
import src.domain.party.api.MutationResult;
import src.domain.party.api.MutationStatus;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyMutationStatus;
import src.domain.party.valueobject.PartyRestType;

import java.util.List;

/**
 * Internal mutation coordinator for the public party API facade.
 */
public final class PartyMutationOperations {

    private final CreateCharacterUseCase createCharacterUseCase;
    private final UpdateCharacterUseCase updateCharacterUseCase;
    private final DeleteCharacterUseCase deleteCharacterUseCase;
    private final SetPartyMembershipUseCase setPartyMembershipUseCase;
    private final AwardPartyXpUseCase awardPartyXpUseCase;
    private final PerformPartyRestUseCase performPartyRestUseCase;

    public PartyMutationOperations(PartyRosterRepository repository) {
        this.createCharacterUseCase = new CreateCharacterUseCase(repository);
        this.updateCharacterUseCase = new UpdateCharacterUseCase(repository);
        this.deleteCharacterUseCase = new DeleteCharacterUseCase(repository);
        this.setPartyMembershipUseCase = new SetPartyMembershipUseCase(repository);
        this.awardPartyXpUseCase = new AwardPartyXpUseCase(repository);
        this.performPartyRestUseCase = new PerformPartyRestUseCase(repository);
    }

    public MutationResult createCharacter(CharacterDraft draft, PartyMembership membership) {
        return new MutationResult(mapMutationStatus(createCharacterUseCase.execute(draft, membership)));
    }

    public MutationResult updateCharacter(long id, CharacterDraft draft) {
        return new MutationResult(mapMutationStatus(updateCharacterUseCase.execute(id, draft)));
    }

    public MutationResult deleteCharacter(long id) {
        return new MutationResult(mapMutationStatus(deleteCharacterUseCase.execute(id)));
    }

    public MutationResult setMembership(long id, PartyMembership membership) {
        return new MutationResult(mapMutationStatus(setPartyMembershipUseCase.execute(id, membership)));
    }

    public MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        return new MutationResult(mapMutationStatus(awardPartyXpUseCase.execute(ids, xpPerCharacter)));
    }

    public MutationResult performRest(PartyRestType restType) {
        return new MutationResult(mapMutationStatus(performPartyRestUseCase.execute(restType)));
    }

    private MutationStatus mapMutationStatus(PartyMutationStatus status) {
        if (status == null) {
            return MutationStatus.STORAGE_ERROR;
        }
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case INVALID_INPUT -> MutationStatus.INVALID_INPUT;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
    }
}

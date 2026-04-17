package src.domain.party.usecase;

import src.domain.party.partyAPI;
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

    public partyAPI.MutationResult createCharacter(partyAPI.CharacterDraft draft, PartyMembership membership) {
        return new partyAPI.MutationResult(mapMutationStatus(createCharacterUseCase.execute(draft, membership)));
    }

    public partyAPI.MutationResult updateCharacter(long id, partyAPI.CharacterDraft draft) {
        return new partyAPI.MutationResult(mapMutationStatus(updateCharacterUseCase.execute(id, draft)));
    }

    public partyAPI.MutationResult deleteCharacter(long id) {
        return new partyAPI.MutationResult(mapMutationStatus(deleteCharacterUseCase.execute(id)));
    }

    public partyAPI.MutationResult setMembership(long id, PartyMembership membership) {
        return new partyAPI.MutationResult(mapMutationStatus(setPartyMembershipUseCase.execute(id, membership)));
    }

    public partyAPI.MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        return new partyAPI.MutationResult(mapMutationStatus(awardPartyXpUseCase.execute(ids, xpPerCharacter)));
    }

    public partyAPI.MutationResult performRest(PartyRestType restType) {
        return new partyAPI.MutationResult(mapMutationStatus(performPartyRestUseCase.execute(restType)));
    }

    private partyAPI.MutationStatus mapMutationStatus(PartyMutationStatus status) {
        if (status == null) {
            return partyAPI.MutationStatus.STORAGE_ERROR;
        }
        return switch (status) {
            case SUCCESS -> partyAPI.MutationStatus.SUCCESS;
            case NOT_FOUND -> partyAPI.MutationStatus.NOT_FOUND;
            case INVALID_INPUT -> partyAPI.MutationStatus.INVALID_INPUT;
            case STORAGE_ERROR -> partyAPI.MutationStatus.STORAGE_ERROR;
        };
    }
}

package features.party.api;

import features.party.PartyObject;
import features.party.input.AwardXpToCharactersInput;

import java.util.List;

/**
 * Public cross-feature write facade for party XP/rest state.
 */
@SuppressWarnings("unused")
public final class PartyMutationApi {
    private static final PartyObject PARTY_OBJECT = new PartyObject();

    public enum MutationStatus {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record MutationResult(MutationStatus status) {}

    private PartyMutationApi() {
        throw new AssertionError("No instances");
    }

    public static MutationResult awardXpToCharacters(List<Long> ids, int xpPerCharacter) {
        AwardXpToCharactersInput.AwardedXpToCharactersInput result =
                PARTY_OBJECT.awardXpToCharacters(new AwardXpToCharactersInput(ids, xpPerCharacter));
        return new MutationResult(mapStatus(result.status()));
    }

    private static MutationStatus mapStatus(AwardXpToCharactersInput.Status status) {
        if (status == null) {
            return MutationStatus.STORAGE_ERROR;
        }
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
    }
}

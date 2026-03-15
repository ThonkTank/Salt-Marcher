package features.party.api;

import features.party.service.PartyService;

import java.util.List;

/**
 * Public cross-feature write facade for party XP/rest state.
 */
public final class PartyMutationApi {

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
        PartyService.MutationResult result = PartyService.awardXpToCharacters(ids, xpPerCharacter);
        return new MutationResult(mapStatus(result.status()));
    }

    private static MutationStatus mapStatus(PartyService.MutationStatus status) {
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

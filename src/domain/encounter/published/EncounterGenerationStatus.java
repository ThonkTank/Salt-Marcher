package src.domain.encounter.published;

public enum EncounterGenerationStatus {
    SUCCESS,
    NO_ACTIVE_PARTY,
    NO_CREATURES,
    NO_SOLUTION,
    INVALID_REQUEST,
    STORAGE_ERROR;

    public static EncounterGenerationStatus successStatus() {
        return SUCCESS;
    }

    public static EncounterGenerationStatus noActivePartyStatus() {
        return NO_ACTIVE_PARTY;
    }

    public static EncounterGenerationStatus defaultFailure() {
        return STORAGE_ERROR;
    }
}

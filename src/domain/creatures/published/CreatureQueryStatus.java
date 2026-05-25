package src.domain.creatures.published;

public enum CreatureQueryStatus {
    SUCCESS,
    INVALID_QUERY,
    STORAGE_ERROR;

    public static CreatureQueryStatus storageErrorStatus() {
        return STORAGE_ERROR;
    }
}

package features.creatures.api;

public enum CreatureQueryStatus {
    SUCCESS,
    INVALID_QUERY,
    STORAGE_ERROR;

    public static CreatureQueryStatus storageErrorStatus() {
        return STORAGE_ERROR;
    }
}

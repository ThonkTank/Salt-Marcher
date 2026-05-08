package src.domain.encounter.published;

public enum SavedEncounterPlanStatus {
    SUCCESS,
    STORAGE_ERROR;

    public static SavedEncounterPlanStatus successStatus() {
        return SUCCESS;
    }

    public static SavedEncounterPlanStatus storageErrorStatus() {
        return STORAGE_ERROR;
    }
}

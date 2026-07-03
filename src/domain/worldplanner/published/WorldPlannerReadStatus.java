package src.domain.worldplanner.published;

public enum WorldPlannerReadStatus {
    SUCCESS,
    STORAGE_ERROR;

    static WorldPlannerReadStatus normalize(WorldPlannerReadStatus status) {
        return status == null ? STORAGE_ERROR : status;
    }
}

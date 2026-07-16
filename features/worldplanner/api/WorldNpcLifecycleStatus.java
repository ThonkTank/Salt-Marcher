package features.worldplanner.api;

public enum WorldNpcLifecycleStatus {
    ACTIVE,
    DEFEATED;

    public static WorldNpcLifecycleStatus fromName(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return WorldNpcLifecycleStatus.valueOf(status);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

}

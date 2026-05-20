package src.domain.dungeon.published;

public enum DungeonTravelMoveStatus {
    SUCCESS,
    INVALID_ACTION,
    TARGET_UNAVAILABLE,
    EXTERNAL_TARGET,
    NO_MAP;

    public boolean isSuccess() {
        return this == SUCCESS;
    }

    public boolean isExternalTarget() {
        return this == EXTERNAL_TARGET;
    }
}

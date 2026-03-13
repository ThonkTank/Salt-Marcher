package features.world.dungeonmap.service.runtime;

public enum DungeonMoveStatus {
    POSITION_SET,
    MOVED,
    MOVED_SAME_ROOM,
    NOT_CONNECTED,
    NO_CURRENT_POSITION,
    INVALID_DESTINATION
}

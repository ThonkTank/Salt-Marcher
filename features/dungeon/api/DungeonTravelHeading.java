package features.dungeon.api;

public enum DungeonTravelHeading {
    NORTH,
    EAST,
    SOUTH,
    WEST;

    public static DungeonTravelHeading defaultHeading() {
        return SOUTH;
    }
}

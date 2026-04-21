package src.domain.dungeon.published;

public enum DungeonTravelHeading {
    NORTH,
    EAST,
    SOUTH,
    WEST;

    public static DungeonTravelHeading defaultHeading() {
        return SOUTH;
    }
}

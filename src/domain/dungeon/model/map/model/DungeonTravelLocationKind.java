package src.domain.dungeon.model.map.model;

public final class DungeonTravelLocationKind {
    private static final String STAIR_EXIT_NAME = "STAIR_EXIT";
    private static final String TRANSITION_NAME = "TRANSITION";

    public static final DungeonTravelLocationKind TILE = new DungeonTravelLocationKind("TILE");
    public static final DungeonTravelLocationKind STAIR_EXIT = new DungeonTravelLocationKind(STAIR_EXIT_NAME);
    public static final DungeonTravelLocationKind TRANSITION = new DungeonTravelLocationKind(TRANSITION_NAME);

    private final String name;

    private DungeonTravelLocationKind(String name) {
        this.name = name;
    }

    public static DungeonTravelLocationKind valueOf(String name) {
        if (STAIR_EXIT_NAME.equals(name)) {
            return STAIR_EXIT;
        }
        return TRANSITION_NAME.equals(name) ? TRANSITION : TILE;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}

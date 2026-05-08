package src.domain.dungeon.map.value;

public final class DungeonTravelLocationKind {
    public static final DungeonTravelLocationKind TILE = new DungeonTravelLocationKind("TILE");
    public static final DungeonTravelLocationKind STAIR_EXIT = new DungeonTravelLocationKind("STAIR_EXIT");
    public static final DungeonTravelLocationKind TRANSITION = new DungeonTravelLocationKind("TRANSITION");

    private final String name;

    private DungeonTravelLocationKind(String name) {
        this.name = name;
    }

    public static DungeonTravelLocationKind valueOf(String name) {
        if ("STAIR_EXIT".equals(name)) {
            return STAIR_EXIT;
        }
        return "TRANSITION".equals(name) ? TRANSITION : TILE;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}

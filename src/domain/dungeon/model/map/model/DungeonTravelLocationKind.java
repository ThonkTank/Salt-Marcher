package src.domain.dungeon.model.map.model;

public final class DungeonTravelLocationKind {

    public static final DungeonTravelLocationKind TILE = new DungeonTravelLocationKind("TILE");
    public static final DungeonTravelLocationKind STAIR_EXIT = new DungeonTravelLocationKind("STAIR_EXIT");
    public static final DungeonTravelLocationKind TRANSITION = new DungeonTravelLocationKind("TRANSITION");

    private final String name;

    private DungeonTravelLocationKind(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }
}

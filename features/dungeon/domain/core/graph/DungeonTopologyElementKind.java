package features.dungeon.domain.core.graph;

public final class DungeonTopologyElementKind {
    public static final DungeonTopologyElementKind EMPTY = new DungeonTopologyElementKind("EMPTY");
    public static final DungeonTopologyElementKind ROOM = new DungeonTopologyElementKind("ROOM");
    public static final DungeonTopologyElementKind CORRIDOR = new DungeonTopologyElementKind("CORRIDOR");
    public static final DungeonTopologyElementKind CORRIDOR_ANCHOR = new DungeonTopologyElementKind("CORRIDOR_ANCHOR");
    public static final DungeonTopologyElementKind DOOR = new DungeonTopologyElementKind("DOOR");
    public static final DungeonTopologyElementKind WALL = new DungeonTopologyElementKind("WALL");
    public static final DungeonTopologyElementKind STAIR = new DungeonTopologyElementKind("STAIR");
    public static final DungeonTopologyElementKind TRANSITION = new DungeonTopologyElementKind("TRANSITION");
    public static final DungeonTopologyElementKind FEATURE_MARKER = new DungeonTopologyElementKind("FEATURE_MARKER");

    private final String name;

    private DungeonTopologyElementKind(String name) {
        this.name = name;
    }

    public static DungeonTopologyElementKind valueOf(String name) {
        return switch (name) {
            case "ROOM" -> ROOM;
            case "CORRIDOR" -> CORRIDOR;
            case "CORRIDOR_ANCHOR" -> CORRIDOR_ANCHOR;
            case "DOOR" -> DOOR;
            case "WALL" -> WALL;
            case "STAIR" -> STAIR;
            case "TRANSITION" -> TRANSITION;
            case "FEATURE_MARKER" -> FEATURE_MARKER;
            default -> EMPTY;
        };
    }

    public String name() {
        return name;
    }

    public boolean isCorridor() {
        return this == CORRIDOR;
    }

    @Override
    public String toString() {
        return name;
    }
}

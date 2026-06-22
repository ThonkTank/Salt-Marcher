package src.domain.dungeon.model.runtime.editor.interaction;

public final class DungeonEditorHandleType {
    public static final DungeonEditorHandleType CLUSTER_LABEL = new DungeonEditorHandleType("CLUSTER_LABEL");
    public static final DungeonEditorHandleType CLUSTER_CORNER = new DungeonEditorHandleType("CLUSTER_CORNER");
    public static final DungeonEditorHandleType CLUSTER_WALL_RUN = new DungeonEditorHandleType("CLUSTER_WALL_RUN");
    public static final DungeonEditorHandleType DOOR = new DungeonEditorHandleType("DOOR");
    public static final DungeonEditorHandleType CORRIDOR_ANCHOR = new DungeonEditorHandleType("CORRIDOR_ANCHOR");
    public static final DungeonEditorHandleType CORRIDOR_WAYPOINT = new DungeonEditorHandleType("CORRIDOR_WAYPOINT");
    public static final DungeonEditorHandleType STAIR_ANCHOR = new DungeonEditorHandleType("STAIR_ANCHOR");

    private final String name;

    private DungeonEditorHandleType(String name) {
        this.name = name;
    }

    public static DungeonEditorHandleType valueOf(String name) {
        return switch (name) {
            case "CLUSTER_CORNER" -> CLUSTER_CORNER;
            case "CLUSTER_WALL_RUN" -> CLUSTER_WALL_RUN;
            case "DOOR" -> DOOR;
            case "CORRIDOR_ANCHOR" -> CORRIDOR_ANCHOR;
            case "CORRIDOR_WAYPOINT" -> CORRIDOR_WAYPOINT;
            case "STAIR_ANCHOR" -> STAIR_ANCHOR;
            default -> CLUSTER_LABEL;
        };
    }

    public String name() {
        return name;
    }

    public boolean isDirectClusterMoveCommit() {
        return this == CLUSTER_LABEL || this == CLUSTER_CORNER;
    }

    public boolean isDirectDoorMoveCommit() {
        return this == DOOR;
    }

    public boolean isDirectCorridorMoveCommit() {
        return this == CORRIDOR_ANCHOR || this == CORRIDOR_WAYPOINT;
    }

    @Override
    public String toString() {
        return name;
    }
}

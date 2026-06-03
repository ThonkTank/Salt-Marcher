package src.domain.dungeon.model.worldspace;

public final class DungeonEditorHandleMovementKind {
    public static final DungeonEditorHandleMovementKind UNKNOWN = new DungeonEditorHandleMovementKind("UNKNOWN");
    public static final DungeonEditorHandleMovementKind CLUSTER_LABEL =
            new DungeonEditorHandleMovementKind("CLUSTER_LABEL");
    public static final DungeonEditorHandleMovementKind CLUSTER_CORNER =
            new DungeonEditorHandleMovementKind("CLUSTER_CORNER");
    public static final DungeonEditorHandleMovementKind DOOR = new DungeonEditorHandleMovementKind("DOOR");
    public static final DungeonEditorHandleMovementKind CORRIDOR_ANCHOR =
            new DungeonEditorHandleMovementKind("CORRIDOR_ANCHOR");
    public static final DungeonEditorHandleMovementKind CORRIDOR_WAYPOINT =
            new DungeonEditorHandleMovementKind("CORRIDOR_WAYPOINT");
    public static final DungeonEditorHandleMovementKind STAIR_ANCHOR =
            new DungeonEditorHandleMovementKind("STAIR_ANCHOR");

    private final String name;

    private DungeonEditorHandleMovementKind(String name) {
        this.name = name;
    }

    public static DungeonEditorHandleMovementKind fromName(String name) {
        return switch (name) {
            case "CLUSTER_LABEL" -> CLUSTER_LABEL;
            case "CLUSTER_CORNER" -> CLUSTER_CORNER;
            case "DOOR" -> DOOR;
            case "CORRIDOR_ANCHOR" -> CORRIDOR_ANCHOR;
            case "CORRIDOR_WAYPOINT" -> CORRIDOR_WAYPOINT;
            case "STAIR_ANCHOR" -> STAIR_ANCHOR;
            default -> UNKNOWN;
        };
    }

    public static DungeonEditorHandleMovementKind defaultKind() {
        return CLUSTER_LABEL;
    }

    boolean isClusterLabel() {
        return this == CLUSTER_LABEL;
    }

    boolean isUnknown() {
        return this == UNKNOWN;
    }

    boolean isClusterCorner() {
        return this == CLUSTER_CORNER;
    }

    boolean isDoor() {
        return this == DOOR;
    }

    boolean isCorridorAnchor() {
        return this == CORRIDOR_ANCHOR;
    }

    boolean isCorridorWaypoint() {
        return this == CORRIDOR_WAYPOINT;
    }

    boolean isStairAnchor() {
        return this == STAIR_ANCHOR;
    }
}

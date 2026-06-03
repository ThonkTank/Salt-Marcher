package src.domain.dungeon.model.worldspace;

public enum DungeonEditorHandleProjectionKind {
    CLUSTER_LABEL,
    CLUSTER_CORNER,
    DOOR,
    CORRIDOR_ANCHOR,
    CORRIDOR_WAYPOINT,
    STAIR_ANCHOR;

    public static DungeonEditorHandleProjectionKind defaultKind() {
        return CLUSTER_LABEL;
    }
}

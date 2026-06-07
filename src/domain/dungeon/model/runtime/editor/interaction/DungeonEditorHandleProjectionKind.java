package src.domain.dungeon.model.runtime.editor.interaction;

public enum DungeonEditorHandleProjectionKind {
    CLUSTER_LABEL,
    CLUSTER_CORNER,
    CLUSTER_WALL_RUN,
    DOOR,
    CORRIDOR_ANCHOR,
    CORRIDOR_WAYPOINT,
    STAIR_ANCHOR;

    public static DungeonEditorHandleProjectionKind defaultKind() {
        return CLUSTER_LABEL;
    }
}

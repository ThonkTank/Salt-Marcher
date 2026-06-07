package src.domain.dungeon.published;

public enum DungeonEditorHandleKind {
    CLUSTER_LABEL,
    CLUSTER_CORNER,
    CLUSTER_WALL_RUN,
    DOOR,
    CORRIDOR_ANCHOR,
    CORRIDOR_WAYPOINT,
    STAIR_ANCHOR;

    public boolean isClusterLabel() {
        return this == CLUSTER_LABEL;
    }
}

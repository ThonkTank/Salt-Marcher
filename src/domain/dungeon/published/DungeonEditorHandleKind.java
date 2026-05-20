package src.domain.dungeon.published;

public enum DungeonEditorHandleKind {
    CLUSTER_LABEL,
    DOOR,
    CORRIDOR_ANCHOR,
    CORRIDOR_WAYPOINT,
    STAIR_ANCHOR;

    public static DungeonEditorHandleKind fromName(String name) {
        try {
            return valueOf(name == null ? CLUSTER_LABEL.name() : name);
        } catch (IllegalArgumentException ignored) {
            return CLUSTER_LABEL;
        }
    }

    public boolean isClusterLabel() {
        return this == CLUSTER_LABEL;
    }
}

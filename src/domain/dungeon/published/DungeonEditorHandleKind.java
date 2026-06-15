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

    public boolean isClusterCorner() {
        return this == CLUSTER_CORNER;
    }

    public boolean isClusterWallRun() {
        return this == CLUSTER_WALL_RUN;
    }

    public boolean isClusterDragHandle() {
        return isClusterCorner() || isClusterWallRun();
    }

    public boolean isDoor() {
        return this == DOOR;
    }

    public boolean isCorridorAnchor() {
        return this == CORRIDOR_ANCHOR;
    }

    public boolean isCorridorWaypoint() {
        return this == CORRIDOR_WAYPOINT;
    }

    public boolean isCorridorGeometryHandle() {
        return isCorridorAnchor() || isCorridorWaypoint();
    }
}

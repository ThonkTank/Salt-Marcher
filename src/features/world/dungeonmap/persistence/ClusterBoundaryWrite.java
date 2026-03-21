package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;

public record ClusterBoundaryWrite(
        Point2i cell,
        Point2i direction,
        Type type
) {
    public enum Type {
        WALL,
        DOOR
    }
}

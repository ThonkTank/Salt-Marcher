package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.List;

public record ClusterGeometryWrite(
        Point2i center,
        List<Point2i> relativeVertices
) {
    public ClusterGeometryWrite {
        center = center == null ? new Point2i(0, 0) : center;
        relativeVertices = relativeVertices == null ? List.of() : List.copyOf(relativeVertices);
    }
}

package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.List;

public final class DungeonRoomGeometryWriteMapper {

    public ClusterGeometryWrite toClusterGeometry(TileShape shape) {
        TileShape resolvedShape = shape == null ? TileShape.empty() : shape;
        Point2i center = resolvedShape.centerCell();
        Point2i loopSeparator = new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE);
        List<Point2i> relativeVertices = resolvedShape.absoluteVertices().stream()
                .map(vertex -> loopSeparator.equals(vertex) ? loopSeparator : vertex.subtract(center))
                .toList();
        return new ClusterGeometryWrite(center, relativeVertices);
    }
}

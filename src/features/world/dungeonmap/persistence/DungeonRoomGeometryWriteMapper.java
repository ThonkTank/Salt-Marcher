package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonRoomGeometryWriteMapper {

    private static final Point2i LOOP_SEPARATOR = new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE);

    public ClusterGeometryWrite toClusterGeometry(TileShape shape) {
        return toClusterGeometry(Map.of(0, shape == null ? TileShape.empty() : shape));
    }

    public ClusterGeometryWrite toClusterGeometry(Map<Integer, TileShape> shapesByLevel) {
        Map<Integer, TileShape> resolvedShapes = normalizedShapesByLevel(shapesByLevel);
        Point2i center = centerFor(resolvedShapes);
        Map<Integer, List<Point2i>> relativeVerticesByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, TileShape> entry : resolvedShapes.entrySet()) {
            List<Point2i> relativeVertices = entry.getValue().absoluteVertices().stream()
                    .map(vertex -> LOOP_SEPARATOR.equals(vertex) ? LOOP_SEPARATOR : vertex.subtract(center))
                    .toList();
            relativeVerticesByLevel.put(entry.getKey(), relativeVertices);
        }
        return new ClusterGeometryWrite(center, relativeVerticesByLevel);
    }

    private static Map<Integer, TileShape> normalizedShapesByLevel(Map<Integer, TileShape> shapesByLevel) {
        if (shapesByLevel == null || shapesByLevel.isEmpty()) {
            return Map.of(0, TileShape.empty());
        }
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, TileShape> entry : shapesByLevel.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            result.put(entry.getKey(), entry.getValue() == null ? TileShape.empty() : entry.getValue());
        }
        return result.isEmpty() ? Map.of(0, TileShape.empty()) : Map.copyOf(result);
    }

    private static Point2i centerFor(Map<Integer, TileShape> shapesByLevel) {
        java.util.Set<Point2i> cells = new java.util.LinkedHashSet<>();
        for (TileShape shape : shapesByLevel.values()) {
            if (shape != null) {
                cells.addAll(shape.absoluteCells());
            }
        }
        return cells.isEmpty() ? new Point2i(0, 0) : TileShape.fromAbsoluteCells(cells).centerCell();
    }
}

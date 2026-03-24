package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record ClusterGeometryWrite(
        Point2i center,
        Map<Integer, List<Point2i>> relativeVerticesByLevel
) {
    public ClusterGeometryWrite {
        center = center == null ? new Point2i(0, 0) : center;
        relativeVerticesByLevel = normalizedVerticesByLevel(relativeVerticesByLevel);
    }

    private static Map<Integer, List<Point2i>> normalizedVerticesByLevel(Map<Integer, List<Point2i>> verticesByLevel) {
        if (verticesByLevel == null || verticesByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Point2i>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Point2i>> entry : verticesByLevel.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            List<Point2i> vertices = entry.getValue() == null
                    ? List.of()
                    : entry.getValue().stream()
                            .filter(java.util.Objects::nonNull)
                            .toList();
            result.put(entry.getKey(), List.copyOf(vertices));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }
}

package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Canonical edge-shape carrier for boundary/opening geometry on the doubled grid.
 *
 * <p>Single-level shapes use the default internal level key {@code 0}; multi-level owners may populate multiple
 * levels directly.</p>
 */
public class EdgeShape {

    private final Map<Integer, List<GridSegment2x>> segmentsByLevel;

    public static EdgeShape empty() {
        return new EdgeShape(Map.of());
    }

    public EdgeShape(Collection<GridSegment2x> segments2x) {
        this(singleLevelMap(0, segments2x));
    }

    public EdgeShape(Map<Integer, ? extends Collection<GridSegment2x>> segmentsByLevel) {
        this.segmentsByLevel = normalizeSegmentsByLevel(segmentsByLevel);
    }

    public Set<Integer> levels() {
        return segmentsByLevel.keySet();
    }

    public int primaryLevel() {
        return segmentsByLevel.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public boolean isEmpty() {
        return segmentsByLevel.isEmpty() || segmentsByLevel.values().stream().allMatch(List::isEmpty);
    }

    public List<GridSegment2x> segments2x() {
        java.util.ArrayList<GridSegment2x> result = new java.util.ArrayList<>();
        for (List<GridSegment2x> segments : segmentsByLevel.values()) {
            result.addAll(segments);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public List<GridSegment2x> segments2xAtLevel(int levelZ) {
        return segmentsByLevel.getOrDefault(levelZ, List.of());
    }

    public Set<GridSegment2x> segmentSet2x() {
        return segments2x().isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(segments2x()));
    }

    public Set<GridSegment2x> segmentSet2xAtLevel(int levelZ) {
        List<GridSegment2x> segments = segments2xAtLevel(levelZ);
        return segments.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(segments));
    }

    public boolean contains(GridSegment2x segment2x) {
        return segment2x != null && segmentsByLevel.values().stream().anyMatch(segments -> segments.contains(segment2x));
    }

    public boolean contains(GridSegment2x segment2x, int levelZ) {
        return segment2x != null && segments2xAtLevel(levelZ).contains(segment2x);
    }

    public GridSegment2x firstSegment2x() {
        return segmentsByLevel.values().stream()
                .flatMap(Collection::stream)
                .findFirst()
                .orElse(null);
    }

    public GridSegment2x firstSegment2xAtLevel(int levelZ) {
        return segments2xAtLevel(levelZ).stream().findFirst().orElse(null);
    }

    public EdgeShape translatedByCells(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if ((resolvedDelta.x() == 0 && resolvedDelta.y() == 0) && levelDelta == 0) {
            return this;
        }
        Map<Integer, List<GridSegment2x>> translated = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<GridSegment2x>> entry : segmentsByLevel.entrySet()) {
            List<GridSegment2x> translatedSegments = entry.getValue().stream()
                    .map(segment -> segment.translatedByCells(resolvedDelta))
                    .toList();
            translated.put(entry.getKey() + levelDelta, translatedSegments);
        }
        return new EdgeShape(translated);
    }

    protected final Map<Integer, List<GridSegment2x>> segmentsByLevelView() {
        return segmentsByLevel;
    }

    protected static List<GridSegment2x> normalizeSegments(Collection<GridSegment2x> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        segments.stream()
                .filter(segment -> segment != null)
                .sorted(GridSegment2x.ORDER)
                .forEach(result::add);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    protected static Map<Integer, List<GridSegment2x>> normalizeSegmentsByLevel(
            Map<Integer, ? extends Collection<GridSegment2x>> segmentsByLevel
    ) {
        if (segmentsByLevel == null || segmentsByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<GridSegment2x>> result = new LinkedHashMap<>();
        segmentsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    List<GridSegment2x> normalized = normalizeSegments(entry.getValue());
                    if (!normalized.isEmpty()) {
                        result.put(entry.getKey(), normalized);
                    }
                });
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Collection<GridSegment2x>> singleLevelMap(int levelZ, Collection<GridSegment2x> segments2x) {
        Map<Integer, Collection<GridSegment2x>> result = new LinkedHashMap<>();
        result.put(levelZ, segments2x == null ? List.of() : segments2x);
        return result;
    }
}

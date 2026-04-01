package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Canonical per-level structure input in the shared doubled-grid language.
 */
public record StructureDescriptor(Map<Integer, StructureDescriptor.LevelDescriptor> levels) {

    public StructureDescriptor {
        levels = normalizeLevels(levels);
    }

    public static StructureDescriptor empty() {
        return new StructureDescriptor(Map.of());
    }

    public LevelDescriptor level(int levelZ) {
        return levels.get(levelZ);
    }

    public Set<Integer> levelZs() {
        return levels.keySet();
    }

    public StructureDescriptor translatedByCells(Point2i delta, int levelDelta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0 && levelDelta == 0) {
            return this;
        }
        Map<Integer, LevelDescriptor> translated = new LinkedHashMap<>();
        for (Map.Entry<Integer, LevelDescriptor> entry : levels.entrySet()) {
            translated.put(entry.getKey() + levelDelta, entry.getValue().translatedByCells(resolvedDelta));
        }
        return new StructureDescriptor(translated);
    }

    private static Map<Integer, LevelDescriptor> normalizeLevels(Map<Integer, LevelDescriptor> levels) {
        if (levels == null || levels.isEmpty()) {
            return Map.of();
        }
        Map<Integer, LevelDescriptor> result = new LinkedHashMap<>();
        levels.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public record LevelDescriptor(
            GridPoint2x anchor2x,
            Set<GridPoint2x> fillSeeds2x,
            Set<GridSegment2x> boundarySegments2x,
            Set<GridSegment2x> openingSegments2x
    ) {

        public LevelDescriptor {
            anchor2x = normalizeAnchor(anchor2x);
            boundarySegments2x = normalizeBoundarySegments(boundarySegments2x);
            fillSeeds2x = normalizeSeeds(fillSeeds2x, anchor2x, !boundarySegments2x.isEmpty());
            openingSegments2x = normalizeOpenings(openingSegments2x, boundarySegments2x);
        }

        public LevelDescriptor translatedByCells(Point2i delta) {
            Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
            if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
                return this;
            }
            Set<GridPoint2x> translatedSeeds = new LinkedHashSet<>();
            for (GridPoint2x seed : fillSeeds2x) {
                translatedSeeds.add(seed.translatedByCells(resolvedDelta));
            }
            Set<GridSegment2x> translatedBoundary = new LinkedHashSet<>();
            for (GridSegment2x segment : boundarySegments2x) {
                translatedBoundary.add(segment.translatedByCells(resolvedDelta));
            }
            Set<GridSegment2x> translatedOpenings = new LinkedHashSet<>();
            for (GridSegment2x segment : openingSegments2x) {
                translatedOpenings.add(segment.translatedByCells(resolvedDelta));
            }
            return new LevelDescriptor(
                    anchor2x.translatedByCells(resolvedDelta),
                    translatedSeeds,
                    translatedBoundary,
                    translatedOpenings);
        }

        public boolean isEmpty() {
            return fillSeeds2x.isEmpty() && boundarySegments2x.isEmpty() && openingSegments2x.isEmpty();
        }

        private static GridPoint2x normalizeAnchor(GridPoint2x anchor2x) {
            GridPoint2x resolvedAnchor = anchor2x == null
                    ? GridPoint2x.fromTileCenter(new Point2i(0, 0))
                    : anchor2x;
            if (!resolvedAnchor.isTileCenter()) {
                throw new IllegalArgumentException("StructureDescriptor anchor must be a tile center");
            }
            return resolvedAnchor;
        }

        private static Set<GridPoint2x> normalizeSeeds(
                Collection<GridPoint2x> seeds,
                GridPoint2x anchor2x,
                boolean defaultToAnchor
        ) {
            LinkedHashSet<GridPoint2x> result = new LinkedHashSet<>();
            if (seeds != null) {
                seeds.stream()
                        .filter(seed -> seed != null)
                        .sorted(GridPoint2x.POINT_ORDER)
                        .forEach(seed -> {
                            if (!seed.isTileCenter()) {
                                throw new IllegalArgumentException("StructureDescriptor fill seeds must be tile centers");
                            }
                            result.add(seed);
                        });
            }
            if (result.isEmpty() && defaultToAnchor) {
                result.add(anchor2x);
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static Set<GridSegment2x> normalizeBoundarySegments(Collection<GridSegment2x> segments) {
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
            if (segments != null) {
                segments.stream()
                        .filter(segment -> segment != null)
                        .sorted(GridSegment2x.SEGMENT_ORDER)
                        .forEach(segment -> {
                            if (!segment.start().isVertex() || !segment.end().isVertex() || (segment.manhattanLength2() & 1) != 0) {
                                throw new IllegalArgumentException("StructureDescriptor boundaries must be vertex-to-vertex segments");
                            }
                            result.add(segment);
                        });
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static Set<GridSegment2x> normalizeOpenings(
                Collection<GridSegment2x> openings,
                Set<GridSegment2x> boundarySegments
        ) {
            if (openings == null || openings.isEmpty() || boundarySegments.isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
            openings.stream()
                    .filter(segment -> segment != null && boundarySegments.contains(segment))
                    .sorted(GridSegment2x.SEGMENT_ORDER)
                    .forEach(result::add);
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }
    }
}

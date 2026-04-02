package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.ArrayDeque;
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

    public static StructureDescriptor fromCubePoints(Collection<CubePoint> cubePoints) {
        if (cubePoints == null || cubePoints.isEmpty()) {
            return empty();
        }
        Map<Integer, Set<Point2i>> cellsByLevel = new LinkedHashMap<>();
        for (CubePoint cubePoint : cubePoints) {
            if (cubePoint == null) {
                continue;
            }
            cellsByLevel.computeIfAbsent(cubePoint.z(), ignored -> new LinkedHashSet<>())
                    .add(cubePoint.projectedCell());
        }
        return fromCellsByLevel(cellsByLevel);
    }

    public static StructureDescriptor fromCellsByLevel(Map<Integer, ? extends Collection<Point2i>> cellsByLevel) {
        if (cellsByLevel == null || cellsByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, LevelDescriptor> levels = new LinkedHashMap<>();
        cellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    LevelDescriptor level = descriptorForCells(entry.getValue());
                    if (!level.isEmpty()) {
                        levels.put(entry.getKey(), level);
                    }
                });
        return levels.isEmpty() ? empty() : new StructureDescriptor(levels);
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

    private static LevelDescriptor descriptorForCells(Collection<Point2i> cells) {
        Set<Point2i> normalizedCells = normalizeCells(cells);
        if (normalizedCells.isEmpty()) {
            return new LevelDescriptor(GridPoint2x.fromTileCenter(new Point2i(0, 0)), Set.of(), Set.of(), Set.of());
        }
        Point2i anchorCell = TileShape.fromAbsoluteCells(normalizedCells).anchor();
        return new LevelDescriptor(
                GridPoint2x.fromTileCenter(anchorCell),
                seedPoints(normalizedCells),
                boundarySegments(normalizedCells),
                Set.of());
    }

    private static Set<Point2i> normalizeCells(Collection<Point2i> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridPoint2x> seedPoints(Set<Point2i> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint2x> result = new LinkedHashSet<>();
        Set<Point2i> remaining = new LinkedHashSet<>(cells);
        while (!remaining.isEmpty()) {
            Point2i seed = remaining.iterator().next();
            LinkedHashSet<Point2i> component = new LinkedHashSet<>();
            ArrayDeque<Point2i> queue = new ArrayDeque<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                Point2i current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Point2i neighbor = current.add(step);
                    if (remaining.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            Point2i anchorCell = TileShape.fromAbsoluteCells(component).anchor();
            result.add(GridPoint2x.fromTileCenter(anchorCell));
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridSegment2x> boundarySegments(Set<Point2i> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                if (!cells.contains(cell.add(step))) {
                    result.add(GridSegment2x.betweenCellAndStep(cell, step));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
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

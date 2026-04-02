package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Canonical per-level structure input reduced to cell-space seeds plus shared 2x boundary truth.
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
        Map<Integer, Set<CellCoord>> cellsByLevel = new LinkedHashMap<>();
        for (CubePoint cubePoint : cubePoints) {
            if (cubePoint == null) {
                continue;
            }
            cellsByLevel.computeIfAbsent(cubePoint.z(), ignored -> new LinkedHashSet<>())
                    .add(cubePoint.projectedCellCoord());
        }
        return fromCellCoordsByLevel(cellsByLevel);
    }

    public static StructureDescriptor fromCellsByLevel(Map<Integer, ? extends Collection<Point2i>> cellsByLevel) {
        if (cellsByLevel == null || cellsByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, Set<CellCoord>> normalized = new LinkedHashMap<>();
        cellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> normalized.put(entry.getKey(), CellCoord.fromPoints(entry.getValue())));
        return fromCellCoordsByLevel(normalized);
    }

    public static StructureDescriptor fromCellCoordsByLevel(Map<Integer, ? extends Collection<CellCoord>> cellsByLevel) {
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
        return translatedByCells(CellCoord.fromPoint(delta), levelDelta);
    }

    public StructureDescriptor translatedByCells(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
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

    private static LevelDescriptor descriptorForCells(Collection<CellCoord> cells) {
        Set<CellCoord> normalizedCells = normalizeCellCoords(cells);
        if (normalizedCells.isEmpty()) {
            return new LevelDescriptor(new CellCoord(0, 0), Set.of(), Set.of(), Set.of());
        }
        CellCoord anchorCell = bestCenterCoord(normalizedCells);
        return new LevelDescriptor(
                anchorCell,
                fillSeeds(normalizedCells),
                boundaryEdges(normalizedCells),
                Set.of());
    }

    private static Set<CellCoord> normalizeCellCoords(Collection<CellCoord> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        cells.stream()
                .filter(cell -> cell != null)
                .sorted(CellCoord.ORDER)
                .forEach(result::add);
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    static Point2i bestCenterCell(Collection<Point2i> cells) {
        return bestCenterCoord(CellCoord.fromPoints(cells)).toPoint2i();
    }

    static CellCoord bestCenterCoord(Collection<CellCoord> cells) {
        Set<CellCoord> normalizedCells = normalizeCellCoords(cells);
        if (normalizedCells.isEmpty()) {
            return new CellCoord(0, 0);
        }
        double averageX = normalizedCells.stream().mapToInt(CellCoord::x).average().orElse(0.0);
        double averageY = normalizedCells.stream().mapToInt(CellCoord::y).average().orElse(0.0);
        return normalizedCells.stream()
                .min(java.util.Comparator
                        .comparingDouble((CellCoord cell) -> squaredDistance(cell, averageX, averageY))
                        .thenComparing(CellCoord.ORDER))
                .orElse(new CellCoord(0, 0));
    }

    private static Set<CellCoord> fillSeeds(Set<CellCoord> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        Set<CellCoord> remaining = new LinkedHashSet<>(cells);
        while (!remaining.isEmpty()) {
            CellCoord seed = remaining.iterator().next();
            LinkedHashSet<CellCoord> component = new LinkedHashSet<>();
            ArrayDeque<CellCoord> queue = new ArrayDeque<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                CellCoord current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                    CellCoord neighbor = current.add(step);
                    if (remaining.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(bestCenterCoord(component));
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridSegment2x> boundaryEdges(Set<CellCoord> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : cells) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                if (!cells.contains(cell.add(step))) {
                    result.add(GridSegment2x.betweenCellAndStep(cell, step));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static double squaredDistance(CellCoord cell, double centerX, double centerY) {
        double deltaX = cell.x() - centerX;
        double deltaY = cell.y() - centerY;
        return deltaX * deltaX + deltaY * deltaY;
    }

    public record LevelDescriptor(
            CellCoord anchorCell,
            Set<CellCoord> fillSeeds,
            Set<GridSegment2x> boundaryEdges,
            Set<GridSegment2x> openingEdges
    ) {

        public LevelDescriptor {
            anchorCell = normalizeAnchor(anchorCell);
            boundaryEdges = normalizeBoundaryEdges(boundaryEdges);
            fillSeeds = normalizeSeeds(fillSeeds, anchorCell, !boundaryEdges.isEmpty());
            openingEdges = normalizeOpenings(openingEdges, boundaryEdges);
        }

        public LevelDescriptor translatedByCells(Point2i delta) {
            return translatedByCells(CellCoord.fromPoint(delta));
        }

        public LevelDescriptor translatedByCells(CellCoord delta) {
            CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
            if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
                return this;
            }
            Set<CellCoord> translatedSeeds = new LinkedHashSet<>();
            for (CellCoord seed : fillSeeds) {
                translatedSeeds.add(seed.add(resolvedDelta));
            }
            Set<GridSegment2x> translatedBoundary = new LinkedHashSet<>();
            for (GridSegment2x segment : boundaryEdges) {
                translatedBoundary.add(segment.translatedByCells(resolvedDelta));
            }
            Set<GridSegment2x> translatedOpenings = new LinkedHashSet<>();
            for (GridSegment2x segment : openingEdges) {
                translatedOpenings.add(segment.translatedByCells(resolvedDelta));
            }
            return new LevelDescriptor(
                    anchorCell.add(resolvedDelta),
                    translatedSeeds,
                    translatedBoundary,
                    translatedOpenings);
        }

        public boolean isEmpty() {
            return fillSeeds.isEmpty() && boundaryEdges.isEmpty() && openingEdges.isEmpty();
        }

        public GridPoint2x anchor2x() {
            return GridPoint2x.fromTileCenter(anchorCell);
        }

        public Set<GridPoint2x> fillSeeds2x() {
            LinkedHashSet<GridPoint2x> result = new LinkedHashSet<>();
            fillSeeds.stream()
                    .sorted(CellCoord.ORDER)
                    .map(GridPoint2x::fromTileCenter)
                    .forEach(result::add);
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        public Set<GridSegment2x> boundarySegments2x() {
            return boundaryEdges;
        }

        public Set<GridSegment2x> openingSegments2x() {
            return openingEdges;
        }

        private static CellCoord normalizeAnchor(CellCoord anchorCell) {
            return anchorCell == null ? new CellCoord(0, 0) : anchorCell;
        }

        private static Set<CellCoord> normalizeSeeds(
                Collection<CellCoord> seeds,
                CellCoord anchorCell,
                boolean defaultToAnchor
        ) {
            LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
            if (seeds != null) {
                seeds.stream()
                        .filter(seed -> seed != null)
                        .sorted(CellCoord.ORDER)
                        .forEach(result::add);
            }
            if (result.isEmpty() && defaultToAnchor) {
                result.add(anchorCell);
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static Set<GridSegment2x> normalizeBoundaryEdges(Collection<GridSegment2x> segments) {
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
                Set<GridSegment2x> boundaryEdges
        ) {
            if (openings == null || openings.isEmpty() || boundaryEdges.isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
            openings.stream()
                    .filter(segment -> segment != null && boundaryEdges.contains(segment))
                    .sorted(GridSegment2x.SEGMENT_ORDER)
                    .forEach(result::add);
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }
    }
}

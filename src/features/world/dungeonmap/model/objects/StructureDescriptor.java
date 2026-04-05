package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Canonical per-level structure input reduced to cell-space seeds plus shared final-parity 2x boundary truth.
 *
 * <p>Surface ownership stays on cell seeds plus 2x boundaries, while explicit floor cells may further restrict which
 * authored surface cells are currently walkable.
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
                    .add(cubePoint.projectedCell());
        }
        return fromCellCoordsByLevel(cellsByLevel);
    }

    public static StructureDescriptor fromCellCoordsByLevel(Map<Integer, ? extends Collection<CellCoord>> cellsByLevel) {
        return fromCellCoordsByLevel(cellsByLevel, null);
    }

    public static StructureDescriptor fromCellCoordsByLevel(
            Map<Integer, ? extends Collection<CellCoord>> cellsByLevel,
            Map<Integer, ? extends Collection<CellCoord>> floorCellsByLevel
    ) {
        if (cellsByLevel == null || cellsByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, LevelDescriptor> levels = new LinkedHashMap<>();
        cellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    LevelDescriptor level = descriptorForCells(
                            entry.getValue(),
                            floorCellsByLevel == null ? null : floorCellsByLevel.get(entry.getKey()));
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

    public StructureDescriptor withFloorCellsAtLevel(int levelZ, Collection<CellCoord> floorCells) {
        LevelDescriptor level = level(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelDescriptor> updatedLevels = new LinkedHashMap<>(levels);
        updatedLevels.put(levelZ, level.withFloorCells(floorCells));
        return new StructureDescriptor(updatedLevels);
    }

    public StructureDescriptor withOpeningEdgesAtLevel(int levelZ, Collection<GridSegment2x> openingEdges) {
        LevelDescriptor level = level(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelDescriptor> updatedLevels = new LinkedHashMap<>(levels);
        updatedLevels.put(levelZ, level.withOpeningEdges(openingEdges));
        return new StructureDescriptor(updatedLevels);
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

    private static LevelDescriptor descriptorForCells(
            Collection<CellCoord> cells,
            Collection<CellCoord> floorCells
    ) {
        Set<CellCoord> normalizedCells = CellCoord.normalize(cells);
        if (normalizedCells.isEmpty()) {
            return new LevelDescriptor(new CellCoord(0, 0), Set.of(), Set.of(), Set.of(), Set.of());
        }
        CellCoord anchorCell = CellCoord.bestCenter(normalizedCells);
        return new LevelDescriptor(
                anchorCell,
                CellCoord.componentCenters(normalizedCells),
                boundaryEdges(normalizedCells),
                Set.of(),
                normalizeFloorCells(normalizedCells, floorCells));
    }

    private static Set<GridSegment2x> boundaryEdges(Set<CellCoord> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : cells) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                if (!cells.contains(cell.add(step))) {
                    result.add(GridSegment2x.boundaryEdge(cell, cell.directionTo4(cell.add(step))));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public record LevelDescriptor(
            CellCoord anchorCell,
            Set<CellCoord> fillSeeds,
            Set<GridSegment2x> boundaryEdges,
            Set<GridSegment2x> openingEdges,
            Set<CellCoord> floorCells
    ) {

        public LevelDescriptor(
                CellCoord anchorCell,
                Set<CellCoord> fillSeeds,
                Set<GridSegment2x> boundaryEdges,
                Set<GridSegment2x> openingEdges
        ) {
            this(anchorCell, fillSeeds, boundaryEdges, openingEdges, null);
        }

        public LevelDescriptor {
            Set<CellCoord> requestedFloorCells = floorCells == null ? null : normalizeCellSet(floorCells);
            anchorCell = normalizeAnchor(anchorCell);
            boundaryEdges = normalizeBoundaryEdges(boundaryEdges);
            fillSeeds = normalizeSeeds(fillSeeds, anchorCell, !boundaryEdges.isEmpty());
            openingEdges = normalizeOpenings(openingEdges, boundaryEdges);
            floorCells = normalizeFloorCells(hydrateSurfaceCells(fillSeeds, boundaryEdges), requestedFloorCells);
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
            Set<CellCoord> translatedFloorCells = new LinkedHashSet<>();
            for (CellCoord cell : floorCells) {
                translatedFloorCells.add(cell.add(resolvedDelta));
            }
            return new LevelDescriptor(
                    anchorCell.add(resolvedDelta),
                    translatedSeeds,
                    translatedBoundary,
                    translatedOpenings,
                    translatedFloorCells);
        }

        public LevelDescriptor withFloorCells(Collection<CellCoord> floorCells) {
            return new LevelDescriptor(anchorCell, fillSeeds, boundaryEdges, openingEdges, normalizeCellSet(floorCells));
        }

        public LevelDescriptor withOpeningEdges(Collection<GridSegment2x> openingEdges) {
            return new LevelDescriptor(anchorCell, fillSeeds, boundaryEdges, normalizeOpenings(openingEdges, boundaryEdges), floorCells);
        }

        public boolean isEmpty() {
            return fillSeeds.isEmpty() && boundaryEdges.isEmpty() && openingEdges.isEmpty() && floorCells.isEmpty();
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

        private static Set<CellCoord> normalizeCellSet(Collection<CellCoord> cells) {
            return cells == null ? Set.of() : CellCoord.normalize(cells);
        }

        private static Set<GridSegment2x> normalizeBoundaryEdges(Collection<GridSegment2x> segments) {
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
            if (segments != null) {
                segments.stream()
                        .filter(segment -> segment != null)
                        .sorted(GridSegment2x.ORDER)
                        .forEach(segment -> {
                            if (!segment.start().isVertex() || !segment.end().isVertex() || (segment.length2() & 1) != 0) {
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
                    .sorted(GridSegment2x.ORDER)
                    .forEach(result::add);
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }
    }

    private static Set<CellCoord> normalizeFloorCells(
            Set<CellCoord> surfaceCells,
            Collection<CellCoord> floorCells
    ) {
        if (surfaceCells == null || surfaceCells.isEmpty()) {
            return Set.of();
        }
        if (floorCells == null) {
            return surfaceCells;
        }
        Set<CellCoord> normalizedFloorCells = CellCoord.normalize(floorCells);
        if (normalizedFloorCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (CellCoord cell : normalizedFloorCells) {
            if (surfaceCells.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<CellCoord> hydrateSurfaceCells(
            Set<CellCoord> fillSeeds,
            Set<GridSegment2x> boundaryEdges
    ) {
        if (fillSeeds == null || fillSeeds.isEmpty()) {
            return Set.of();
        }
        if (boundaryEdges == null || boundaryEdges.isEmpty()) {
            return Set.copyOf(fillSeeds);
        }
        Set<GridSegment2x> blockedSegments = GridSegment2x.boundarySteps(boundaryEdges);
        if (blockedSegments.isEmpty()) {
            return Set.copyOf(fillSeeds);
        }
        CellBounds bounds = cellBounds(boundaryEdges, fillSeeds);
        ArrayDeque<CellCoord> queue = new ArrayDeque<>(fillSeeds);
        LinkedHashSet<CellCoord> visited = new LinkedHashSet<>();
        while (!queue.isEmpty()) {
            CellCoord current = queue.removeFirst();
            if (!bounds.contains(current) || !visited.add(current)) {
                continue;
            }
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = current.add(step);
                if (!bounds.contains(neighbor)
                        || blockedSegments.contains(GridSegment2x.boundaryEdge(current, current.directionTo4(neighbor)))) {
                    continue;
                }
                queue.addLast(neighbor);
            }
        }
        return visited.isEmpty() ? Set.of() : Set.copyOf(visited);
    }

    private static CellBounds cellBounds(Set<GridSegment2x> boundaryEdges, Set<CellCoord> seeds) {
        int minX = seeds.stream().mapToInt(CellCoord::x).min().orElse(0);
        int maxX = seeds.stream().mapToInt(CellCoord::x).max().orElse(0);
        int minY = seeds.stream().mapToInt(CellCoord::y).min().orElse(0);
        int maxY = seeds.stream().mapToInt(CellCoord::y).max().orElse(0);
        for (GridSegment2x segment : boundaryEdges == null ? Set.<GridSegment2x>of() : boundaryEdges) {
            for (CellCoord cell : segment.touchingCells()) {
                minX = Math.min(minX, cell.x());
                maxX = Math.max(maxX, cell.x());
                minY = Math.min(minY, cell.y());
                maxY = Math.max(maxY, cell.y());
            }
        }
        return new CellBounds(minX, minY, maxX, maxY);
    }

    private record CellBounds(int minX, int minY, int maxX, int maxY) {
        private boolean contains(CellCoord cell) {
            return cell != null
                    && cell.x() >= minX
                    && cell.x() <= maxX
                    && cell.y() >= minY
                    && cell.y() <= maxY;
        }
    }
}

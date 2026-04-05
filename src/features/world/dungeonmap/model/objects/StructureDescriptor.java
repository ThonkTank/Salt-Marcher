package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical per-level structure input reduced to authored seeds plus shape-based tile and edge surfaces.
 *
 * <p>Surface ownership is exposed through {@link TileShape} and {@link EdgeShape}. The seed set remains authored
 * metadata for persistence and flood-fill reconstruction, not a second public geometry contract.</p>
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

    public static final class LevelDescriptor {

        private final CellCoord anchorCell;
        private final Set<CellCoord> fillSeeds;
        private final TileShape surfaceShape;
        private final TileShape floorShape;
        private final EdgeShape boundaryShape;
        private final EdgeShape openingShape;

        public LevelDescriptor(
                CellCoord anchorCell,
                Set<CellCoord> fillSeeds,
                Set<GridSegment2x> boundaryEdges,
                Set<GridSegment2x> openingEdges,
                Set<CellCoord> floorCells
        ) {
            Set<CellCoord> requestedFloorCells = floorCells == null ? null : normalizeCellSet(floorCells);
            this.anchorCell = normalizeAnchor(anchorCell);
            Set<GridSegment2x> normalizedBoundaryEdges = normalizeBoundaryEdges(boundaryEdges);
            this.boundaryShape = normalizedBoundaryEdges.isEmpty() ? EdgeShape.empty() : new EdgeShape(normalizedBoundaryEdges);
            this.fillSeeds = normalizeSeeds(fillSeeds, this.anchorCell, !normalizedBoundaryEdges.isEmpty());
            Set<GridSegment2x> normalizedOpenings = normalizeOpenings(openingEdges, this.boundaryShape.segmentSet2x());
            this.openingShape = normalizedOpenings.isEmpty() ? EdgeShape.empty() : new EdgeShape(normalizedOpenings);
            TileShape resolvedSurfaceShape = new TileShape(hydrateSurfaceCells(this.fillSeeds, normalizedBoundaryEdges));
            this.surfaceShape = resolvedSurfaceShape.isEmpty() ? TileShape.empty() : resolvedSurfaceShape;
            Set<CellCoord> normalizedFloorCells = normalizeFloorCells(this.surfaceShape.cellCoords(), requestedFloorCells);
            this.floorShape = normalizedFloorCells.isEmpty() ? TileShape.empty() : new TileShape(normalizedFloorCells);
        }

        public LevelDescriptor(
                CellCoord anchorCell,
                Set<CellCoord> fillSeeds,
                Set<GridSegment2x> boundaryEdges,
                Set<GridSegment2x> openingEdges
        ) {
            this(anchorCell, fillSeeds, boundaryEdges, openingEdges, null);
        }

        public CellCoord anchorCell() {
            return anchorCell;
        }

        public Set<CellCoord> fillSeeds() {
            return fillSeeds;
        }

        public TileShape surfaceShape() {
            return surfaceShape;
        }

        public TileShape floorShape() {
            return floorShape;
        }

        public EdgeShape boundaryShape() {
            return boundaryShape;
        }

        public EdgeShape openingShape() {
            return openingShape;
        }

        public Set<GridSegment2x> boundaryEdges() {
            return boundaryShape.segmentSet2x();
        }

        public Set<GridSegment2x> openingEdges() {
            return openingShape.segmentSet2x();
        }

        public Set<CellCoord> floorCells() {
            return floorShape.cellCoords();
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
            Set<CellCoord> translatedFloorCells = new LinkedHashSet<>();
            for (CellCoord cell : floorCells()) {
                translatedFloorCells.add(cell.add(resolvedDelta));
            }
            return new LevelDescriptor(
                    anchorCell.add(resolvedDelta),
                    translatedSeeds,
                    boundaryShape.translatedByCells(resolvedDelta, 0).segmentSet2x(),
                    openingShape.translatedByCells(resolvedDelta, 0).segmentSet2x(),
                    translatedFloorCells);
        }

        public LevelDescriptor withFloorCells(Collection<CellCoord> floorCells) {
            return new LevelDescriptor(anchorCell, fillSeeds, boundaryEdges(), openingEdges(), normalizeCellSet(floorCells));
        }

        public LevelDescriptor withOpeningEdges(Collection<GridSegment2x> openingEdges) {
            return new LevelDescriptor(anchorCell, fillSeeds, boundaryEdges(), normalizeOpenings(openingEdges, boundaryEdges()), floorCells());
        }

        public boolean isEmpty() {
            return fillSeeds.isEmpty()
                    && boundaryShape.isEmpty()
                    && openingShape.isEmpty()
                    && floorShape.isEmpty();
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof LevelDescriptor that)) {
                return false;
            }
            return Objects.equals(anchorCell, that.anchorCell)
                    && Objects.equals(fillSeeds, that.fillSeeds)
                    && Objects.equals(boundaryEdges(), that.boundaryEdges())
                    && Objects.equals(openingEdges(), that.openingEdges())
                    && Objects.equals(floorCells(), that.floorCells());
        }

        @Override
        public int hashCode() {
            return Objects.hash(anchorCell, fillSeeds, boundaryEdges(), openingEdges(), floorCells());
        }

        @Override
        public String toString() {
            return "LevelDescriptor[anchorCell=" + anchorCell
                    + ", fillSeeds=" + fillSeeds
                    + ", boundaryEdges=" + boundaryEdges()
                    + ", openingEdges=" + openingEdges()
                    + ", floorCells=" + floorCells()
                    + "]";
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
            if (openings == null || openings.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
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

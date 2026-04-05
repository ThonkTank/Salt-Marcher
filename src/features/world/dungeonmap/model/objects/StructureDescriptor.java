package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical per-level structure input reduced to shape-based tile and edge surfaces.
 *
 * <p>Surface ownership is exposed through {@link TileShape} and {@link EdgeShape}. Boundary cells may be reconstructed
 * from boundary edges, but there is no second seed-driven geometry truth.</p>
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
                    Set<CellCoord> normalizedCells = CellCoord.normalize(entry.getValue());
                    if (normalizedCells.isEmpty()) {
                        return;
                    }
                    LevelDescriptor level = LevelDescriptor.fromSurfaceCells(
                            CellCoord.bestCenter(normalizedCells),
                            normalizedCells,
                            Set.of(),
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

    public static final class LevelDescriptor {

        private final CellCoord anchorCell;
        private final TileShape surfaceShape;
        private final TileShape floorShape;
        private final EdgeShape boundaryShape;
        private final EdgeShape openingShape;

        private LevelDescriptor(
                CellCoord anchorCell,
                TileShape surfaceShape,
                EdgeShape boundaryShape,
                EdgeShape openingShape,
                TileShape floorShape
        ) {
            this.surfaceShape = surfaceShape == null ? TileShape.empty() : surfaceShape;
            this.boundaryShape = boundaryShape == null ? EdgeShape.empty() : boundaryShape;
            this.openingShape = openingShape == null ? EdgeShape.empty() : openingShape;
            this.floorShape = floorShape == null ? TileShape.empty() : floorShape;
            this.anchorCell = normalizeAnchor(anchorCell, this.surfaceShape);
        }

        public static LevelDescriptor fromSurfaceCells(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<GridSegment2x> openingEdges,
                Collection<CellCoord> floorCells
        ) {
            TileShape surfaceShape = new TileShape(surfaceCells);
            EdgeShape boundaryShape = surfaceShape.boundaryShape();
            EdgeShape openingShape = normalizedOpeningShape(openingEdges, boundaryShape.segmentSet2x());
            TileShape floorShape = new TileShape(normalizeFloorCells(surfaceShape.cellCoords(), floorCells));
            return new LevelDescriptor(anchorCell, surfaceShape, boundaryShape, openingShape, floorShape);
        }

        public static LevelDescriptor fromSurfaceCells(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<GridSegment2x> openingEdges
        ) {
            return fromSurfaceCells(anchorCell, surfaceCells, openingEdges, null);
        }

        public static LevelDescriptor fromBoundaryEdges(
                CellCoord anchorCell,
                Collection<GridSegment2x> boundaryEdges,
                Collection<GridSegment2x> openingEdges,
                Collection<CellCoord> floorCells
        ) {
            EdgeShape boundaryShape = boundaryEdges == null
                    ? EdgeShape.empty()
                    : EdgeShape.fromBoundarySegments(boundaryEdges);
            TileShape surfaceShape = new TileShape(hydrateSurfaceCells(boundaryShape.segmentSet2x()));
            EdgeShape openingShape = normalizedOpeningShape(openingEdges, boundaryShape.segmentSet2x());
            TileShape floorShape = new TileShape(normalizeFloorCells(surfaceShape.cellCoords(), floorCells));
            return new LevelDescriptor(anchorCell, surfaceShape, boundaryShape, openingShape, floorShape);
        }

        public static LevelDescriptor fromBoundaryEdges(
                CellCoord anchorCell,
                Collection<GridSegment2x> boundaryEdges,
                Collection<GridSegment2x> openingEdges
        ) {
            return fromBoundaryEdges(anchorCell, boundaryEdges, openingEdges, null);
        }

        public CellCoord anchorCell() {
            return anchorCell;
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
            return new LevelDescriptor(
                    anchorCell.add(resolvedDelta),
                    surfaceShape.translatedByCells(resolvedDelta),
                    boundaryShape.translatedByCells(resolvedDelta),
                    openingShape.translatedByCells(resolvedDelta),
                    floorShape.translatedByCells(resolvedDelta));
        }

        public LevelDescriptor withFloorCells(Collection<CellCoord> floorCells) {
            return fromSurfaceCells(anchorCell, surfaceShape.cellCoords(), openingEdges(), normalizeFloorCells(surfaceShape.cellCoords(), floorCells));
        }

        public LevelDescriptor withOpeningEdges(Collection<GridSegment2x> openingEdges) {
            return fromSurfaceCells(anchorCell, surfaceShape.cellCoords(), openingEdges, floorCells());
        }

        public boolean isEmpty() {
            return surfaceShape.isEmpty()
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
                    && Objects.equals(surfaceShape.cellCoords(), that.surfaceShape.cellCoords())
                    && Objects.equals(openingEdges(), that.openingEdges())
                    && Objects.equals(floorCells(), that.floorCells());
        }

        @Override
        public int hashCode() {
            return Objects.hash(anchorCell, surfaceShape.cellCoords(), openingEdges(), floorCells());
        }

        @Override
        public String toString() {
            return "LevelDescriptor[anchorCell=" + anchorCell
                    + ", surfaceCells=" + surfaceShape.cellCoords()
                    + ", boundaryEdges=" + boundaryEdges()
                    + ", openingEdges=" + openingEdges()
                    + ", floorCells=" + floorCells()
                    + "]";
        }

        private static EdgeShape normalizedOpeningShape(
                Collection<GridSegment2x> openings,
                Set<GridSegment2x> boundaryEdges
        ) {
            if (openings == null || openings.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
                return EdgeShape.empty();
            }
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
            openings.stream()
                    .filter(segment -> segment != null && boundaryEdges.contains(segment))
                    .sorted(GridSegment2x.ORDER)
                    .forEach(result::add);
            return result.isEmpty() ? EdgeShape.empty() : new EdgeShape(result);
        }

        private static CellCoord normalizeAnchor(CellCoord anchorCell, TileShape surfaceShape) {
            if (anchorCell != null) {
                return anchorCell;
            }
            CellCoord centerCell = surfaceShape == null ? null : surfaceShape.centerCellCoord();
            return centerCell == null ? new CellCoord(0, 0) : centerCell;
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

    private static Set<CellCoord> hydrateSurfaceCells(Set<GridSegment2x> boundaryEdges) {
        Set<GridSegment2x> normalizedBoundaryEdges = GridSegment2x.boundarySteps(boundaryEdges);
        if (normalizedBoundaryEdges.isEmpty()) {
            return Set.of();
        }
        CellBounds bounds = cellBounds(normalizedBoundaryEdges);
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (int y = bounds.minY(); y <= bounds.maxY(); y++) {
            for (int x = bounds.minX(); x <= bounds.maxX(); x++) {
                CellCoord candidate = new CellCoord(x, y);
                if (isInsideEvenOdd(candidate, normalizedBoundaryEdges)) {
                    result.add(candidate);
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static boolean isInsideEvenOdd(CellCoord cell, Set<GridSegment2x> boundaryEdges) {
        int centerX2 = cell.x() * 2;
        int centerY2 = cell.y() * 2;
        long crossings = boundaryEdges.stream()
                .filter(GridSegment2x::isVertical)
                .filter(segment -> segment.start().y2() < centerY2 && segment.end().y2() > centerY2)
                .filter(segment -> segment.start().x2() > centerX2)
                .count();
        return (crossings & 1L) == 1L;
    }

    private static CellBounds cellBounds(Set<GridSegment2x> boundaryEdges) {
        int minX = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (GridSegment2x segment : boundaryEdges) {
            for (CellCoord cell : segment.touchingCells()) {
                minX = Math.min(minX, cell.x());
                maxX = Math.max(maxX, cell.x());
                minY = Math.min(minY, cell.y());
                maxY = Math.max(maxY, cell.y());
            }
        }
        if (minX == Integer.MAX_VALUE) {
            return new CellBounds(0, 0, -1, -1);
        }
        return new CellBounds(minX, minY, maxX, maxY);
    }

    private record CellBounds(int minX, int minY, int maxX, int maxY) {
    }
}

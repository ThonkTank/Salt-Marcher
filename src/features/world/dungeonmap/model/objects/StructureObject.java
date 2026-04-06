package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TilePath;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Shared topology orchestrator over shape-backed floor, wall, door, and stair objects.
 */
public final class StructureObject {

    public record StairStop(CubePoint position, String label) {
    }

    private final Map<Integer, LevelStructure> levelsByZ;
    private final Stair stair;

    public static StructureObject empty() {
        return new StructureObject(Map.of(), null);
    }

    public static StructureObject fromLevels(Map<Integer, LevelStructure> levelsByZ) {
        if (levelsByZ == null || levelsByZ.isEmpty()) {
            return empty();
        }
        return new StructureObject(levelsByZ, null);
    }

    public static StructureObject fromCubePoints(Collection<CubePoint> cubePoints) {
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
        return fromSurfaceCellsByLevel(cellsByLevel, Map.of(), Map.of(), Map.of());
    }

    public static StructureObject fromSurfaceCellsByLevel(
            Map<Integer, ? extends Collection<CellCoord>> cellsByLevel,
            Map<Integer, ? extends Collection<GridSegment2x>> openingEdgesByLevel,
            Map<Integer, ? extends Collection<CellCoord>> floorCellsByLevel,
            Map<Integer, CellCoord> anchorsByLevel
    ) {
        if (cellsByLevel == null || cellsByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, LevelStructure> levels = new LinkedHashMap<>();
        cellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    int levelZ = entry.getKey();
                    LevelStructure level = LevelStructure.fromSurfaceCells(
                            anchorsByLevel == null ? null : anchorsByLevel.get(levelZ),
                            entry.getValue(),
                            openingEdgesByLevel == null ? null : openingEdgesByLevel.get(levelZ),
                            floorCellsByLevel == null ? null : floorCellsByLevel.get(levelZ));
                    if (!level.isEmpty()) {
                        levels.put(levelZ, level);
                    }
                });
        return levels.isEmpty() ? empty() : fromLevels(levels);
    }

    public static StructureObject fromBoundaryEdgesByLevel(
            Map<Integer, ? extends Collection<GridSegment2x>> boundaryEdgesByLevel,
            Map<Integer, ? extends Collection<GridSegment2x>> openingEdgesByLevel,
            Map<Integer, ? extends Collection<CellCoord>> floorCellsByLevel,
            Map<Integer, CellCoord> anchorsByLevel
    ) {
        if (boundaryEdgesByLevel == null || boundaryEdgesByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, LevelStructure> levels = new LinkedHashMap<>();
        boundaryEdgesByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    int levelZ = entry.getKey();
                    LevelStructure level = LevelStructure.fromBoundaryEdges(
                            anchorsByLevel == null ? null : anchorsByLevel.get(levelZ),
                            entry.getValue(),
                            openingEdgesByLevel == null ? null : openingEdgesByLevel.get(levelZ),
                            floorCellsByLevel == null ? null : floorCellsByLevel.get(levelZ));
                    if (!level.isEmpty()) {
                        levels.put(levelZ, level);
                    }
                });
        return levels.isEmpty() ? empty() : fromLevels(levels);
    }

    public static StructureObject fromTilePath(TilePath path, Set<Integer> stopLevels) {
        if (path == null || path.isEmpty()) {
            return empty();
        }
        return fromStair(Stair.of(path, stopLevels));
    }

    public static StructureObject fromPathPoints(Collection<CubePoint> pathPoints, Set<Integer> stopLevels) {
        if (pathPoints == null || pathPoints.isEmpty()) {
            return empty();
        }
        return fromTilePath(TilePath.of(pathPoints), stopLevels);
    }

    public static StructureObject fromStair(Stair stair) {
        if (stair == null) {
            return empty();
        }
        return new StructureObject(Map.of(), stair);
    }

    private StructureObject(
            Map<Integer, LevelStructure> levelsByZ,
            Stair stair
    ) {
        this.levelsByZ = normalizeLevels(levelsByZ);
        this.stair = stair;
    }

    public Map<Integer, LevelStructure> levelStructures() {
        return levelsByZ;
    }

    public LevelStructure levelStructure(int levelZ) {
        return levelsByZ.get(levelZ);
    }

    public StructureObject projectedToLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        Stair projectedStair = stair == null || !stair.levels().contains(levelZ)
                ? null
                : Stair.of(
                        stair.path().stream()
                                .filter(point -> point != null && point.z() == levelZ)
                                .toList(),
                        Set.of(levelZ));
        if (level == null && projectedStair == null) {
            return empty();
        }
        return new StructureObject(level == null ? Map.of() : Map.of(levelZ, level), projectedStair);
    }

    public StructureObject withOpeningEdgesAtLevel(int levelZ, Collection<GridSegment2x> openingEdges) {
        LevelStructure level = levelStructure(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withOpeningEdges(openingEdges));
        return new StructureObject(updated, stair);
    }

    public StructureObject withFloorCellsAtLevel(int levelZ, Collection<CellCoord> floorCells) {
        LevelStructure level = levelStructure(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withFloorCells(floorCells));
        return new StructureObject(updated, stair);
    }

    public TileShape surfaceShapeAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        TileShape descriptorShape = level == null ? TileShape.empty() : level.surfaceShape();
        TileShape stairShape = stairShapeAtLevel(levelZ);
        if (descriptorShape.isEmpty()) {
            return stairShape;
        }
        if (stairShape.isEmpty()) {
            return descriptorShape;
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>(descriptorShape.cellCoords());
        result.addAll(stairShape.cellCoords());
        return new TileShape(result);
    }

    public List<Wall> wallsAtLevel(int levelZ) {
        EdgeShape wallShape = wallShapeAtLevel(levelZ);
        if (wallShape.isEmpty()) {
            return List.of();
        }
        return wallShape.connectedComponents().stream()
                .map(Wall::fromShape)
                .toList();
    }

    public List<Door> doorsAtLevel(int levelZ) {
        EdgeShape openingShape = openingShapeAtLevel(levelZ);
        if (openingShape.isEmpty()) {
            return List.of();
        }
        return openingShape.connectedComponents().stream()
                .map(component -> Door.fromShape(component, Door.DoorState.OPEN))
                .toList();
    }

    public List<EdgeShape> wallComponentShapesAtLevel(int levelZ) {
        return wallShapeAtLevel(levelZ).connectedComponents();
    }

    public List<EdgeShape> doorComponentShapesAtLevel(int levelZ) {
        return openingShapeAtLevel(levelZ).connectedComponents();
    }

    public Set<GridSegment2x> wallSegmentsAtLevel(int levelZ) {
        return wallShapeAtLevel(levelZ).segmentSet2x();
    }

    public Set<GridSegment2x> doorSegmentsAtLevel(int levelZ) {
        return openingShapeAtLevel(levelZ).segmentSet2x();
    }

    public Floor floorAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? null : new Floor(level.floorShape());
    }

    public List<Stair> stairs() {
        return stair == null ? List.of() : List.of(stair);
    }

    public Stair stair() {
        return stair;
    }

    public List<CubePoint> stairPath() {
        Stair stair = stair();
        return stair == null ? List.of() : stair.path();
    }

    public Set<Integer> stairStopLevels() {
        Stair stair = stair();
        return stair == null ? Set.of() : stair.stopLevels();
    }

    public List<StairStop> stairStops() {
        Stair stair = stair();
        if (stair == null) {
            return List.of();
        }
        return stair.exits().stream()
                .map(exit -> new StairStop(exit.position(), exit.label()))
                .toList();
    }

    public List<StairStop> stairStopsAtLevel(int levelZ) {
        return stairStops().stream()
                .filter(stop -> stop.position() != null && stop.position().z() == levelZ)
                .toList();
    }

    public Set<Integer> levels() {
        LinkedHashSet<Integer> result = new LinkedHashSet<>(levelsByZ.keySet());
        if (stair != null) {
            result.addAll(stair.levels());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public List<Integer> relevantLevels(CellCoord focusCell, int focusLevelZ) {
        if (focusCell != null && contains(focusCell, focusLevelZ)) {
            return List.of(focusLevelZ);
        }
        return levels().stream()
                .sorted()
                .toList();
    }

    public int primaryLevel() {
        return levels().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public CellCoord centerCellCoordAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        if (floor != null && !floor.cellCoords().isEmpty()) {
            return floor.centerCellCoord();
        }
        return surfaceCenterCellCoordAtLevel(levelZ);
    }

    public CubePoint centerPointAtLevel(int levelZ) {
        CellCoord centerCell = centerCellCoordAtLevel(levelZ);
        return centerCell == null ? null : CubePoint.at(centerCell, levelZ);
    }

    public EdgeShape boundaryShapeAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? EdgeShape.empty() : level.boundaryShape();
    }

    public EdgeShape openingShapeAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? EdgeShape.empty() : level.openingShape();
    }

    public Set<GridSegment2x> boundaryEdgesAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? Set.of() : level.boundaryEdges();
    }

    public Set<GridSegment2x> openingEdgesAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? Set.of() : level.openingEdges();
    }

    public Set<CellCoord> cellCoords() {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (Integer levelZ : levels()) {
            result.addAll(cellCoordsAtLevel(levelZ));
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<CellCoord> cellCoordsAtLevel(int levelZ) {
        return surfaceShapeAtLevel(levelZ).cellCoords();
    }

    public Set<CellCoord> floorCellCoordsAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        return floor == null ? Set.of() : floor.cellCoords();
    }

    public Set<CubePoint> cubePoints() {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            result.addAll(entry.getValue().surfaceShape().cubePoints(entry.getKey()));
        }
        if (stair != null) {
            result.addAll(stair.pointSet());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && levels().stream().anyMatch(levelZ -> contains(cell, levelZ));
    }

    public boolean contains(CellCoord cell, int levelZ) {
        return cell != null && surfaceShapeAtLevel(levelZ).contains(cell);
    }

    public boolean contains(CubePoint point) {
        return point != null && contains(point.projectedCell(), point.z());
    }

    public boolean hasFloorCell(CellCoord cell, int levelZ) {
        return cell != null && floorCellCoordsAtLevel(levelZ).contains(cell);
    }

    public CellCoord anchorCellCoordAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        if (level != null) {
            return level.anchorCell();
        }
        TileShape stairShape = stairShapeAtLevel(levelZ);
        return stairShape.isEmpty() ? null : stairShape.centerCellCoord();
    }

    public CellCoord surfaceCenterCellCoordAtLevel(int levelZ) {
        Set<CellCoord> surfaceCells = cellCoordsAtLevel(levelZ);
        return surfaceCells.isEmpty() ? null : CellCoord.bestCenter(surfaceCells);
    }

    public StructureObject movedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0 && levelDelta == 0) {
            return this;
        }
        Map<Integer, LevelStructure> translatedLevels = new LinkedHashMap<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            translatedLevels.put(entry.getKey() + levelDelta, entry.getValue().translatedByCells(resolvedDelta));
        }
        Stair translatedStair = stair == null ? null : stair.movedBy(resolvedDelta, levelDelta);
        return new StructureObject(translatedLevels, translatedStair);
    }

    private TileShape stairShapeAtLevel(int levelZ) {
        return stair == null ? TileShape.empty() : stair.shapeAtLevel(levelZ);
    }

    private EdgeShape wallShapeAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? EdgeShape.empty() : level.wallShape();
    }

    private static Map<Integer, LevelStructure> normalizeLevels(Map<Integer, LevelStructure> levelsByZ) {
        if (levelsByZ == null || levelsByZ.isEmpty()) {
            return Map.of();
        }
        Map<Integer, LevelStructure> result = new LinkedHashMap<>();
        levelsByZ.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureObject that)) {
            return false;
        }
        return Objects.equals(levelsByZ, that.levelsByZ)
                && Objects.equals(stair, that.stair);
    }

    @Override
    public int hashCode() {
        return Objects.hash(levelsByZ, stair);
    }

    @Override
    public String toString() {
        return "StructureObject[levelsByZ=" + levelsByZ + ", stair=" + stair + "]";
    }

    public static final class LevelStructure {

        private final CellCoord anchorCell;
        private final TileShape surfaceShape;
        private final TileShape floorShape;
        private final EdgeShape boundaryShape;
        private final EdgeShape openingShape;

        private LevelStructure(
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

        public static LevelStructure fromSurfaceCells(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<GridSegment2x> openingEdges,
                Collection<CellCoord> floorCells
        ) {
            TileShape surfaceShape = TileShape.of(surfaceCells);
            EdgeShape boundaryShape = surfaceShape.boundaryShape();
            EdgeShape openingShape = boundaryShape.intersection(openingEdges);
            TileShape floorShape = surfaceShape.intersection(floorCells);
            return new LevelStructure(anchorCell, surfaceShape, boundaryShape, openingShape, floorShape);
        }

        public static LevelStructure fromBoundaryEdges(
                CellCoord anchorCell,
                Collection<GridSegment2x> boundaryEdges,
                Collection<GridSegment2x> openingEdges,
                Collection<CellCoord> floorCells
        ) {
            EdgeShape boundaryShape = boundaryEdges == null
                    ? EdgeShape.empty()
                    : EdgeShape.fromBoundarySegments(boundaryEdges);
            TileShape surfaceShape = boundaryShape.surfaceShape();
            EdgeShape openingShape = boundaryShape.intersection(openingEdges);
            TileShape floorShape = surfaceShape.intersection(floorCells);
            return new LevelStructure(anchorCell, surfaceShape, boundaryShape, openingShape, floorShape);
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

        public EdgeShape wallShape() {
            return boundaryShape.without(openingShape.segments2x());
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

        public LevelStructure translatedByCells(CellCoord delta) {
            CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
            if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
                return this;
            }
            return new LevelStructure(
                    anchorCell.add(resolvedDelta),
                    surfaceShape.translatedByCells(resolvedDelta),
                    boundaryShape.translatedByCells(resolvedDelta),
                    openingShape.translatedByCells(resolvedDelta),
                    floorShape.translatedByCells(resolvedDelta));
        }

        public LevelStructure withFloorCells(Collection<CellCoord> floorCells) {
            return fromSurfaceCells(anchorCell, surfaceShape.cellCoords(), openingEdges(), floorCells);
        }

        public LevelStructure withOpeningEdges(Collection<GridSegment2x> openingEdges) {
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
            if (!(other instanceof LevelStructure that)) {
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
            return "LevelStructure[anchorCell=" + anchorCell
                    + ", surfaceCells=" + surfaceShape.cellCoords()
                    + ", boundaryEdges=" + boundaryEdges()
                    + ", openingEdges=" + openingEdges()
                    + ", floorCells=" + floorCells()
                    + "]";
        }

        private static CellCoord normalizeAnchor(CellCoord anchorCell, TileShape surfaceShape) {
            if (anchorCell != null) {
                return anchorCell;
            }
            CellCoord centerCell = surfaceShape == null ? null : surfaceShape.centerCellCoord();
            return centerCell == null ? new CellCoord(0, 0) : centerCell;
        }
    }
}

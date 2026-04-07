package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Shared topology orchestrator over shape-backed floor, wall, and door objects.
 */
public final class Structure {

    public record PersistenceSnapshot(Map<Integer, PersistenceLevel> levelsByZ) {
        public PersistenceSnapshot {
            levelsByZ = levelsByZ == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(levelsByZ));
        }
    }

    public record PersistenceLevel(
            CellCoord anchorCell,
            Set<CellCoord> surfaceCells,
            Set<CellCoord> floorCells,
            List<Wall> authoredWalls,
            List<Door> doors
    ) {
        public PersistenceLevel {
            surfaceCells = surfaceCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(surfaceCells));
            floorCells = floorCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(floorCells));
            authoredWalls = authoredWalls == null ? List.of() : List.copyOf(authoredWalls);
            doors = doors == null ? List.of() : List.copyOf(doors);
        }
    }

    private final Map<Integer, LevelStructure> levelsByZ;
    private final StructureRoomTopology roomTopology;

    public static Structure empty() {
        return new Structure(Map.of(), null);
    }

    public static Structure fromLevels(Map<Integer, LevelStructure> levelsByZ) {
        if (levelsByZ == null || levelsByZ.isEmpty()) {
            return empty();
        }
        return new Structure(levelsByZ, null);
    }

    public static Structure fromCubePoints(Collection<CubePoint> cubePoints) {
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
        return fromSurfaceCellsByLevel(cellsByLevel, Map.of(), Map.of());
    }

    public static Structure fromSurfaceCellsByLevel(
            Map<Integer, ? extends Collection<CellCoord>> cellsByLevel,
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
                            floorCellsByLevel == null ? null : floorCellsByLevel.get(levelZ));
                    if (!level.isEmpty()) {
                        levels.put(levelZ, level);
                    }
                });
        return levels.isEmpty() ? empty() : fromLevels(levels);
    }

    public static Structure fromTopologyByLevel(
            Map<Integer, ? extends Collection<CellCoord>> surfaceCellsByLevel,
            Map<Integer, ? extends Collection<GridSegment2x>> boundaryEdgesByLevel,
            Map<Integer, ? extends Collection<CellCoord>> floorCellsByLevel,
            Map<Integer, CellCoord> anchorsByLevel
    ) {
        if (surfaceCellsByLevel == null || surfaceCellsByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, LevelStructure> levels = new LinkedHashMap<>();
        surfaceCellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    int levelZ = entry.getKey();
                    LevelStructure level = LevelStructure.fromTopology(
                            anchorsByLevel == null ? null : anchorsByLevel.get(levelZ),
                            entry.getValue(),
                            boundaryEdgesByLevel == null ? null : boundaryEdgesByLevel.get(levelZ),
                            floorCellsByLevel == null ? null : floorCellsByLevel.get(levelZ));
                    if (!level.isEmpty()) {
                        levels.put(levelZ, level);
                    }
                });
        return levels.isEmpty() ? empty() : fromLevels(levels);
    }

    public static Structure fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
        if (snapshot == null || snapshot.levelsByZ().isEmpty()) {
            return empty();
        }
        Map<Integer, LevelStructure> levels = new LinkedHashMap<>();
        snapshot.levelsByZ().entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    int levelZ = entry.getKey();
                    PersistenceLevel persistedLevel = entry.getValue();
                    LevelStructure level = persistedLevel == null
                            ? null
                            : LevelStructure.fromSurfaceAndFeatures(
                            persistedLevel.anchorCell(),
                            persistedLevel.surfaceCells(),
                            persistedLevel.doors(),
                            persistedLevel.authoredWalls(),
                            persistedLevel.floorCells());
                    if (!level.isEmpty()) {
                        levels.put(levelZ, level);
                    }
                });
        return levels.isEmpty() ? empty() : fromLevels(levels);
    }

    private Structure(
            Map<Integer, LevelStructure> levelsByZ
    ) {
        this(levelsByZ, null);
    }

    private Structure(
            Map<Integer, LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        this.levelsByZ = normalizeLevels(levelsByZ);
        this.roomTopology = roomTopology;
    }

    public Map<Integer, LevelStructure> levelStructures() {
        return levelsByZ;
    }

    public StructureRoomTopology roomTopology() {
        return roomTopology;
    }

    public Structure withRoomMetadata(long mapId, Long clusterId, List<Room> rooms) {
        return new Structure(levelsByZ, StructureRoomTopology.derive(mapId, clusterId, this, rooms));
    }

    public List<Room> rooms() {
        return roomTopology == null ? List.of() : roomTopology.rooms();
    }

    public List<DungeonConnection> localRoomConnections() {
        return roomTopology == null ? List.of() : roomTopology.localConnections();
    }

    private Structure reattachedWithSameRooms(Structure structure) {
        if (roomTopology == null || structure == null || structure.levelStructures().isEmpty()) {
            return structure;
        }
        return structure.withRoomMetadata(roomTopology.mapId(), roomTopology.clusterId(), roomTopology.rooms());
    }

    private static Structure reattachTopology(Structure structure, StructureRoomTopology topology) {
        if (structure == null || topology == null || structure.levelStructures().isEmpty()) {
            return structure;
        }
        return new Structure(structure.levelsByZ, topology);
    }

    public PersistenceSnapshot persistenceSnapshot() {
        Map<Integer, PersistenceLevel> snapshotLevels = new LinkedHashMap<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) {
                continue;
            }
            LevelStructure level = entry.getValue();
            snapshotLevels.put(entry.getKey(), new PersistenceLevel(
                    level.anchorCell(),
                    level.surfaceShape().cellCoords(),
                    level.floorCells(),
                    level.boundary().authoredWalls(),
                    level.boundary().doors()));
        }
        return new PersistenceSnapshot(snapshotLevels);
    }

    public LevelStructure levelStructure(int levelZ) {
        return levelsByZ.get(levelZ);
    }

    public Structure projectedToLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        if (level == null) {
            return empty();
        }
        Structure projected = new Structure(Map.of(levelZ, level), null);
        return roomTopology == null
                ? projected
                : reattachTopology(projected, roomTopology.projectedToLevel(levelZ, projected));
    }

    public StructureBoundary boundaryAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? StructureBoundary.empty() : level.boundary();
    }

    public Structure withBoundaryAtLevel(int levelZ, StructureBoundary boundary) {
        LevelStructure level = levelStructure(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withBoundary(boundary));
        return reattachedWithSameRooms(new Structure(updated, null));
    }

    public Structure withFloorCellsAtLevel(int levelZ, Collection<CellCoord> floorCells) {
        LevelStructure level = levelStructure(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withFloorCells(floorCells));
        return reattachedWithSameRooms(new Structure(updated, null));
    }

    public TileShape surfaceShapeAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? TileShape.empty() : level.surfaceShape();
    }

    public Floor floorAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? null : new Floor(level.floorShape());
    }

    public Set<Integer> levels() {
        return levelsByZ.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(levelsByZ.keySet()));
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

    public Map<Integer, Set<CellCoord>> surfaceCellsByLevel() {
        Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
        for (Integer levelZ : levels().stream().sorted().toList()) {
            Set<CellCoord> surfaceCells = cellCoordsAtLevel(levelZ);
            if (!surfaceCells.isEmpty()) {
                result.put(levelZ, surfaceCells);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public Map<Integer, Set<CellCoord>> floorCellsByLevel() {
        Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
        for (Integer levelZ : levels().stream().sorted().toList()) {
            result.put(levelZ, floorCellCoordsAtLevel(levelZ));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public Set<CubePoint> cubePoints() {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            result.addAll(entry.getValue().surfaceShape().cubePoints(entry.getKey()));
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

    public Set<CellCoord> reachableSurfaceFrom(CellCoord anchorCell, int levelZ) {
        if (anchorCell == null || !contains(anchorCell, levelZ)) {
            return Set.of();
        }
        return surfaceShapeAtLevel(levelZ)
                .reachableFrom(anchorCell, boundaryAtLevel(levelZ).boundaryEdges())
                .cellCoords();
    }

    public CellCoord anchorCellCoordAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? null : level.anchorCell();
    }

    public CellCoord surfaceCenterCellCoordAtLevel(int levelZ) {
        Set<CellCoord> surfaceCells = cellCoordsAtLevel(levelZ);
        return surfaceCells.isEmpty() ? null : CellCoord.bestCenter(surfaceCells);
    }

    public Structure clippedToSurface(
            Map<Integer, ? extends Collection<CellCoord>> surfaceCellsByLevel,
            Map<Integer, CellCoord> preferredAnchorsByLevel
    ) {
        if (surfaceCellsByLevel == null || surfaceCellsByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, LevelStructure> levels = new LinkedHashMap<>();
        surfaceCellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    int levelZ = entry.getKey();
                    Set<CellCoord> clippedSurfaceCells = intersectCells(cellCoordsAtLevel(levelZ), entry.getValue());
                    if (clippedSurfaceCells.isEmpty()) {
                        return;
                    }
                    Set<CellCoord> floorCells = intersectCells(floorCellCoordsAtLevel(levelZ), clippedSurfaceCells);
                    StructureBoundary clippedBoundary = boundaryAtLevel(levelZ).clippedToSurface(clippedSurfaceCells);
                    levels.put(levelZ, LevelStructure.fromSurfaceAndFeatures(
                            preferredAnchorsByLevel == null ? null : preferredAnchorsByLevel.get(levelZ),
                            clippedSurfaceCells,
                            clippedBoundary.doors(),
                            clippedBoundary.authoredWalls(),
                            floorCells));
                });
        Structure clipped = levels.isEmpty() ? empty() : new Structure(levels, null);
        return reattachedWithSameRooms(clipped);
    }

    public List<Map<Integer, Set<CellCoord>>> projectedSurfaceComponents() {
        Set<CellCoord> projectedCells = cellCoords();
        if (projectedCells.isEmpty()) {
            return List.of();
        }
        List<Set<CellCoord>> components = connectedProjectedComponents(projectedCells);
        ArrayList<Map<Integer, Set<CellCoord>>> result = new ArrayList<>(components.size());
        for (Set<CellCoord> component : components) {
            Map<Integer, Set<CellCoord>> componentByLevel = new LinkedHashMap<>();
            for (Integer levelZ : levels().stream().sorted().toList()) {
                Set<CellCoord> levelCells = intersectCells(cellCoordsAtLevel(levelZ), component);
                if (!levelCells.isEmpty()) {
                    componentByLevel.put(levelZ, levelCells);
                }
            }
            if (!componentByLevel.isEmpty()) {
                result.add(Map.copyOf(componentByLevel));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public Structure movedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0 && levelDelta == 0) {
            return this;
        }
        Map<Integer, LevelStructure> translatedLevels = new LinkedHashMap<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            translatedLevels.put(entry.getKey() + levelDelta, entry.getValue().translatedByCells(resolvedDelta));
        }
        Structure moved = new Structure(translatedLevels, null);
        return roomTopology == null
                ? moved
                : reattachTopology(moved, roomTopology.translatedBy(resolvedDelta, levelDelta, moved));
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


    private static List<GridPoint2x> assemblePath2x(
            List<GridPoint2x> startAnchorPath,
            List<CellCoord> cellRoute,
            List<GridPoint2x> endAnchorPath
    ) {
        ArrayList<GridPoint2x> result = new ArrayList<>();
        appendUnique(result, startAnchorPath);
        appendUnique(result, cellRoute == null ? List.of() : cellRoute.stream().map(GridPoint2x::cell).toList());
        ArrayList<GridPoint2x> reversedEnd = new ArrayList<>(endAnchorPath == null ? List.of() : endAnchorPath);
        Collections.reverse(reversedEnd);
        appendUnique(result, reversedEnd);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static void appendUnique(List<GridPoint2x> target, List<GridPoint2x> points) {
        if (target == null || points == null) {
            return;
        }
        for (GridPoint2x point : points) {
            if (point == null) {
                continue;
            }
            if (!target.isEmpty() && target.getLast().equals(point)) {
                continue;
            }
            target.add(point);
        }
    }

    private static List<Map<Integer, Set<CellCoord>>> emptyComponentList() {
        return List.of();
    }

    private static List<Set<CellCoord>> connectedProjectedComponents(Collection<CellCoord> cells) {
        Set<CellCoord> remaining = CellCoord.normalize(cells);
        if (remaining.isEmpty()) {
            return List.of();
        }
        ArrayList<Set<CellCoord>> components = new ArrayList<>();
        LinkedHashSet<CellCoord> unvisited = new LinkedHashSet<>(remaining);
        while (!unvisited.isEmpty()) {
            CellCoord seed = unvisited.iterator().next();
            ArrayDeque<CellCoord> queue = new ArrayDeque<>();
            LinkedHashSet<CellCoord> component = new LinkedHashSet<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                CellCoord current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                    CellCoord neighbor = current.add(step);
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            components.add(Set.copyOf(component));
        }
        return components.isEmpty() ? List.of() : List.copyOf(components);
    }

    private static Set<CellCoord> intersectCells(Collection<CellCoord> left, Collection<CellCoord> right) {
        if (left == null || right == null) {
            return Set.of();
        }
        Set<CellCoord> rightSet = right instanceof Set<CellCoord> set ? set : new LinkedHashSet<>(right);
        if (rightSet.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (CellCoord cell : left) {
            if (rightSet.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Structure that)) {
            return false;
        }
        return Objects.equals(levelsByZ, that.levelsByZ)
                && Objects.equals(roomTopology, that.roomTopology);
    }

    @Override
    public int hashCode() {
        return Objects.hash(levelsByZ, roomTopology);
    }

    @Override
    public String toString() {
        return "Structure[levelsByZ=" + levelsByZ
                + ", roomTopology=" + roomTopology + "]";
    }

    public static final class LevelStructure {

        private final CellCoord anchorCell;
        private final TileShape surfaceShape;
        private final TileShape floorShape;
        private final StructureBoundary boundary;

        private LevelStructure(
                CellCoord anchorCell,
                TileShape surfaceShape,
                StructureBoundary boundary,
                TileShape floorShape
        ) {
            this.surfaceShape = surfaceShape == null ? TileShape.empty() : surfaceShape;
            this.floorShape = floorShape == null ? TileShape.empty() : floorShape;
            this.boundary = boundary == null ? StructureBoundary.empty() : boundary;
            this.anchorCell = normalizeAnchor(anchorCell, this.surfaceShape);
        }

        public static LevelStructure fromSurfaceCells(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<CellCoord> floorCells
        ) {
            return fromSurfaceAndFeatures(
                    anchorCell,
                    surfaceCells,
                    List.of(),
                    List.of(),
                    floorCells);
        }

        public static LevelStructure fromSurfaceAndFeatures(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<Door> doors,
                Collection<Wall> walls,
                Collection<CellCoord> floorCells
        ) {
            TileShape surfaceShape = TileShape.of(surfaceCells);
            if (surfaceShape.isEmpty()) {
                return new LevelStructure(anchorCell, surfaceShape, StructureBoundary.empty(), TileShape.empty());
            }
            TileShape floorShape = surfaceShape.intersection(floorCells);
            return new LevelStructure(
                    anchorCell,
                    surfaceShape,
                    StructureBoundary.fromSurfaceAndFeatures(surfaceShape.cellCoords(), doors, walls),
                    floorShape);
        }

        public static LevelStructure fromTopology(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<GridSegment2x> boundaryEdges,
                Collection<CellCoord> floorCells
        ) {
            return fromTopologyWithDoorsAndWalls(anchorCell, surfaceCells, boundaryEdges, List.of(), List.of(), floorCells);
        }

        public static LevelStructure fromTopologyWithDoors(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<GridSegment2x> boundaryEdges,
                Collection<Door> doors,
                Collection<CellCoord> floorCells
        ) {
            return fromTopologyWithDoorsAndWalls(
                    anchorCell,
                    surfaceCells,
                    boundaryEdges,
                    doors,
                    List.of(),
                    floorCells);
        }

        public static LevelStructure fromTopologyWithDoorsAndWalls(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<GridSegment2x> boundaryEdges,
                Collection<Door> doors,
                Collection<Wall> walls,
                Collection<CellCoord> floorCells
        ) {
            TileShape surfaceShape = TileShape.of(surfaceCells);
            if (surfaceShape.isEmpty()) {
                return new LevelStructure(anchorCell, surfaceShape, StructureBoundary.empty(), TileShape.empty());
            }
            TileShape floorShape = surfaceShape.intersection(floorCells);
            return new LevelStructure(
                    anchorCell,
                    surfaceShape,
                    StructureBoundary.fromBoundaryEdges(surfaceShape.cellCoords(), boundaryEdges, doors, walls),
                    floorShape);
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

        public StructureBoundary boundary() {
            return boundary;
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
                    boundary.translatedByCells(resolvedDelta),
                    floorShape.translatedByCells(resolvedDelta));
        }

        public LevelStructure withFloorCells(Collection<CellCoord> floorCells) {
            return fromSurfaceAndFeatures(anchorCell, surfaceShape.cellCoords(), boundary.doors(), boundary.authoredWalls(), floorCells);
        }

        public LevelStructure withBoundary(StructureBoundary boundary) {
            StructureBoundary resolvedBoundary = boundary == null
                    ? StructureBoundary.empty()
                    : StructureBoundary.fromBoundaryEdges(
                    surfaceShape.cellCoords(),
                    boundary.boundaryEdges(),
                    boundary.doors(),
                    boundary.authoredWalls());
            return new LevelStructure(anchorCell, surfaceShape, resolvedBoundary, floorShape);
        }

        public boolean isEmpty() {
            return surfaceShape.isEmpty()
                    && boundary.isEmpty()
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
                    && Objects.equals(boundary, that.boundary)
                    && Objects.equals(floorCells(), that.floorCells());
        }

        @Override
        public int hashCode() {
            return Objects.hash(anchorCell, surfaceShape.cellCoords(), boundary, floorCells());
        }

        @Override
        public String toString() {
            return "LevelStructure[anchorCell=" + anchorCell
                    + ", surfaceCells=" + surfaceShape.cellCoords()
                    + ", boundary=" + boundary
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

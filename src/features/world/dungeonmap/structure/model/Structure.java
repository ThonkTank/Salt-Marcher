package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
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

    private static Set<GridSegment2x> derivedBoundaryEdgesForSurface(
            Collection<CellCoord> surfaceCells,
            Collection<GridSegment2x> authoredWallEdges
    ) {
        TileShape surfaceShape = TileShape.of(surfaceCells);
        if (surfaceShape.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>(surfaceShape.boundaryShape().segmentSet2x());
        result.addAll(normalizedBoundaryEdges(interiorAdjacencyEdgesForSurface(surfaceShape.cellCoords()), authoredWallEdges));
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public static List<GridSegment2x> shortestEdgePath(
            GridPoint2x start,
            GridPoint2x goal,
            Collection<GridSegment2x> traversableEdges
    ) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        if (Objects.equals(start, goal)) {
            return List.of();
        }
        Map<GridPoint2x, Set<GridPoint2x>> adjacency = edgeAdjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<GridPoint2x> queue = new ArrayDeque<>();
        Map<GridPoint2x, GridPoint2x> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            GridPoint2x current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (GridPoint2x neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(GridPoint2x.ORDER).toList()) {
                if (previous.containsKey(neighbor)) {
                    continue;
                }
                previous.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        if (!previous.containsKey(goal)) {
            return List.of();
        }
        ArrayList<GridSegment2x> path = new ArrayList<>();
        GridPoint2x current = goal;
        while (!Objects.equals(current, start)) {
            GridPoint2x parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(new GridSegment2x(parent, current));
            current = parent;
        }
        Collections.reverse(path);
        return List.copyOf(path);
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
                    level.walls(),
                    level.doors()));
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

    public Structure withDoorsAtLevel(int levelZ, Collection<Door> doors) {
        LevelStructure level = levelStructure(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withDoors(doors));
        return reattachedWithSameRooms(new Structure(updated, null));
    }

    public Structure withCreatedWallPathAtLevel(int levelZ, Collection<GridSegment2x> segments2x) {
        LevelStructure level = levelStructure(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withCreatedWallPath(segments2x));
        return reattachedWithSameRooms(new Structure(updated, null));
    }

    public Structure withDeletedWallPathAtLevel(int levelZ, Collection<GridSegment2x> segments2x) {
        LevelStructure level = levelStructure(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withDeletedWallPath(segments2x));
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

    public List<Door> doorsAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? List.of() : level.doors();
    }

    public List<Wall> authoredWallsAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? List.of() : level.walls();
    }

    public Set<GridSegment2x> authoredWallEdgesAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? Set.of() : level.authoredWallEdges();
    }

    public List<EdgeShape> doorComponentShapesAtLevel(int levelZ) {
        return doorsAtLevel(levelZ).stream()
                .map(door -> EdgeShape.fromBoundarySegments(door.segments2x()))
                .sorted(Comparator.comparing(EdgeShape::firstSegment2x, GridSegment2x.ORDER))
                .toList();
    }

    public Set<GridSegment2x> doorSegmentsAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? Set.of() : level.doorEdges();
    }

    public boolean hasDoorAtLevel(int levelZ, GridSegment2x segment2x) {
        LevelStructure level = levelStructure(levelZ);
        return level != null && level.hasDoorAt(segment2x);
    }

    public boolean supportsDoorAtLevel(int levelZ, GridSegment2x segment2x) {
        LevelStructure level = levelStructure(levelZ);
        return level != null && level.supportsDoorAt(segment2x);
    }

    public WallKind wallKindAtLevel(int levelZ, GridSegment2x segment2x) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? null : level.wallKindAt(segment2x);
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

    public EdgeShape boundaryShapeAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? EdgeShape.empty() : level.boundaryShape();
    }

    public Set<GridSegment2x> boundaryEdgesAtLevel(int levelZ) {
        LevelStructure level = levelStructure(levelZ);
        return level == null ? Set.of() : level.derivedBoundaryEdges();
    }

    public boolean isInteriorBoundaryAtLevel(int levelZ, GridSegment2x segment2x) {
        return segment2x != null && touchingSurfaceCellCount(cellCoordsAtLevel(levelZ), segment2x) == 2L;
    }

    public boolean isExteriorBoundaryAtLevel(int levelZ, GridSegment2x segment2x) {
        return segment2x != null && touchingSurfaceCellCount(cellCoordsAtLevel(levelZ), segment2x) == 1L;
    }

    public boolean touchesBoundaryVertexAtLevel(int levelZ, GridPoint2x vertex) {
        if (vertex == null) {
            return false;
        }
        return boundaryEdgesAtLevel(levelZ).stream()
                .anyMatch(segment2x -> segment2x.start().equals(vertex) || segment2x.end().equals(vertex));
    }

    public boolean isEditableWallVertexAtLevel(int levelZ, GridPoint2x vertex, boolean deleteMode) {
        if (vertex == null) {
            return false;
        }
        Set<GridSegment2x> candidateEdges = deleteMode
                ? deletableWallEdgesAtLevel(levelZ)
                : creatableWallEdgesAtLevel(levelZ);
        return candidateEdges.stream()
                .anyMatch(segment2x -> segment2x.start().equals(vertex) || segment2x.end().equals(vertex));
    }

    public Set<GridSegment2x> creatableWallEdgesAtLevel(int levelZ) {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>(interiorAdjacencyEdgesAtLevel(levelZ));
        result.removeAll(authoredWallEdgesAtLevel(levelZ));
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<GridSegment2x> deletableWallEdgesAtLevel(int levelZ) {
        return authoredWallEdgesAtLevel(levelZ);
    }

    public Set<GridSegment2x> interiorBoundaryEdgesAtLevel(int levelZ) {
        Set<CellCoord> levelCells = cellCoordsAtLevel(levelZ);
        if (levelCells.isEmpty()) {
            return Set.of();
        }
        return boundaryEdgesAtLevel(levelZ).stream()
                .filter(segment2x -> touchingSurfaceCellCount(levelCells, segment2x) == 2L)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    public Set<GridSegment2x> exteriorBoundaryEdgesAtLevel(int levelZ) {
        Set<CellCoord> levelCells = cellCoordsAtLevel(levelZ);
        if (levelCells.isEmpty()) {
            return Set.of();
        }
        return boundaryEdgesAtLevel(levelZ).stream()
                .filter(segment2x -> touchingSurfaceCellCount(levelCells, segment2x) == 1L)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    public Set<GridSegment2x> interiorAdjacencyEdgesAtLevel(int levelZ) {
        return interiorAdjacencyEdgesForSurface(cellCoordsAtLevel(levelZ));
    }

    public Set<GridSegment2x> exteriorBoundaryEdges() {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Integer levelZ : levels().stream().sorted().toList()) {
            result.addAll(exteriorBoundaryEdgesAtLevel(levelZ));
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<GridSegment2x> interiorAdjacencyEdges() {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Integer levelZ : levels().stream().sorted().toList()) {
            result.addAll(interiorAdjacencyEdgesAtLevel(levelZ));
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
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
                .reachableFrom(anchorCell, boundaryEdgesAtLevel(levelZ))
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
                    Set<GridSegment2x> boundaryEdges = derivedBoundaryEdgesForSurface(
                            clippedSurfaceCells,
                            authoredWallEdgesAtLevel(levelZ));
                    List<Door> clippedDoors = clippedDoorsForBoundary(doorsAtLevel(levelZ), boundaryEdges);
                    List<Wall> clippedWalls = clippedWallsForBoundary(authoredWallsAtLevel(levelZ), boundaryEdges);
                    Set<CellCoord> floorCells = intersectCells(floorCellCoordsAtLevel(levelZ), clippedSurfaceCells);
                    levels.put(levelZ, LevelStructure.fromSurfaceAndFeatures(
                            preferredAnchorsByLevel == null ? null : preferredAnchorsByLevel.get(levelZ),
                            clippedSurfaceCells,
                            clippedDoors,
                            clippedWalls,
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

    private static List<Door> clippedDoorsForBoundary(Collection<Door> doors, Collection<GridSegment2x> boundaryEdges) {
        if (doors == null || doors.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
            return List.of();
        }
        ArrayList<Door> result = new ArrayList<>();
        for (Door door : doors) {
            if (door == null || door.isEmpty()) {
                continue;
            }
            EdgeShape clippedShape = EdgeShape.fromBoundarySegments(boundaryEdges).intersection(door.segments2x());
            if (clippedShape.isEmpty()) {
                continue;
            }
            GridSegment2x clippedAnchor = clippedShape.contains(door.anchorSegment2x())
                    ? door.anchorSegment2x()
                    : clippedShape.firstSegment2x();
            result.add(Door.fromShape(door.doorId(), clippedShape, clippedAnchor, door.doorState()));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<Wall> clippedWallsForBoundary(Collection<Wall> walls, Collection<GridSegment2x> boundaryEdges) {
        if (walls == null || walls.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
            return List.of();
        }
        ArrayList<Wall> result = new ArrayList<>();
        EdgeShape boundaryShape = EdgeShape.fromBoundarySegments(boundaryEdges);
        for (Wall wall : walls) {
            if (wall == null || wall.isEmpty()) {
                continue;
            }
            EdgeShape clippedShape = boundaryShape.intersection(wall.segments2x());
            if (clippedShape.isEmpty()) {
                continue;
            }
            GridSegment2x clippedAnchor = clippedShape.contains(wall.anchorSegment2x())
                    ? wall.anchorSegment2x()
                    : clippedShape.firstSegment2x();
            result.add(Wall.fromShape(wall.wallId(), clippedShape, clippedAnchor, wall.wallKind()));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
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

    private static Map<GridPoint2x, Set<GridPoint2x>> edgeAdjacency(Collection<GridSegment2x> edges) {
        Map<GridPoint2x, Set<GridPoint2x>> result = new LinkedHashMap<>();
        for (GridSegment2x edge : edges == null ? List.<GridSegment2x>of() : edges) {
            if (edge == null) {
                continue;
            }
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        Map<GridPoint2x, Set<GridPoint2x>> immutable = new LinkedHashMap<>();
        for (Map.Entry<GridPoint2x, Set<GridPoint2x>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return immutable.isEmpty() ? Map.of() : Map.copyOf(immutable);
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

    private static Set<GridSegment2x> normalizedBoundaryEdges(
            Set<GridSegment2x> allowedEdges,
            Collection<GridSegment2x> boundaryEdges
    ) {
        if (allowedEdges == null || allowedEdges.isEmpty() || boundaryEdges == null || boundaryEdges.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        GridSegment2x.boundarySteps(boundaryEdges).stream()
                .sorted(GridSegment2x.ORDER)
                .filter(allowedEdges::contains)
                .forEach(result::add);
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridSegment2x> interiorAdjacencyEdgesForSurface(Set<CellCoord> surfaceCells) {
        if (surfaceCells == null || surfaceCells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : surfaceCells) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = cell.add(step);
                if (!surfaceCells.contains(neighbor) || CellCoord.ORDER.compare(cell, neighbor) >= 0) {
                    continue;
                }
                result.add(GridSegment2x.boundaryEdge(cell, cell.directionTo4(neighbor)));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static boolean touchesSurfaceCells(Set<CellCoord> surfaceCells, GridSegment2x segment) {
        return touchingSurfaceCellCount(surfaceCells, segment) > 0L;
    }

    private static long touchingSurfaceCellCount(Set<CellCoord> surfaceCells, GridSegment2x segment) {
        if (surfaceCells == null || surfaceCells.isEmpty() || segment == null) {
            return 0L;
        }
        return segment.touchingCells().stream().filter(surfaceCells::contains).count();
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
        private final EdgeShape boundaryShape;
        private final List<Door> doors;
        private final List<Wall> walls;

        private LevelStructure(
                CellCoord anchorCell,
                TileShape surfaceShape,
                EdgeShape boundaryShape,
                Collection<Door> doors,
                Collection<Wall> walls,
                TileShape floorShape
        ) {
            this.surfaceShape = surfaceShape == null ? TileShape.empty() : surfaceShape;
            this.boundaryShape = boundaryShape == null ? EdgeShape.empty() : boundaryShape;
            this.doors = normalizeDoors(this.boundaryShape, doors);
            this.walls = normalizeWalls(this.boundaryShape, walls);
            this.floorShape = floorShape == null ? TileShape.empty() : floorShape;
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
                return new LevelStructure(anchorCell, surfaceShape, EdgeShape.empty(), List.of(), List.of(), TileShape.empty());
            }
            EdgeShape allowedWallShape = EdgeShape.fromBoundarySegments(interiorAdjacencyEdgesForSurface(surfaceShape.cellCoords()));
            List<Wall> normalizedWalls = normalizeWalls(allowedWallShape, walls);
            EdgeShape boundaryShape = EdgeShape.fromBoundarySegments(derivedBoundaryEdgesForSurface(
                    surfaceShape.cellCoords(),
                    authoredWallEdges(normalizedWalls)));
            TileShape floorShape = surfaceShape.intersection(floorCells);
            return new LevelStructure(anchorCell, surfaceShape, boundaryShape, doors, normalizedWalls, floorShape);
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
                return new LevelStructure(anchorCell, surfaceShape, EdgeShape.empty(), List.of(), List.of(), TileShape.empty());
            }
            Set<GridSegment2x> normalizedBoundaryEdges = Structure.normalizedBoundaryEdges(
                    surfaceShape.boundaryShape().segmentSet2x(),
                    boundaryEdges);
            EdgeShape boundaryShape = normalizedBoundaryEdges.isEmpty()
                    ? surfaceShape.boundaryShape()
                    : EdgeShape.fromBoundarySegments(normalizedBoundaryEdges);
            TileShape floorShape = surfaceShape.intersection(floorCells);
            return new LevelStructure(anchorCell, surfaceShape, boundaryShape, doors, walls, floorShape);
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

        public List<Door> doors() {
            return doors;
        }

        public List<Wall> walls() {
            return walls;
        }

        public Set<GridSegment2x> authoredWallEdges() {
            return authoredWallEdges(walls);
        }

        public Set<GridSegment2x> derivedBoundaryEdges() {
            return boundaryEdges();
        }

        public EdgeShape wallShape() {
            return EdgeShape.fromBoundarySegments(movementBlockingBoundaryEdges());
        }

        public Set<GridSegment2x> boundaryEdges() {
            return boundaryShape.segmentSet2x();
        }

        public Set<GridSegment2x> doorEdges() {
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
            for (Door door : doors) {
                if (door != null) {
                    result.addAll(door.segments2x());
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        public boolean hasDoorAt(GridSegment2x segment2x) {
            return segment2x != null && doorEdges().contains(segment2x);
        }

        public boolean supportsDoorAt(GridSegment2x segment2x) {
            WallKind wallKind = wallKindAt(segment2x);
            return wallKind != null && wallKind.supportsDoorAttachments();
        }

        public Set<GridSegment2x> movementBlockingBoundaryEdges() {
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
            Set<GridSegment2x> doorEdges = doorEdges();
            for (GridSegment2x segment2x : boundaryEdges().stream().sorted(GridSegment2x.ORDER).toList()) {
                if (doorEdges.contains(segment2x)) {
                    continue;
                }
                WallKind wallKind = wallKindAt(segment2x);
                if (wallKind != null && wallKind.blocksPassage()) {
                    result.add(segment2x);
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        public WallKind wallKindAt(GridSegment2x segment2x) {
            if (segment2x == null || !boundaryEdges().contains(segment2x)) {
                return null;
            }
            for (Wall wall : walls) {
                if (wall != null && wall.contains(segment2x)) {
                    return wall.wallKind();
                }
            }
            return WallKind.solid();
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
                    doors.stream()
                            .map(door -> door == null ? null : door.movedBy(resolvedDelta))
                            .filter(Objects::nonNull)
                            .toList(),
                    walls.stream()
                            .map(wall -> wall == null ? null : wall.movedBy(resolvedDelta))
                            .filter(Objects::nonNull)
                            .toList(),
                    floorShape.translatedByCells(resolvedDelta));
        }

        public LevelStructure withFloorCells(Collection<CellCoord> floorCells) {
            return fromSurfaceAndFeatures(anchorCell, surfaceShape.cellCoords(), doors, walls, floorCells);
        }

        public LevelStructure withDoors(Collection<Door> doors) {
            return fromSurfaceAndFeatures(anchorCell, surfaceShape.cellCoords(), doors, walls, floorCells());
        }

        public LevelStructure withCreatedWallPath(Collection<GridSegment2x> segments2x) {
            return fromSurfaceAndFeatures(
                    anchorCell,
                    surfaceShape.cellCoords(),
                    doors,
                    createdWalls(walls, normalizedBoundaryEdges(creatableWallCandidates(), segments2x)),
                    floorCells());
        }

        public LevelStructure withDeletedWallPath(Collection<GridSegment2x> segments2x) {
            List<Wall> remainingWalls = deletedWalls(walls, normalizedBoundaryEdges(authoredWallEdges(), segments2x));
            return fromSurfaceAndFeatures(anchorCell, surfaceShape.cellCoords(), doors, remainingWalls, floorCells());
        }

        public boolean isEmpty() {
            return surfaceShape.isEmpty()
                    && boundaryShape.isEmpty()
                    && doors.isEmpty()
                    && walls.isEmpty()
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
                    && Objects.equals(boundaryEdges(), that.boundaryEdges())
                    && Objects.equals(doors, that.doors)
                    && Objects.equals(walls, that.walls)
                    && Objects.equals(floorCells(), that.floorCells());
        }

        @Override
        public int hashCode() {
            return Objects.hash(anchorCell, surfaceShape.cellCoords(), boundaryEdges(), doors, walls, floorCells());
        }

        @Override
        public String toString() {
            return "LevelStructure[anchorCell=" + anchorCell
                    + ", surfaceCells=" + surfaceShape.cellCoords()
                    + ", boundaryEdges=" + boundaryEdges()
                    + ", doors=" + doors
                    + ", walls=" + walls
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

        private static List<Door> normalizeDoors(EdgeShape boundaryShape, Collection<Door> doors) {
            if (doors == null || doors.isEmpty() || boundaryShape == null || boundaryShape.isEmpty()) {
                return List.of();
            }
            ArrayList<Door> result = new ArrayList<>();
            EdgeShape resolvedBoundaryShape = EdgeShape.fromBoundarySegments(boundaryShape.segments2x());
            for (Door door : doors) {
                if (door == null || door.isEmpty()) {
                    continue;
                }
                EdgeShape clippedShape = resolvedBoundaryShape.intersection(door.segments2x());
                if (clippedShape.isEmpty()) {
                    continue;
                }
                GridSegment2x anchorSegment2x = clippedShape.contains(door.anchorSegment2x())
                        ? door.anchorSegment2x()
                        : clippedShape.firstSegment2x();
                Long doorId = door.doorId();
                if (doorId == null || doorId == 0L) {
                    doorId = syntheticDoorId(clippedShape, anchorSegment2x, door.doorState());
                }
                result.add(Door.fromShape(doorId, clippedShape, anchorSegment2x, door.doorState()));
            }
            result.sort(Comparator.comparing(Door::anchorSegment2x, GridSegment2x.ORDER));
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private static List<Wall> normalizeWalls(EdgeShape boundaryShape, Collection<Wall> walls) {
            if (walls == null || walls.isEmpty() || boundaryShape == null || boundaryShape.isEmpty()) {
                return List.of();
            }
            ArrayList<Wall> result = new ArrayList<>();
            LinkedHashSet<GridSegment2x> occupiedSegments = new LinkedHashSet<>();
            EdgeShape resolvedBoundaryShape = EdgeShape.fromBoundarySegments(boundaryShape.segments2x());
            for (Wall wall : walls) {
                if (wall == null || wall.isEmpty()) {
                    continue;
                }
                EdgeShape clippedShape = resolvedBoundaryShape.intersection(wall.segments2x());
                if (clippedShape.isEmpty()) {
                    continue;
                }
                for (GridSegment2x segment2x : clippedShape.segments2x()) {
                    if (!occupiedSegments.add(segment2x)) {
                        throw new IllegalArgumentException("Authored walls may not overlap on the same boundary segment");
                    }
                }
                GridSegment2x anchorSegment2x = clippedShape.contains(wall.anchorSegment2x())
                        ? wall.anchorSegment2x()
                        : clippedShape.firstSegment2x();
                result.add(Wall.fromShape(wall.wallId(), clippedShape, anchorSegment2x, wall.wallKind()));
            }
            result.sort(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER));
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private Set<GridSegment2x> creatableWallCandidates() {
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>(interiorAdjacencyEdgesForSurface(surfaceShape.cellCoords()));
            result.removeAll(authoredWallEdges());
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static Set<GridSegment2x> authoredWallEdges(Collection<Wall> walls) {
            LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
            for (Wall wall : walls == null ? List.<Wall>of() : walls) {
                if (wall != null) {
                    result.addAll(wall.segments2x());
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static List<Wall> createdWalls(Collection<Wall> existingWalls, Collection<GridSegment2x> segments2x) {
            List<GridSegment2x> newSegments = (segments2x == null ? List.<GridSegment2x>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .sorted(GridSegment2x.ORDER)
                    .toList();
            if (newSegments.isEmpty()) {
                return existingWalls == null ? List.of() : List.copyOf(existingWalls);
            }
            ArrayList<Wall> result = new ArrayList<>(existingWalls == null ? List.<Wall>of() : existingWalls);
            EdgeShape shape = EdgeShape.fromBoundarySegments(newSegments);
            if (!shape.isEmpty()) {
                result.add(Wall.fromShape(null, shape, shape.firstSegment2x(), WallKind.solid()));
            }
            return result.stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                    .toList();
        }

        private static List<Wall> deletedWalls(Collection<Wall> existingWalls, Collection<GridSegment2x> segments2x) {
            if (existingWalls == null || existingWalls.isEmpty()) {
                return List.of();
            }
            List<GridSegment2x> removedSegments = (segments2x == null ? List.<GridSegment2x>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .sorted(GridSegment2x.ORDER)
                    .toList();
            if (removedSegments.isEmpty()) {
                return existingWalls.stream()
                        .filter(Objects::nonNull)
                        .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                        .toList();
            }
            ArrayList<Wall> result = new ArrayList<>();
            for (Wall wall : existingWalls) {
                if (wall == null || wall.isEmpty()) {
                    continue;
                }
                EdgeShape remainingShape = EdgeShape.fromBoundarySegments(wall.segments2x()).without(removedSegments);
                List<EdgeShape> remainingComponents = remainingShape.connectedComponents();
                for (int index = 0; index < remainingComponents.size(); index++) {
                    EdgeShape component = remainingComponents.get(index);
                    GridSegment2x anchorSegment2x = component.contains(wall.anchorSegment2x())
                            ? wall.anchorSegment2x()
                            : component.firstSegment2x();
                    Long wallId = index == 0 ? wall.wallId() : null;
                    result.add(Wall.fromShape(wallId, component, anchorSegment2x, wall.wallKind()));
                }
            }
            return result.stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                    .toList();
        }

        private static long syntheticDoorId(EdgeShape shape, GridSegment2x anchorSegment2x, Door.DoorState doorState) {
            long result = 17L;
            result = 31L * result + (doorState == null ? 0L : doorState.ordinal());
            result = 31L * result + (anchorSegment2x == null ? 0L : anchorSegment2x.hashCode());
            for (GridSegment2x segment2x : shape == null ? List.<GridSegment2x>of() : shape.segments2x()) {
                result = 31L * result + segment2x.hashCode();
            }
            if (result == 0L) {
                result = -1L;
            }
            return result > 0L ? -result : result;
        }
    }
}

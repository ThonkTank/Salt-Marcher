package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.stair.Stair;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Shared topology orchestrator over shape-backed floor, wall, door, and stair objects.
 */
public final class StructureObject {

    private final StructureDescriptor descriptor;
    private final Map<Integer, TileShape> surfaceShapesByLevel;
    private final Map<Integer, Floor> floorsByLevel;
    private final Map<Integer, List<Wall>> wallsByLevel;
    private final Map<Integer, List<Door>> doorsByLevel;
    private final List<Stair> stairs;

    public static StructureObject empty() {
        return new StructureObject(StructureDescriptor.empty(), Map.of(), Map.of(), Map.of(), Map.of(), List.of());
    }

    public static StructureObject fromDescriptor(StructureDescriptor descriptor) {
        StructureDescriptor resolvedDescriptor = descriptor == null ? StructureDescriptor.empty() : descriptor;
        if (resolvedDescriptor.levels().isEmpty()) {
            return empty();
        }
        Map<Integer, TileShape> surfaceShapes = new LinkedHashMap<>();
        Map<Integer, Floor> floors = new LinkedHashMap<>();
        Map<Integer, List<Wall>> walls = new LinkedHashMap<>();
        Map<Integer, List<Door>> doors = new LinkedHashMap<>();
        for (Map.Entry<Integer, StructureDescriptor.LevelDescriptor> entry : resolvedDescriptor.levels().entrySet()) {
            int levelZ = entry.getKey();
            StructureDescriptor.LevelDescriptor level = entry.getValue();
            surfaceShapes.put(levelZ, level.surfaceShape());
            floors.put(levelZ, new Floor(level.floorShape()));
            walls.put(levelZ, hydrateWalls(level.boundaryShape(), level.openingShape()));
            doors.put(levelZ, hydrateDoors(level.openingShape()));
        }
        return new StructureObject(resolvedDescriptor, surfaceShapes, floors, walls, doors, List.of());
    }

    public static StructureObject fromCubePoints(java.util.Collection<CubePoint> cubePoints) {
        return fromDescriptor(StructureDescriptor.fromCubePoints(cubePoints));
    }

    public static StructureObject fromStair(Stair stair) {
        if (stair == null) {
            return empty();
        }
        return new StructureObject(StructureDescriptor.empty(), Map.of(), Map.of(), Map.of(), Map.of(), List.of(stair));
    }

    private StructureObject(
            StructureDescriptor descriptor,
            Map<Integer, TileShape> surfaceShapesByLevel,
            Map<Integer, Floor> floorsByLevel,
            Map<Integer, List<Wall>> wallsByLevel,
            Map<Integer, List<Door>> doorsByLevel,
            List<Stair> stairs
    ) {
        this.descriptor = descriptor == null ? StructureDescriptor.empty() : descriptor;
        this.surfaceShapesByLevel = normalizedSurfaceShapes(surfaceShapesByLevel);
        this.floorsByLevel = normalizedFloors(floorsByLevel);
        this.wallsByLevel = normalizedObjectsByLevel(wallsByLevel);
        this.doorsByLevel = normalizedObjectsByLevel(doorsByLevel);
        this.stairs = normalizedStairs(stairs);
    }

    public StructureDescriptor descriptor() {
        return descriptor;
    }

    public TileShape surfaceShapeAtLevel(int levelZ) {
        TileShape descriptorShape = surfaceShapesByLevel.getOrDefault(levelZ, TileShape.empty());
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
        return wallsByLevel.getOrDefault(levelZ, List.of());
    }

    public List<Door> doorsAtLevel(int levelZ) {
        return doorsByLevel.getOrDefault(levelZ, List.of());
    }

    public Floor floorAtLevel(int levelZ) {
        return floorsByLevel.get(levelZ);
    }

    public List<Stair> stairs() {
        return stairs;
    }

    public Stair stair() {
        return stairs.isEmpty() ? null : stairs.getFirst();
    }

    public Set<Integer> levels() {
        LinkedHashSet<Integer> result = new LinkedHashSet<>(descriptor.levelZs());
        for (Stair stair : stairs) {
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
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
        return level == null ? EdgeShape.empty() : level.boundaryShape();
    }

    public EdgeShape openingShapeAtLevel(int levelZ) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
        return level == null ? EdgeShape.empty() : level.openingShape();
    }

    public Set<GridSegment2x> boundaryEdgesAtLevel(int levelZ) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
        return level == null ? Set.of() : level.boundaryEdges();
    }

    public Set<GridSegment2x> openingEdgesAtLevel(int levelZ) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
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
        for (Map.Entry<Integer, TileShape> entry : surfaceShapesByLevel.entrySet()) {
            result.addAll(entry.getValue().cubePoints(entry.getKey()));
        }
        for (Stair stair : stairs) {
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
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
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
        List<Stair> translatedStairs = stairs.stream()
                .map(stair -> stair.movedBy(delta, levelDelta))
                .toList();
        return new StructureObject(
                descriptor.translatedByCells(delta, levelDelta),
                translatedSurfaceShapes(delta, levelDelta),
                translatedFloors(delta, levelDelta),
                translatedWalls(delta, levelDelta),
                translatedDoors(delta, levelDelta),
                translatedStairs);
    }

    private TileShape stairShapeAtLevel(int levelZ) {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (Stair stair : stairs) {
            result.addAll(stair.cellCoordsAtLevel(levelZ));
        }
        return result.isEmpty() ? TileShape.empty() : new TileShape(result);
    }

    private Map<Integer, TileShape> translatedSurfaceShapes(CellCoord delta, int levelDelta) {
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, TileShape> entry : surfaceShapesByLevel.entrySet()) {
            result.put(entry.getKey() + levelDelta, entry.getValue().translatedByCells(delta));
        }
        return result;
    }

    private Map<Integer, Floor> translatedFloors(CellCoord delta, int levelDelta) {
        Map<Integer, Floor> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floorsByLevel.entrySet()) {
            result.put(entry.getKey() + levelDelta, entry.getValue().movedBy(delta));
        }
        return result;
    }

    private Map<Integer, List<Wall>> translatedWalls(CellCoord delta, int levelDelta) {
        Map<Integer, List<Wall>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Wall>> entry : wallsByLevel.entrySet()) {
            result.put(entry.getKey() + levelDelta, entry.getValue().stream()
                    .map(wall -> wall == null ? null : wall.movedBy(delta))
                    .filter(wall -> wall != null)
                    .toList());
        }
        return result;
    }

    private Map<Integer, List<Door>> translatedDoors(CellCoord delta, int levelDelta) {
        Map<Integer, List<Door>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Door>> entry : doorsByLevel.entrySet()) {
            result.put(entry.getKey() + levelDelta, entry.getValue().stream()
                    .map(door -> door == null ? null : door.movedBy(delta))
                    .filter(door -> door != null)
                    .toList());
        }
        return result;
    }

    private static List<Wall> hydrateWalls(EdgeShape boundaryShape, EdgeShape openingShape) {
        EdgeShape wallShape = boundaryShape == null ? EdgeShape.empty() : boundaryShape.without(openingShape == null ? List.of() : openingShape.segments2x());
        return wallShape.isEmpty() ? List.of() : List.of(Wall.fromShape(wallShape));
    }

    private static List<Door> hydrateDoors(EdgeShape openingShape) {
        if (openingShape == null || openingShape.isEmpty()) {
            return List.of();
        }
        return openingShape.connectedComponents().stream()
                .map(component -> Door.fromShape(component, Door.DoorState.OPEN))
                .toList();
    }

    private static List<Stair> normalizedStairs(List<Stair> stairs) {
        if (stairs == null || stairs.isEmpty()) {
            return List.of();
        }
        ArrayList<Stair> result = new ArrayList<>();
        for (Stair stair : stairs) {
            if (stair != null) {
                result.add(stair);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<Integer, Floor> normalizedFloors(Map<Integer, Floor> floors) {
        if (floors == null || floors.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Floor> result = new LinkedHashMap<>();
        floors.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, TileShape> normalizedSurfaceShapes(Map<Integer, TileShape> surfaceShapesByLevel) {
        if (surfaceShapesByLevel == null || surfaceShapesByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        surfaceShapesByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null && !entry.getValue().isEmpty())
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static <T> Map<Integer, List<T>> normalizedObjectsByLevel(Map<Integer, List<T>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<T>> result = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    ArrayList<T> objects = new ArrayList<>();
                    if (entry.getValue() != null) {
                        for (T object : entry.getValue()) {
                            if (object != null) {
                                objects.add(object);
                            }
                        }
                    }
                    result.put(entry.getKey(), objects.isEmpty() ? List.of() : List.copyOf(objects));
                });
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }
}

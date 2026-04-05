package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Shared synthesized owner for floor, wall, and door geometry rebuilt from descriptor-native shapes.
 */
public final class StructureObject {

    private final StructureDescriptor descriptor;
    private final Map<Integer, TileShape> surfaceShapesByLevel;
    private final Map<Integer, Floor> floorsByLevel;
    private final Map<Integer, List<Wall>> wallsByLevel;
    private final Map<Integer, List<Door>> doorsByLevel;

    public static StructureObject empty() {
        return new StructureObject(StructureDescriptor.empty(), Map.of(), Map.of(), Map.of(), Map.of());
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
            floors.put(levelZ, hydrateFloor(level));
            walls.put(levelZ, hydrateWalls(level));
            doors.put(levelZ, hydrateDoors(level));
        }
        return new StructureObject(resolvedDescriptor, surfaceShapes, floors, walls, doors);
    }

    public static StructureObject fromCubePoints(java.util.Collection<CubePoint> cubePoints) {
        return fromDescriptor(StructureDescriptor.fromCubePoints(cubePoints));
    }

    private StructureObject(
            StructureDescriptor descriptor,
            Map<Integer, TileShape> surfaceShapesByLevel,
            Map<Integer, Floor> floorsByLevel,
            Map<Integer, List<Wall>> wallsByLevel,
            Map<Integer, List<Door>> doorsByLevel
    ) {
        this.descriptor = descriptor == null ? StructureDescriptor.empty() : descriptor;
        this.surfaceShapesByLevel = normalizedSurfaceShapes(surfaceShapesByLevel);
        this.floorsByLevel = normalizedFloors(floorsByLevel);
        this.wallsByLevel = normalizedObjectsByLevel(wallsByLevel);
        this.doorsByLevel = normalizedObjectsByLevel(doorsByLevel);
    }

    public StructureDescriptor descriptor() {
        return descriptor;
    }

    public TileShape surfaceShapeAtLevel(int levelZ) {
        return surfaceShapesByLevel.getOrDefault(levelZ, TileShape.empty());
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

    public Set<Integer> levels() {
        return descriptor.levelZs();
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
        return descriptor.levelZs().stream().mapToInt(Integer::intValue).min().orElse(0);
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
        for (TileShape shape : surfaceShapesByLevel.values()) {
            result.addAll(shape.cellCoords());
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
            for (CellCoord cell : entry.getValue().cellCoords()) {
                result.add(CubePoint.at(cell, entry.getKey()));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && surfaceShapesByLevel.values().stream().anyMatch(shape -> shape.contains(cell));
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
        return level == null ? null : level.anchorCell();
    }

    public CellCoord surfaceCenterCellCoordAtLevel(int levelZ) {
        Set<CellCoord> surfaceCells = cellCoordsAtLevel(levelZ);
        return surfaceCells.isEmpty() ? null : CellCoord.bestCenter(surfaceCells);
    }

    public StructureObject movedBy(CellCoord delta, int levelDelta) {
        return fromDescriptor(descriptor.translatedByCells(delta, levelDelta));
    }

    private static Floor hydrateFloor(StructureDescriptor.LevelDescriptor level) {
        return new Floor(level.floorShape().cellCoords());
    }

    private static List<Wall> hydrateWalls(StructureDescriptor.LevelDescriptor level) {
        Set<GridSegment2x> wallSegments = new LinkedHashSet<>(GridSegment2x.boundarySteps(level.boundaryEdges()));
        wallSegments.removeAll(GridSegment2x.boundarySteps(level.openingEdges()));
        return wallSegments.isEmpty() ? List.of() : List.of(Wall.fromSegments(wallSegments));
    }

    private static List<Door> hydrateDoors(StructureDescriptor.LevelDescriptor level) {
        List<Set<GridSegment2x>> doorComponents = connectedComponents(GridSegment2x.boundarySteps(level.openingEdges()));
        if (doorComponents.isEmpty()) {
            return List.of();
        }
        ArrayList<Door> result = new ArrayList<>();
        for (Set<GridSegment2x> component : doorComponents) {
            result.add(Door.fromSegments(component, Door.DoorState.OPEN));
        }
        return List.copyOf(result);
    }

    private static List<Set<GridSegment2x>> connectedComponents(Set<GridSegment2x> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridSegment2x> remaining = new LinkedHashSet<>(segments.stream()
                .sorted(GridSegment2x.ORDER)
                .toList());
        ArrayList<Set<GridSegment2x>> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            GridSegment2x seed = remaining.iterator().next();
            ArrayDeque<GridSegment2x> queue = new ArrayDeque<>();
            LinkedHashSet<GridSegment2x> component = new LinkedHashSet<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                GridSegment2x current = queue.removeFirst();
                component.add(current);
                ArrayList<GridSegment2x> attached = new ArrayList<>();
                for (GridSegment2x candidate : remaining) {
                    if (current.sharesEndpoint(candidate)) {
                        attached.add(candidate);
                    }
                }
                attached.sort(GridSegment2x.ORDER);
                for (GridSegment2x candidate : attached) {
                    remaining.remove(candidate);
                    queue.addLast(candidate);
                }
            }
            result.add(Set.copyOf(component));
        }
        result.sort(Comparator.comparing((Set<GridSegment2x> component) -> component.stream()
                .min(GridSegment2x.ORDER)
                .orElse(new GridSegment2x(GridPoint2x.raw(0, 0), GridPoint2x.raw(2, 0))),
                GridSegment2x.ORDER));
        return List.copyOf(result);
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

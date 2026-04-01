package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileFaceShape;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Shared synthesized owner for floor, wall, and door geometry.
 *
 * <p>This bridges the new descriptor-driven 2x model to the existing room/corridor call sites until later steps can
 * switch to `StructureObject` directly.</p>
 */
public final class StructureObject {

    private final StructureDescriptor descriptor;
    private final Map<Integer, Floor> floorsByLevel;
    private final Map<Integer, List<Wall>> wallsByLevel;
    private final Map<Integer, List<Door>> doorsByLevel;
    private final List<Wall> aggregateWalls;

    public static StructureObject empty() {
        return new StructureObject(StructureDescriptor.empty(), Map.of(), Map.of(), Map.of());
    }

    public static StructureObject fromDescriptor(StructureDescriptor descriptor) {
        StructureDescriptor resolvedDescriptor = descriptor == null ? StructureDescriptor.empty() : descriptor;
        if (resolvedDescriptor.levels().isEmpty()) {
            return empty();
        }
        Map<Integer, Floor> floors = new LinkedHashMap<>();
        Map<Integer, List<Wall>> walls = new LinkedHashMap<>();
        Map<Integer, List<Door>> doors = new LinkedHashMap<>();
        for (Map.Entry<Integer, StructureDescriptor.LevelDescriptor> entry : resolvedDescriptor.levels().entrySet()) {
            int levelZ = entry.getKey();
            StructureDescriptor.LevelDescriptor level = entry.getValue();
            floors.put(levelZ, hydrateFloor(level));
            walls.put(levelZ, hydrateWalls(level));
            doors.put(levelZ, hydrateDoors(level));
        }
        return new StructureObject(resolvedDescriptor, floors, walls, doors);
    }

    public static StructureObject fromLegacyFloorsAndWalls(Map<Integer, Floor> floors, Collection<Wall> walls) {
        Map<Integer, Floor> resolvedFloors = normalizeLegacyFloors(floors);
        if (resolvedFloors.isEmpty()) {
            return empty();
        }
        Map<Integer, StructureDescriptor.LevelDescriptor> levels = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : resolvedFloors.entrySet()) {
            int levelZ = entry.getKey();
            Floor floor = entry.getValue();
            TileShape legacyShape = floor.shape();
            Set<VertexEdge> boundaryEdges = legacyShape.boundaryEdges();
            Set<VertexEdge> levelWallEdges = legacyWallEdgesForLevel(boundaryEdges, walls);
            Set<VertexEdge> openingEdges = new LinkedHashSet<>(boundaryEdges);
            openingEdges.removeAll(levelWallEdges);
            levels.put(levelZ, new StructureDescriptor.LevelDescriptor(
                    floor.anchor2x(),
                    legacyShape.size() == 0 ? Set.of() : Set.of(floor.anchor2x()),
                    toBoundarySegments(boundaryEdges),
                    toBoundarySegments(openingEdges)));
        }
        return fromDescriptor(new StructureDescriptor(levels));
    }

    public static StructureObject fromCubePoints(Collection<CubePoint> cubePoints) {
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
        Map<Integer, Floor> floors = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Point2i>> entry : cellsByLevel.entrySet()) {
            floors.put(entry.getKey(), new Floor(TileShape.fromAbsoluteCells(entry.getValue())));
        }
        Map<Integer, List<Wall>> walls = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            Set<VertexEdge> boundaryEdges = entry.getValue().shape().boundaryEdges();
            walls.put(entry.getKey(), boundaryEdges.isEmpty() ? List.of() : List.of(new Wall(boundaryEdges)));
        }
        ArrayList<Wall> aggregateWalls = new ArrayList<>();
        for (List<Wall> levelWalls : walls.values()) {
            aggregateWalls.addAll(levelWalls);
        }
        return fromLegacyFloorsAndWalls(floors, aggregateWalls);
    }

    private StructureObject(
            StructureDescriptor descriptor,
            Map<Integer, Floor> floorsByLevel,
            Map<Integer, List<Wall>> wallsByLevel,
            Map<Integer, List<Door>> doorsByLevel
    ) {
        this.descriptor = descriptor == null ? StructureDescriptor.empty() : descriptor;
        this.floorsByLevel = normalizedFloors(floorsByLevel);
        this.wallsByLevel = normalizedObjectsByLevel(wallsByLevel);
        this.doorsByLevel = normalizedObjectsByLevel(doorsByLevel);
        this.aggregateWalls = aggregateWalls(this.wallsByLevel).getOrDefault(0, List.of());
    }

    public StructureDescriptor descriptor() {
        return descriptor;
    }

    public Map<Integer, Floor> floors() {
        return floorsByLevel;
    }

    public List<Wall> walls() {
        return aggregateWalls;
    }

    public List<Wall> wallsAtLevel(int levelZ) {
        return wallsByLevel.getOrDefault(levelZ, List.of());
    }

    public List<Door> doorsAtLevel(int levelZ) {
        return doorsByLevel.getOrDefault(levelZ, List.of());
    }

    public List<DungeonObject> objectsAtLevel(int levelZ) {
        ArrayList<DungeonObject> result = new ArrayList<>();
        Floor floor = floorAtLevel(levelZ);
        if (floor != null) {
            result.add(floor);
        }
        result.addAll(wallsAtLevel(levelZ));
        result.addAll(doorsAtLevel(levelZ));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public Floor floor() {
        return floorAtLevel(primaryLevel());
    }

    public Floor floorAtLevel(int levelZ) {
        return floorsByLevel.get(levelZ);
    }

    public TileShape shapeAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        return floor == null ? TileShape.empty() : floor.shape();
    }

    public Set<Integer> levels() {
        return floorsByLevel.keySet();
    }

    public Map<Integer, TileShape> shapesByLevel() {
        if (floorsByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floorsByLevel.entrySet()) {
            result.put(entry.getKey(), entry.getValue().shape());
        }
        return Map.copyOf(result);
    }

    public Map<Integer, GridPoint2x> anchors2xByLevel() {
        if (descriptor.levels().isEmpty()) {
            return Map.of();
        }
        Map<Integer, GridPoint2x> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, StructureDescriptor.LevelDescriptor> entry : descriptor.levels().entrySet()) {
            result.put(entry.getKey(), entry.getValue().anchor2x());
        }
        return Map.copyOf(result);
    }

    public Map<Integer, Point2i> anchorsByLevel() {
        if (floorsByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Point2i> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floorsByLevel.entrySet()) {
            result.put(entry.getKey(), entry.getValue().anchorCell());
        }
        return Map.copyOf(result);
    }

    public Point2i anchorAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        return floor == null ? null : floor.anchorCell();
    }

    public int primaryLevel() {
        return floorsByLevel.keySet().stream().mapToInt(Integer::intValue).min().orElse(0);
    }

    public Point2i centerCellAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        if (floor == null || floor.shape().size() == 0) {
            return null;
        }
        return floor.shape().centerCell();
    }

    public CubePoint centerPointAtLevel(int levelZ) {
        Point2i centerCell = centerCellAtLevel(levelZ);
        return centerCell == null ? null : CubePoint.at(centerCell, levelZ);
    }

    public Set<GridSegment2x> boundarySegmentsAtLevel(int levelZ) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
        return level == null ? Set.of() : level.boundarySegments2x();
    }

    public Set<GridSegment2x> openingSegmentsAtLevel(int levelZ) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
        return level == null ? Set.of() : level.openingSegments2x();
    }

    public Set<VertexEdge> boundaryEdgesAtLevel(int levelZ) {
        return toBoundaryEdges(boundarySegmentsAtLevel(levelZ));
    }

    public Set<VertexEdge> wallEdgesAtLevel(int levelZ) {
        LinkedHashSet<VertexEdge> result = new LinkedHashSet<>();
        for (Wall wall : wallsAtLevel(levelZ)) {
            result.addAll(wall.edges());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<VertexEdge> doorEdgesAtLevel(int levelZ) {
        LinkedHashSet<VertexEdge> result = new LinkedHashSet<>();
        for (Door door : doorsAtLevel(levelZ)) {
            result.addAll(door.edges());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<VertexEdge> boundaryEdges() {
        LinkedHashSet<VertexEdge> result = new LinkedHashSet<>();
        for (Integer levelZ : levels()) {
            result.addAll(boundaryEdgesAtLevel(levelZ));
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<Point2i> cells() {
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
        for (Floor floor : floorsByLevel.values()) {
            result.addAll(floor.cells());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<Point2i> cellsAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        return floor == null ? Set.of() : floor.cells();
    }

    public Set<CubePoint> cubePoints() {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (Map.Entry<Integer, Floor> entry : floorsByLevel.entrySet()) {
            for (Point2i cell : entry.getValue().cells()) {
                result.add(CubePoint.at(cell, entry.getKey()));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean contains(Point2i cell) {
        return cell != null && floorsByLevel.values().stream().anyMatch(floor -> floor.contains(cell));
    }

    public boolean contains(CubePoint point) {
        return point != null && contains(point.projectedCell()) && cellsAtLevel(point.z()).contains(point.projectedCell());
    }

    public StructureObject movedBy(Point2i delta, int levelDelta) {
        return fromDescriptor(descriptor.translatedByCells(delta, levelDelta));
    }

    private static Floor hydrateFloor(StructureDescriptor.LevelDescriptor level) {
        Set<Point2i> filledCells = hydrateCells(level);
        return new Floor(new TileFaceShape(filledCells), level.anchor2x());
    }

    private static List<Wall> hydrateWalls(StructureDescriptor.LevelDescriptor level) {
        Set<GridSegment2x> wallSegments = new LinkedHashSet<>(level.boundarySegments2x());
        wallSegments.removeAll(level.openingSegments2x());
        return wallSegments.isEmpty() ? List.of() : List.of(Wall.fromSegments(wallSegments));
    }

    private static List<Door> hydrateDoors(StructureDescriptor.LevelDescriptor level) {
        List<Set<GridSegment2x>> doorComponents = connectedComponents(level.openingSegments2x());
        if (doorComponents.isEmpty()) {
            return List.of();
        }
        ArrayList<Door> result = new ArrayList<>();
        for (Set<GridSegment2x> component : doorComponents) {
            result.add(Door.fromSegments(component, Door.DoorState.OPEN));
        }
        return List.copyOf(result);
    }

    // The descriptor keeps one shared boundary language; the floor is rebuilt by filling from tile-center seeds
    // while treating both wall and opening segments as blocking perimeter edges.
    private static Set<Point2i> hydrateCells(StructureDescriptor.LevelDescriptor level) {
        Set<Point2i> seeds = level.fillSeeds2x().stream()
                .map(GridPoint2x::toCellCenter)
                .flatMap(java.util.Optional::stream)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (seeds.isEmpty()) {
            return Set.of();
        }
        Set<VertexEdge> blockedEdges = toBoundaryEdges(level.boundarySegments2x());
        if (blockedEdges.isEmpty()) {
            return Set.copyOf(seeds);
        }
        CellBounds bounds = cellBounds(level.boundarySegments2x(), seeds);
        ArrayDeque<Point2i> queue = new ArrayDeque<>(seeds);
        LinkedHashSet<Point2i> visited = new LinkedHashSet<>();
        while (!queue.isEmpty()) {
            Point2i current = queue.removeFirst();
            if (!bounds.contains(current) || !visited.add(current)) {
                continue;
            }
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = current.add(step);
                if (!bounds.contains(neighbor) || blockedEdges.contains(VertexEdge.betweenCellAndStep(current, step))) {
                    continue;
                }
                queue.addLast(neighbor);
            }
        }
        return visited.isEmpty() ? Set.of() : Set.copyOf(visited);
    }

    private static CellBounds cellBounds(Set<GridSegment2x> boundarySegments, Set<Point2i> seeds) {
        int minX = seeds.stream().mapToInt(Point2i::x).min().orElse(0);
        int maxX = seeds.stream().mapToInt(Point2i::x).max().orElse(0);
        int minY = seeds.stream().mapToInt(Point2i::y).min().orElse(0);
        int maxY = seeds.stream().mapToInt(Point2i::y).max().orElse(0);
        for (GridSegment2x segment : boundarySegments) {
            minX = Math.min(minX, segment.minX2() / 2);
            maxX = Math.max(maxX, (segment.maxX2() - 1) / 2);
            minY = Math.min(minY, segment.minY2() / 2);
            maxY = Math.max(maxY, (segment.maxY2() - 1) / 2);
        }
        return new CellBounds(minX, minY, maxX, maxY);
    }

    private static Set<VertexEdge> toBoundaryEdges(Collection<GridSegment2x> segments) {
        LinkedHashSet<VertexEdge> result = new LinkedHashSet<>();
        if (segments != null) {
            for (GridSegment2x segment : segments) {
                if (segment == null) {
                    continue;
                }
                result.addAll(toBoundaryEdges(segment));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<VertexEdge> toBoundaryEdges(GridSegment2x segment) {
        LinkedHashSet<VertexEdge> result = new LinkedHashSet<>();
        if (segment == null) {
            return Set.of();
        }
        if (segment.isHorizontal()) {
            int y2 = segment.start().y2();
            for (int x2 = segment.minX2(); x2 < segment.maxX2(); x2 += 2) {
                result.add(new VertexEdge(new Point2i(x2 / 2, y2 / 2), new Point2i(x2 / 2 + 1, y2 / 2)));
            }
        } else {
            int x2 = segment.start().x2();
            for (int y2 = segment.minY2(); y2 < segment.maxY2(); y2 += 2) {
                result.add(new VertexEdge(new Point2i(x2 / 2, y2 / 2), new Point2i(x2 / 2, y2 / 2 + 1)));
            }
        }
        return Set.copyOf(result);
    }

    private static Set<GridSegment2x> toBoundarySegments(Collection<VertexEdge> edges) {
        if (edges == null || edges.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        edges.stream()
                .filter(edge -> edge != null)
                .sorted(VertexEdge.EDGE_ORDER)
                .forEach(edge -> result.add(GridSegment2x.fromVertexEdge(edge)));
        return Set.copyOf(result);
    }

    private static List<Set<GridSegment2x>> connectedComponents(Set<GridSegment2x> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridSegment2x> remaining = new LinkedHashSet<>(segments.stream()
                .sorted(GridSegment2x.SEGMENT_ORDER)
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
                attached.sort(GridSegment2x.SEGMENT_ORDER);
                for (GridSegment2x candidate : attached) {
                    remaining.remove(candidate);
                    queue.addLast(candidate);
                }
            }
            result.add(Set.copyOf(component));
        }
        result.sort(Comparator.comparing(component -> component.stream()
                .min(GridSegment2x.SEGMENT_ORDER)
                .orElse(new GridSegment2x(GridPoint2x.fromVertex(new Point2i(0, 0)), GridPoint2x.fromVertex(new Point2i(1, 0)))),
                GridSegment2x.SEGMENT_ORDER));
        return List.copyOf(result);
    }

    private static Map<Integer, Floor> normalizeLegacyFloors(Map<Integer, Floor> floors) {
        if (floors == null || floors.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Floor> result = new LinkedHashMap<>();
        floors.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue() == null ? new Floor(TileShape.empty()) : entry.getValue()));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Set<VertexEdge> legacyWallEdgesForLevel(Set<VertexEdge> boundaryEdges, Collection<Wall> walls) {
        if (boundaryEdges.isEmpty() || walls == null || walls.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<VertexEdge> result = new LinkedHashSet<>();
        for (Wall wall : walls) {
            if (wall == null) {
                continue;
            }
            for (VertexEdge edge : wall.edges()) {
                if (boundaryEdges.contains(edge)) {
                    result.add(edge);
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
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

    private static Map<Integer, List<Wall>> aggregateWalls(Map<Integer, List<Wall>> wallsByLevel) {
        if (wallsByLevel == null || wallsByLevel.isEmpty()) {
            return Map.of(0, List.of());
        }
        LinkedHashSet<VertexEdge> mergedEdges = new LinkedHashSet<>();
        for (List<Wall> walls : wallsByLevel.values()) {
            if (walls == null) {
                continue;
            }
            for (Wall wall : walls) {
                if (wall != null) {
                    mergedEdges.addAll(wall.edges());
                }
            }
        }
        return Map.of(0, mergedEdges.isEmpty() ? List.of() : List.of(new Wall(mergedEdges)));
    }

    private record CellBounds(int minX, int minY, int maxX, int maxY) {
        private boolean contains(Point2i cell) {
            return cell != null
                    && cell.x() >= minX && cell.x() <= maxX
                    && cell.y() >= minY && cell.y() <= maxY;
        }
    }
}

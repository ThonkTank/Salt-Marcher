package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;

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
 * Shared synthesized owner for floor, wall, and door geometry rebuilt from descriptor-native cell and edge truth.
 */
public final class StructureObject {

    private final StructureDescriptor descriptor;
    private final Map<Integer, Floor> floorsByLevel;
    private final Map<Integer, List<Wall>> wallsByLevel;
    private final Map<Integer, List<Door>> doorsByLevel;

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

    public static StructureObject fromCubePoints(Collection<CubePoint> cubePoints) {
        return fromDescriptor(StructureDescriptor.fromCubePoints(cubePoints));
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
    }

    public StructureDescriptor descriptor() {
        return descriptor;
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
        return floorsByLevel.keySet();
    }

    public int primaryLevel() {
        return floorsByLevel.keySet().stream().mapToInt(Integer::intValue).min().orElse(0);
    }

    public CellCoord centerCellCoordAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        return floor == null ? null : floor.centerCellCoord();
    }

    public Point2i centerCellAtLevel(int levelZ) {
        CellCoord centerCell = centerCellCoordAtLevel(levelZ);
        return centerCell == null ? null : centerCell.toPoint2i();
    }

    public CubePoint centerPointAtLevel(int levelZ) {
        CellCoord centerCell = centerCellCoordAtLevel(levelZ);
        return centerCell == null ? null : CubePoint.at(centerCell, levelZ);
    }

    public Set<LegacyGridSegment2x> boundarySegmentsAtLevel(int levelZ) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
        return level == null ? Set.of() : level.boundaryEdges();
    }

    public Set<LegacyGridSegment2x> openingSegmentsAtLevel(int levelZ) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(levelZ);
        return level == null ? Set.of() : level.openingEdges();
    }

    public Set<CellCoord> cellCoords() {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (Floor floor : floorsByLevel.values()) {
            result.addAll(floor.cellCoords());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<Point2i> cells() {
        return CellCoord.toPoints(cellCoords());
    }

    public Set<CellCoord> cellCoordsAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        return floor == null ? Set.of() : floor.cellCoords();
    }

    public Set<Point2i> cellsAtLevel(int levelZ) {
        return CellCoord.toPoints(cellCoordsAtLevel(levelZ));
    }

    public Set<CubePoint> cubePoints() {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (Map.Entry<Integer, Floor> entry : floorsByLevel.entrySet()) {
            for (CellCoord cell : entry.getValue().cellCoords()) {
                result.add(CubePoint.at(cell, entry.getKey()));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && floorsByLevel.values().stream().anyMatch(floor -> floor.contains(cell));
    }

    public boolean contains(Point2i cell) {
        return cell != null && contains(CellCoord.fromPoint(cell));
    }

    public boolean contains(CubePoint point) {
        return point != null && cellCoordsAtLevel(point.z()).contains(point.projectedCell());
    }

    public StructureObject movedBy(Point2i delta, int levelDelta) {
        return fromDescriptor(descriptor.translatedByCells(delta, levelDelta));
    }

    private static Floor hydrateFloor(StructureDescriptor.LevelDescriptor level) {
        return new Floor(hydrateCells(level), level.anchorCell());
    }

    private static List<Wall> hydrateWalls(StructureDescriptor.LevelDescriptor level) {
        Set<LegacyGridSegment2x> wallSegments = new LinkedHashSet<>(level.boundaryEdges());
        wallSegments.removeAll(level.openingEdges());
        return wallSegments.isEmpty() ? List.of() : List.of(Wall.fromSegments(wallSegments));
    }

    private static List<Door> hydrateDoors(StructureDescriptor.LevelDescriptor level) {
        List<Set<LegacyGridSegment2x>> doorComponents = connectedComponents(level.openingEdges());
        if (doorComponents.isEmpty()) {
            return List.of();
        }
        ArrayList<Door> result = new ArrayList<>();
        for (Set<LegacyGridSegment2x> component : doorComponents) {
            result.add(Door.fromSegments(component, Door.DoorState.OPEN));
        }
        return List.copyOf(result);
    }

    // Descriptor truth stays on cell sets plus 2x boundary edges. Hydration may flood-fill from cell seeds, but it
    // must not round-trip through any removed legacy tile or vertex wrapper geometry to recover the floor surface.
    private static Set<CellCoord> hydrateCells(StructureDescriptor.LevelDescriptor level) {
        Set<CellCoord> seeds = level.fillSeeds();
        if (seeds.isEmpty()) {
            return Set.of();
        }
        Set<LegacyGridSegment2x> blockedSegments = stepBoundarySegments(level.boundaryEdges());
        if (blockedSegments.isEmpty()) {
            return Set.copyOf(seeds);
        }
        CellBounds bounds = cellBounds(level.boundaryEdges(), seeds);
        ArrayDeque<CellCoord> queue = new ArrayDeque<>(seeds);
        LinkedHashSet<CellCoord> visited = new LinkedHashSet<>();
        while (!queue.isEmpty()) {
            CellCoord current = queue.removeFirst();
            if (!bounds.contains(current) || !visited.add(current)) {
                continue;
            }
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = current.add(step);
                if (!bounds.contains(neighbor)
                        || blockedSegments.contains(LegacyGridSegment2x.betweenCellAndStep(current, step))) {
                    continue;
                }
                queue.addLast(neighbor);
            }
        }
        return visited.isEmpty() ? Set.of() : Set.copyOf(visited);
    }

    private static CellBounds cellBounds(Set<LegacyGridSegment2x> boundaryEdges, Set<CellCoord> seeds) {
        int minX = seeds.stream().mapToInt(CellCoord::x).min().orElse(0);
        int maxX = seeds.stream().mapToInt(CellCoord::x).max().orElse(0);
        int minY = seeds.stream().mapToInt(CellCoord::y).min().orElse(0);
        int maxY = seeds.stream().mapToInt(CellCoord::y).max().orElse(0);
        for (LegacyGridSegment2x segment : boundaryEdges) {
            minX = Math.min(minX, segment.minX2() / 2);
            maxX = Math.max(maxX, (segment.maxX2() - 1) / 2);
            minY = Math.min(minY, segment.minY2() / 2);
            maxY = Math.max(maxY, (segment.maxY2() - 1) / 2);
        }
        return new CellBounds(minX, minY, maxX, maxY);
    }

    private static Set<LegacyGridSegment2x> stepBoundarySegments(Collection<LegacyGridSegment2x> segments) {
        LinkedHashSet<LegacyGridSegment2x> result = new LinkedHashSet<>();
        if (segments != null) {
            for (LegacyGridSegment2x segment : segments) {
                if (segment == null) {
                    continue;
                }
                result.addAll(stepBoundarySegments(segment));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<LegacyGridSegment2x> stepBoundarySegments(LegacyGridSegment2x segment) {
        LinkedHashSet<LegacyGridSegment2x> result = new LinkedHashSet<>();
        if (segment == null) {
            return Set.of();
        }
        if (segment.isHorizontal()) {
            int y2 = segment.start().y2();
            for (int x2 = segment.minX2(); x2 < segment.maxX2(); x2 += 2) {
                result.add(new LegacyGridSegment2x(LegacyGridPoint2x.fromRaw(x2, y2), LegacyGridPoint2x.fromRaw(x2 + 2, y2)));
            }
        } else {
            int x2 = segment.start().x2();
            for (int y2 = segment.minY2(); y2 < segment.maxY2(); y2 += 2) {
                result.add(new LegacyGridSegment2x(LegacyGridPoint2x.fromRaw(x2, y2), LegacyGridPoint2x.fromRaw(x2, y2 + 2)));
            }
        }
        return Set.copyOf(result);
    }

    private static List<Set<LegacyGridSegment2x>> connectedComponents(Set<LegacyGridSegment2x> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<LegacyGridSegment2x> remaining = new LinkedHashSet<>(segments.stream()
                .sorted(LegacyGridSegment2x.SEGMENT_ORDER)
                .toList());
        ArrayList<Set<LegacyGridSegment2x>> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            LegacyGridSegment2x seed = remaining.iterator().next();
            ArrayDeque<LegacyGridSegment2x> queue = new ArrayDeque<>();
            LinkedHashSet<LegacyGridSegment2x> component = new LinkedHashSet<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                LegacyGridSegment2x current = queue.removeFirst();
                component.add(current);
                ArrayList<LegacyGridSegment2x> attached = new ArrayList<>();
                for (LegacyGridSegment2x candidate : remaining) {
                    if (current.sharesEndpoint(candidate)) {
                        attached.add(candidate);
                    }
                }
                attached.sort(LegacyGridSegment2x.SEGMENT_ORDER);
                for (LegacyGridSegment2x candidate : attached) {
                    remaining.remove(candidate);
                    queue.addLast(candidate);
                }
            }
            result.add(Set.copyOf(component));
        }
        result.sort(Comparator.comparing((Set<LegacyGridSegment2x> component) -> component.stream()
                .min(LegacyGridSegment2x.SEGMENT_ORDER)
                .orElse(new LegacyGridSegment2x(LegacyGridPoint2x.fromRaw(0, 0), LegacyGridPoint2x.fromRaw(2, 0))),
                LegacyGridSegment2x.SEGMENT_ORDER));
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

    private record CellBounds(int minX, int minY, int maxX, int maxY) {
        private boolean contains(CellCoord cell) {
            return cell != null
                    && cell.x() >= minX && cell.x() <= maxX
                    && cell.y() >= minY && cell.y() <= maxY;
        }
    }
}

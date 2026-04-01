package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.BoundaryNetwork;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Canonical owner for the walkable floor area and its structural boundary walls.
 *
 * <p>This keeps the common "floor + wall" geometry in one place so structures such as rooms and corridors can share
 * the same rendering, hit-testing, and runtime queries without carrying parallel geometry logic.</p>
 */
public final class StructureGeometry {

    private final Map<Integer, Floor> floors;
    private final List<Wall> walls;

    public static StructureGeometry empty() {
        return new StructureGeometry(Map.of(), List.of());
    }

    public static StructureGeometry create(Floor floor) {
        return create(Map.of(0, floor == null ? new Floor(TileShape.empty()) : floor));
    }

    public static StructureGeometry create(Map<Integer, Floor> floors) {
        Map<Integer, Floor> resolvedFloors = normalizedFloors(floors);
        Set<VertexEdge> boundaryEdges = boundaryEdges(resolvedFloors);
        return new StructureGeometry(
                resolvedFloors,
                boundaryEdges.isEmpty() ? List.of() : List.of(new Wall(boundaryEdges)));
    }

    public static StructureGeometry resolved(Map<Integer, Floor> floors, Collection<Wall> walls) {
        Map<Integer, Floor> resolvedFloors = normalizedFloors(floors);
        return new StructureGeometry(
                resolvedFloors,
                normalizedWalls(walls, boundaryEdges(resolvedFloors)));
    }

    public static StructureGeometry fromCubePoints(Collection<CubePoint> cubePoints) {
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
        if (cellsByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, Floor> floors = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Point2i>> entry : cellsByLevel.entrySet()) {
            floors.put(entry.getKey(), new Floor(TileShape.fromAbsoluteCells(entry.getValue())));
        }
        return create(floors);
    }

    public StructureGeometry(Map<Integer, Floor> floors, Collection<Wall> walls) {
        this.floors = normalizedFloors(floors);
        this.walls = normalizedWalls(walls, boundaryEdges(this.floors));
    }

    public Map<Integer, Floor> floors() {
        return floors;
    }

    public List<Wall> walls() {
        return walls;
    }

    public Floor floor() {
        return floors.get(primaryLevel());
    }

    public Floor floorAtLevel(int z) {
        return floors.get(z);
    }

    public Set<Integer> levels() {
        return Set.copyOf(floors.keySet());
    }

    public Map<Integer, TileShape> shapesByLevel() {
        if (floors.isEmpty()) {
            return Map.of();
        }
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            result.put(entry.getKey(), entry.getValue().shape());
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public Map<Integer, Point2i> anchorsByLevel() {
        if (floors.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Point2i> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            result.put(entry.getKey(), entry.getValue().shape().anchor());
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    public int primaryLevel() {
        return floors.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public Point2i centerCellAtLevel(int levelZ) {
        Floor floor = floorAtLevel(levelZ);
        if (floor == null || floor.shape() == null || floor.shape().size() == 0) {
            return null;
        }
        return floor.shape().centerCell();
    }

    public BoundaryNetwork boundaryNetwork() {
        return BoundaryNetwork.fromPaths(walls);
    }

    public Set<VertexEdge> boundaryEdges() {
        return boundaryNetwork().edges();
    }

    public Set<Point2i> cells() {
        Set<Point2i> result = new LinkedHashSet<>();
        for (Floor floor : floors.values()) {
            result.addAll(floor.shape().absoluteCells());
        }
        return Set.copyOf(result);
    }

    public Set<Point2i> cellsAtLevel(int z) {
        Floor floor = floorAtLevel(z);
        return floor == null ? Set.of() : floor.shape().absoluteCells();
    }

    public Set<CubePoint> cubePoints() {
        Set<CubePoint> result = new LinkedHashSet<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            if (entry == null || entry.getValue() == null) {
                continue;
            }
            for (Point2i cell : entry.getValue().shape().absoluteCells()) {
                result.add(CubePoint.at(cell, entry.getKey()));
            }
        }
        return Set.copyOf(result);
    }

    public boolean contains(Point2i cell) {
        return cell != null && floors.values().stream().anyMatch(floor -> floor.shape().contains(cell));
    }

    public boolean contains(CubePoint point) {
        return point != null && cellsAtLevel(point.z()).contains(point.projectedCell());
    }

    public StructureGeometry movedBy(Point2i delta) {
        return movedBy(delta, 0);
    }

    public StructureGeometry movedBy(Point2i delta, int levelDelta) {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return this;
        }
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        Map<Integer, Floor> movedFloors = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            movedFloors.put(entry.getKey() + levelDelta, entry.getValue().movedBy(resolvedDelta));
        }
        List<Wall> movedWalls = walls.stream()
                .map(wall -> wall == null ? null : wall.movedBy(resolvedDelta))
                .filter(wall -> wall != null)
                .toList();
        return new StructureGeometry(movedFloors, movedWalls);
    }

    public StructureGeometry withFloors(Map<Integer, Floor> floors) {
        return new StructureGeometry(floors, walls);
    }

    public StructureGeometry withWalls(Collection<Wall> walls) {
        return new StructureGeometry(floors, walls);
    }

    private static Map<Integer, Floor> normalizedFloors(Map<Integer, Floor> floors) {
        if (floors == null || floors.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Floor> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            result.put(entry.getKey(), entry.getValue() == null ? new Floor(TileShape.empty()) : entry.getValue());
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Set<VertexEdge> boundaryEdges(Map<Integer, Floor> floors) {
        Set<VertexEdge> result = new LinkedHashSet<>();
        for (Floor floor : normalizedFloors(floors).values()) {
            result.addAll(floor.shape().boundaryEdges());
        }
        return Set.copyOf(result);
    }

    private static List<Wall> normalizedWalls(Collection<Wall> walls, Set<VertexEdge> allowedEdges) {
        if (walls == null || walls.isEmpty() || allowedEdges == null || allowedEdges.isEmpty()) {
            return List.of();
        }
        List<Wall> result = new java.util.ArrayList<>();
        for (Wall wall : walls) {
            if (wall == null) {
                continue;
            }
            Set<VertexEdge> edges = new LinkedHashSet<>();
            for (VertexEdge edge : wall.edges()) {
                if (allowedEdges.contains(edge)) {
                    edges.add(edge);
                }
            }
            if (!edges.isEmpty()) {
                result.add(new Wall(edges));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}

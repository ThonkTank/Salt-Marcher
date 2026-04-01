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

    private final StructureObject structureObject;

    public static StructureGeometry empty() {
        return new StructureGeometry(StructureObject.empty());
    }

    public static StructureGeometry create(Floor floor) {
        return create(Map.of(0, floor == null ? new Floor(TileShape.empty()) : floor));
    }

    public static StructureGeometry create(Map<Integer, Floor> floors) {
        Map<Integer, Floor> resolvedFloors = normalizedFloors(floors);
        Set<VertexEdge> boundaryEdges = boundaryEdges(resolvedFloors);
        return new StructureGeometry(StructureObject.fromLegacyFloorsAndWalls(
                resolvedFloors,
                boundaryEdges.isEmpty() ? List.of() : List.of(new Wall(boundaryEdges))));
    }

    public static StructureGeometry resolved(Map<Integer, Floor> floors, Collection<Wall> walls) {
        Map<Integer, Floor> resolvedFloors = normalizedFloors(floors);
        return new StructureGeometry(StructureObject.fromLegacyFloorsAndWalls(
                resolvedFloors,
                normalizedWalls(walls, boundaryEdges(resolvedFloors))));
    }

    public static StructureGeometry fromCubePoints(Collection<CubePoint> cubePoints) {
        return new StructureGeometry(StructureObject.fromCubePoints(cubePoints));
    }

    public StructureGeometry(Map<Integer, Floor> floors, Collection<Wall> walls) {
        this(StructureObject.fromLegacyFloorsAndWalls(
                normalizedFloors(floors),
                normalizedWalls(walls, boundaryEdges(normalizedFloors(floors)))));
    }

    public StructureGeometry(StructureObject structureObject) {
        this.structureObject = structureObject == null ? StructureObject.empty() : structureObject;
    }

    public StructureObject structureObject() {
        return structureObject;
    }

    public Map<Integer, Floor> floors() {
        return structureObject.floors();
    }

    public List<Wall> walls() {
        return structureObject.walls();
    }

    public Floor floor() {
        return structureObject.floor();
    }

    public Floor floorAtLevel(int z) {
        return structureObject.floorAtLevel(z);
    }

    public TileShape shapeAtLevel(int z) {
        return structureObject.shapeAtLevel(z);
    }

    public Set<Integer> levels() {
        return structureObject.levels();
    }

    public Map<Integer, TileShape> shapesByLevel() {
        return structureObject.shapesByLevel();
    }

    public Map<Integer, Point2i> anchorsByLevel() {
        return structureObject.anchorsByLevel();
    }

    public Point2i anchorAtLevel(int levelZ) {
        return structureObject.anchorAtLevel(levelZ);
    }

    public int primaryLevel() {
        return structureObject.primaryLevel();
    }

    public Point2i centerCellAtLevel(int levelZ) {
        return structureObject.centerCellAtLevel(levelZ);
    }

    public CubePoint centerPointAtLevel(int levelZ) {
        return structureObject.centerPointAtLevel(levelZ);
    }

    public BoundaryNetwork boundaryNetwork() {
        return BoundaryNetwork.fromPaths(walls());
    }

    public Set<VertexEdge> boundaryEdges() {
        return boundaryNetwork().edges();
    }

    public Set<VertexEdge> boundaryEdgesAtLevel(int levelZ) {
        return structureObject.wallEdgesAtLevel(levelZ);
    }

    public Set<Point2i> cells() {
        return structureObject.cells();
    }

    public Set<Point2i> cellsAtLevel(int z) {
        return structureObject.cellsAtLevel(z);
    }

    public Set<CubePoint> cubePoints() {
        return structureObject.cubePoints();
    }

    public boolean contains(Point2i cell) {
        return structureObject.contains(cell);
    }

    public boolean contains(CubePoint point) {
        return structureObject.contains(point);
    }

    public StructureGeometry movedBy(Point2i delta) {
        return movedBy(delta, 0);
    }

    public StructureGeometry movedBy(Point2i delta, int levelDelta) {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return this;
        }
        return new StructureGeometry(structureObject.movedBy(delta, levelDelta));
    }

    public StructureGeometry withFloors(Map<Integer, Floor> floors) {
        return new StructureGeometry(floors, walls());
    }

    public StructureGeometry withWalls(Collection<Wall> walls) {
        return new StructureGeometry(floors(), walls);
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

package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.BoundaryNetwork;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.TargetKey;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record Room(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        Map<Integer, Floor> floors,
        List<Wall> walls,
        RoomNarration narration
) {
    private static final String TARGET_KEY_PREFIX = "room:";

    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor
    ) {
        return create(roomId, mapId, clusterId, name, floor, RoomNarration.empty());
    }

    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            RoomNarration narration
    ) {
        return create(roomId, mapId, clusterId, name, Map.of(0, floor == null ? new Floor(null) : floor), narration);
    }

    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, Floor> floors
    ) {
        return create(roomId, mapId, clusterId, name, floors, RoomNarration.empty());
    }

    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, Floor> floors,
            RoomNarration narration
    ) {
        Map<Integer, Floor> resolvedFloors = normalizedFloors(floors);
        return resolved(
                roomId,
                mapId,
                clusterId,
                name,
                resolvedFloors,
                List.of(new Wall(boundaryEdges(resolvedFloors))),
                narration);
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            Collection<Wall> walls
    ) {
        return resolved(roomId, mapId, clusterId, name, floor, walls, RoomNarration.empty());
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Floor floor,
            Collection<Wall> walls,
            RoomNarration narration
    ) {
        return resolved(roomId, mapId, clusterId, name, Map.of(0, floor == null ? new Floor(null) : floor), walls, narration);
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, Floor> floors,
            Collection<Wall> walls
    ) {
        return resolved(roomId, mapId, clusterId, name, floors, walls, RoomNarration.empty());
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, Floor> floors,
            Collection<Wall> walls,
            RoomNarration narration
    ) {
        Map<Integer, Floor> resolvedFloors = normalizedFloors(floors);
        List<Wall> canonicalWalls = normalizedWalls(walls, boundaryEdges(resolvedFloors));
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                resolvedFloors,
                canonicalWalls,
                narration);
    }

    public Room {
        floors = normalizedFloors(floors);
        walls = walls == null ? List.of() : List.copyOf(walls);
        narration = narration == null ? RoomNarration.empty() : narration;
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
            return Map.of(0, TileShape.empty());
        }
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            result.put(entry.getKey(), entry.getValue().shape());
        }
        return result.isEmpty() ? Map.of(0, TileShape.empty()) : Map.copyOf(result);
    }

    public Map<Integer, Point2i> anchorsByLevel() {
        if (floors.isEmpty()) {
            return Map.of(0, new Point2i(0, 0));
        }
        Map<Integer, Point2i> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            result.put(entry.getKey(), entry.getValue().shape().anchor());
        }
        return result.isEmpty() ? Map.of(0, new Point2i(0, 0)) : Map.copyOf(result);
    }

    public int primaryLevel() {
        return floors.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public Room withFloor(Floor floor) {
        return resolved(roomId, mapId, clusterId, name, Map.of(primaryLevel(), floor == null ? new Floor(null) : floor), walls, narration);
    }

    public Room withFloors(Map<Integer, Floor> floors) {
        return resolved(roomId, mapId, clusterId, name, floors, walls, narration);
    }

    public Room withBoundaries(List<Wall> walls) {
        return resolved(roomId, mapId, clusterId, name, floors, walls, narration);
    }

    public Room withNarration(RoomNarration narration) {
        return resolved(roomId, mapId, clusterId, name, floors, walls, narration);
    }

    public String targetKey() {
        return targetKey(roomId);
    }

    public static String targetKey(Long roomId) {
        return TargetKey.of(TARGET_KEY_PREFIX, roomId).value();
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long roomIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
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

    public Room movedBy(Point2i delta) {
        if (delta == null || (delta.x() == 0 && delta.y() == 0)) {
            return this;
        }
        Map<Integer, Floor> movedFloors = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            movedFloors.put(entry.getKey(), entry.getValue().movedBy(delta));
        }
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                movedFloors,
                walls.stream().map(wall -> wall.movedBy(delta)).toList(),
                narration);
    }

    private static Map<Integer, Floor> normalizedFloors(Map<Integer, Floor> floors) {
        if (floors == null || floors.isEmpty()) {
            return Map.of(0, new Floor(null));
        }
        Map<Integer, Floor> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            result.put(entry.getKey(), entry.getValue() == null ? new Floor(null) : entry.getValue());
        }
        return result.isEmpty() ? Map.of(0, new Floor(null)) : Map.copyOf(result);
    }

    private static Set<VertexEdge> boundaryEdges(Map<Integer, Floor> floors) {
        Set<VertexEdge> result = new LinkedHashSet<>();
        for (Floor floor : normalizedFloors(floors).values()) {
            result.addAll(floor.shape().boundaryEdges());
        }
        return Set.copyOf(result);
    }

    private static List<Wall> normalizedWalls(Collection<Wall> walls, Set<VertexEdge> allowedEdges) {
        List<Wall> result = new java.util.ArrayList<>();
        if (walls == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return result;
        }
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
        return List.copyOf(result);
    }
}

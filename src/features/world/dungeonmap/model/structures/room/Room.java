package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.BoundaryNetwork;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.StructureGeometry;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.TargetKey;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record Room(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        StructureGeometry geometry,
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
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                StructureGeometry.create(normalizedRoomFloors(floors)),
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
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                StructureGeometry.resolved(normalizedRoomFloors(floors), walls),
                narration);
    }

    public Room {
        geometry = normalizeGeometry(geometry);
        narration = narration == null ? RoomNarration.empty() : narration;
    }

    public Map<Integer, Floor> floors() {
        return geometry.floors().isEmpty() ? Map.of(0, new Floor(null)) : geometry.floors();
    }

    public List<Wall> walls() {
        return geometry.walls();
    }

    public Floor floor() {
        return geometry.floor();
    }

    public Floor floorAtLevel(int z) {
        return geometry.floorAtLevel(z);
    }

    public Set<Integer> levels() {
        return geometry.levels();
    }

    public Map<Integer, TileShape> shapesByLevel() {
        Map<Integer, TileShape> shapesByLevel = geometry.shapesByLevel();
        return shapesByLevel.isEmpty() ? Map.of(0, TileShape.empty()) : shapesByLevel;
    }

    public Map<Integer, Point2i> anchorsByLevel() {
        Map<Integer, Point2i> anchorsByLevel = geometry.anchorsByLevel();
        return anchorsByLevel.isEmpty() ? Map.of(0, new Point2i(0, 0)) : anchorsByLevel;
    }

    public int primaryLevel() {
        return geometry.primaryLevel();
    }

    public Room withFloor(Floor floor) {
        return resolved(
                roomId,
                mapId,
                clusterId,
                name,
                Map.of(primaryLevel(), floor == null ? new Floor(null) : floor),
                walls(),
                narration);
    }

    public Room withFloors(Map<Integer, Floor> floors) {
        return resolved(roomId, mapId, clusterId, name, floors, walls(), narration);
    }

    public Room withBoundaries(List<Wall> walls) {
        return resolved(roomId, mapId, clusterId, name, floors(), walls, narration);
    }

    public Room withNarration(RoomNarration narration) {
        return new Room(roomId, mapId, clusterId, name, geometry, narration);
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
        return geometry.boundaryNetwork();
    }

    public Set<VertexEdge> boundaryEdges() {
        return geometry.boundaryEdges();
    }

    public Set<Point2i> cells() {
        return geometry.cells();
    }

    public Set<Point2i> cellsAtLevel(int z) {
        return geometry.cellsAtLevel(z);
    }

    public Set<CubePoint> cubePoints() {
        return geometry.cubePoints();
    }

    public boolean contains(Point2i cell) {
        return geometry.contains(cell);
    }

    public boolean contains(CubePoint point) {
        return geometry.contains(point);
    }

    public Room movedBy(Point2i delta) {
        return movedBy(delta, 0);
    }

    public Room movedBy(Point2i delta, int levelDelta) {
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                geometry.movedBy(delta, levelDelta),
                narration);
    }

    public Room movedToLevel(int targetPrimaryLevel) {
        return movedBy(new Point2i(0, 0), targetPrimaryLevel - primaryLevel());
    }

    public Room movedByLevel(int levelDelta) {
        return movedBy(new Point2i(0, 0), levelDelta);
    }

    private static StructureGeometry normalizeGeometry(StructureGeometry geometry) {
        if (geometry == null || geometry.floors().isEmpty()) {
            return StructureGeometry.create(Map.of(0, new Floor(null)));
        }
        return geometry;
    }

    private static Map<Integer, Floor> normalizedRoomFloors(Map<Integer, Floor> floors) {
        if (floors == null || floors.isEmpty()) {
            return Map.of(0, new Floor(null));
        }
        Map<Integer, Floor> result = new java.util.LinkedHashMap<>();
        for (Map.Entry<Integer, Floor> entry : floors.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            result.put(entry.getKey(), entry.getValue() == null ? new Floor(null) : entry.getValue());
        }
        return result.isEmpty() ? Map.of(0, new Floor(null)) : Map.copyOf(result);
    }
}

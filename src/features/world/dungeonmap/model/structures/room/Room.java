package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.StructureGeometry;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.TargetKey;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record Room(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        StructureObject structure,
        RoomNarration narration
) {
    private static final String TARGET_KEY_PREFIX = "room:";

    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            StructureObject structure
    ) {
        return create(roomId, mapId, clusterId, name, structure, RoomNarration.empty());
    }

    public static Room create(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            StructureObject structure,
            RoomNarration narration
    ) {
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                normalizeStructure(structure),
                narration);
    }

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
        return create(roomId, mapId, clusterId, name, createdStructure(normalizedRoomFloors(floors)), narration);
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            StructureObject structure
    ) {
        return resolved(roomId, mapId, clusterId, name, structure, RoomNarration.empty());
    }

    public static Room resolved(
            Long roomId,
            long mapId,
            long clusterId,
            String name,
            StructureObject structure,
            RoomNarration narration
    ) {
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                normalizeStructure(structure),
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
        return resolved(roomId, mapId, clusterId, name, resolvedStructure(normalizedRoomFloors(floors), walls), narration);
    }

    public Room {
        structure = normalizeStructure(structure);
        narration = narration == null ? RoomNarration.empty() : narration;
    }

    public StructureGeometry geometry() {
        return new StructureGeometry(structure);
    }

    public Room withFloor(Floor floor) {
        return resolved(
                roomId,
                mapId,
                clusterId,
                name,
                Map.of(structure.primaryLevel(), floor == null ? new Floor(null) : floor),
                structure.walls(),
                narration);
    }

    public Room withFloors(Map<Integer, Floor> floors) {
        return resolved(roomId, mapId, clusterId, name, floors, structure.walls(), narration);
    }

    public Room withBoundaries(List<Wall> walls) {
        return resolved(roomId, mapId, clusterId, name, structure.floors(), walls, narration);
    }

    public Room withNarration(RoomNarration narration) {
        return new Room(roomId, mapId, clusterId, name, structure, narration);
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

    public Room movedBy(Point2i delta) {
        return movedBy(delta, 0);
    }

    public Room movedBy(Point2i delta, int levelDelta) {
        return new Room(
                roomId,
                mapId,
                clusterId,
                name,
                structure.movedBy(delta, levelDelta),
                narration);
    }

    public Room movedToLevel(int targetPrimaryLevel) {
        return movedBy(new Point2i(0, 0), targetPrimaryLevel - structure.primaryLevel());
    }

    public Room movedByLevel(int levelDelta) {
        return movedBy(new Point2i(0, 0), levelDelta);
    }

    private static StructureObject normalizeStructure(StructureObject structure) {
        if (structure == null || structure.floors().isEmpty()) {
            return createdStructure(Map.of(0, new Floor(null)));
        }
        return structure;
    }

    private static StructureObject createdStructure(Map<Integer, Floor> floors) {
        Map<Integer, Floor> resolvedFloors = normalizedRoomFloors(floors);
        Set<VertexEdge> boundaryEdges = new LinkedHashSet<>();
        for (Floor floor : resolvedFloors.values()) {
            boundaryEdges.addAll(floor.shape().boundaryEdges());
        }
        return resolvedStructure(
                resolvedFloors,
                boundaryEdges.isEmpty() ? List.of() : List.of(new Wall(boundaryEdges)));
    }

    private static StructureObject resolvedStructure(Map<Integer, Floor> floors, Collection<Wall> walls) {
        return StructureObject.fromLegacyFloorsAndWalls(normalizedRoomFloors(floors), walls);
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

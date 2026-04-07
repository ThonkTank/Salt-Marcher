package features.world.dungeonmap.structure.model.room;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.structure.model.Structure;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Structure-owned room topology derived from one physical structure plus persisted room metadata.
 */
public final class StructureRoomTopology {

    private static final StructureRoomTopology EMPTY = new StructureRoomTopology(
            0L,
            null,
            null,
            StructureRoomProjectionIndex.empty(),
            StructureRoomGraph.empty());

    private final long mapId;
    private final Long clusterId;
    private final Structure clusterStructure;
    private final StructureRoomProjectionIndex projectionIndex;
    private final StructureRoomGraph graph;

    public static StructureRoomTopology empty() {
        return EMPTY;
    }

    public static StructureRoomTopology derive(
            long mapId,
            Long clusterId,
            Structure clusterStructure,
            List<Room> roomMetadata
    ) {
        StructureRoomProjectionIndex projectionIndex = StructureRoomProjectionIndex.derive(mapId, clusterId, clusterStructure, roomMetadata);
        if (projectionIndex.isEmpty()) {
            return new StructureRoomTopology(mapId, clusterId, clusterStructure, projectionIndex, StructureRoomGraph.empty());
        }
        return new StructureRoomTopology(
                mapId,
                clusterId,
                clusterStructure,
                projectionIndex,
                StructureRoomGraph.derive(mapId, clusterId, clusterStructure, projectionIndex));
    }

    private StructureRoomTopology(
            long mapId,
            Long clusterId,
            Structure clusterStructure,
            StructureRoomProjectionIndex projectionIndex,
            StructureRoomGraph graph
    ) {
        this.mapId = mapId;
        this.clusterId = clusterId;
        this.clusterStructure = clusterStructure;
        this.projectionIndex = projectionIndex == null ? StructureRoomProjectionIndex.empty() : projectionIndex;
        this.graph = graph == null ? StructureRoomGraph.empty() : graph;
    }

    public long mapId() {
        return mapId;
    }

    public Long clusterId() {
        return clusterId;
    }

    public boolean isEmpty() {
        return (clusterStructure == null || clusterStructure.levels().isEmpty()) && projectionIndex.isEmpty();
    }

    public List<Room> rooms() {
        return projectionIndex.rooms();
    }

    public List<DungeonConnection> localConnections() {
        return graph.localConnections();
    }

    public StructureRoomTopology withRooms(List<Room> rooms) {
        return derive(mapId, clusterId, clusterStructure, rooms);
    }

    public StructureRoomTopology withClusterId(Long clusterId) {
        long resolvedClusterId = clusterId == null ? (this.clusterId == null ? 0L : this.clusterId) : clusterId;
        return derive(
                mapId,
                clusterId,
                clusterStructure,
                rooms().stream()
                        .map(room -> room == null ? null : room.withClusterId(resolvedClusterId))
                        .toList());
    }

    public StructureRoomTopology rebasedTo(Structure structure) {
        return derive(mapId, clusterId, structure, rooms());
    }

    public StructureRoomTopology translatedBy(GridPoint delta, int levelDelta, Structure movedStructure) {
        return derive(
                mapId,
                clusterId,
                movedStructure,
                rooms().stream()
                        .map(room -> room == null ? null : room.movedBy(delta, levelDelta))
                        .toList());
    }

    public StructureRoomTopology projectedToLevel(int levelZ, Structure projectedStructure) {
        if (projectedStructure == null || projectedStructure.levels().isEmpty()) {
            return empty();
        }
        List<Room> projectedRooms = rooms().stream()
                .map(room -> projectRoomToLevel(room, levelZ))
                .filter(Objects::nonNull)
                .toList();
        return derive(mapId, clusterId, projectedStructure, projectedRooms);
    }

    public Set<Integer> roomLevels(Room room) {
        return structureFor(room).levels();
    }

    public Set<Integer> roomLevels(Long roomId) {
        return structureFor(roomId).levels();
    }

    public int roomPrimaryLevel(Room room) {
        return structureFor(room).primaryLevel();
    }

    public int roomPrimaryLevel(Long roomId) {
        return structureFor(roomId).primaryLevel();
    }

    public List<Integer> roomRelevantLevels(Room room, GridPoint focusCell, int focusLevelZ) {
        Structure roomStructure = structureFor(room);
        if (focusCell != null && roomStructure.surfaceAtLevel(focusLevelZ).surface().contains(focusCell)) {
            return List.of(focusLevelZ);
        }
        return roomStructure.levels().stream()
                .sorted()
                .toList();
    }

    public Room findRoom(Long roomId) {
        return projectionIndex.findRoom(roomId);
    }

    public Set<Long> roomIds() {
        return projectionIndex.roomIds();
    }

    public boolean containsRoom(Long roomId) {
        return projectionIndex.containsRoom(roomId);
    }

    public Room roomAt(GridPoint cell, int levelZ) {
        return projectionIndex.roomAt(cell, levelZ);
    }

    public Room roomAt(GridPoint point) {
        return projectionIndex.roomAt(point);
    }

    public Set<GridPoint> cubePoints() {
        return projectionIndex.cubePoints();
    }

    public List<Room> adjacentRooms(Room room) {
        if (room == null || room.roomId() == null) {
            return List.of();
        }
        return adjacentRoomIds(room.roomId()).stream()
                .map(this::findRoom)
                .filter(Objects::nonNull)
                .toList();
    }

    public Set<Long> adjacentRoomIds(Long roomId) {
        return graph.adjacentRoomIds(roomId);
    }

    public List<Set<Long>> components() {
        return graph.components();
    }

    public Set<Long> componentContaining(Long roomId) {
        return graph.componentContaining(roomId);
    }

    public Set<Long> componentContaining(GridPoint cell, int levelZ) {
        Room room = roomAt(cell, levelZ);
        return room == null ? Set.of() : componentContaining(room.roomId());
    }

    public boolean isConnected() {
        return graph.isConnected();
    }

    public boolean hasOverlappingRooms() {
        return projectionIndex.hasOverlaps();
    }

    public boolean canMergeRooms(Set<Long> roomIds) {
        return graph.canMergeRooms(roomIds);
    }

    public Structure structureFor(Room room) {
        return projectionIndex.structureFor(room);
    }

    public Structure structureFor(Long roomId) {
        return projectionIndex.structureFor(roomId);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureRoomTopology that)) {
            return false;
        }
        return mapId == that.mapId
                && projectionIndex.hasOverlaps() == that.projectionIndex.hasOverlaps()
                && Objects.equals(clusterId, that.clusterId)
                && Objects.equals(projectionIndex.rooms(), that.projectionIndex.rooms())
                && Objects.equals(projectionIndex.roomCellsByRoom(), that.projectionIndex.roomCellsByRoom())
                && Objects.equals(projectionIndex.roomsById(), that.projectionIndex.roomsById())
                && Objects.equals(projectionIndex.roomsByPoint(), that.projectionIndex.roomsByPoint())
                && Objects.equals(graph.localConnections(), that.graph.localConnections());
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                mapId,
                clusterId,
                projectionIndex.rooms(),
                projectionIndex.roomCellsByRoom(),
                projectionIndex.roomsById(),
                projectionIndex.roomsByPoint(),
                projectionIndex.hasOverlaps(),
                graph.localConnections());
    }

    @Override
    public String toString() {
        return "StructureRoomTopology[mapId=" + mapId
                + ", clusterId=" + clusterId
                + ", rooms=" + projectionIndex.rooms()
                + ", hasOverlaps=" + projectionIndex.hasOverlaps() + "]";
    }

    private static Room projectRoomToLevel(Room room, int levelZ) {
        if (room == null || room.anchorAtLevel(levelZ) == null) {
            return null;
        }
        return Room.metadata(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                Map.of(levelZ, room.anchorAtLevel(levelZ)),
                room.narration());
    }
}

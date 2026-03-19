package features.world.quarantine.dungeonmap.layout.model;

import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.application.spi.ClusterAnchor;

import features.world.quarantine.dungeonmap.corridors.model.*;
import features.world.quarantine.dungeonmap.rooms.model.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonLayout {

    private final DungeonMap map;
    private final List<DungeonRoom> rooms;
    private final List<DungeonCorridor> corridors;
    private final List<DungeonRoomCluster> clusters;
    private final Map<Long, DungeonRoom> roomsById;
    private final Map<Long, DungeonCorridor> corridorsById;

    private final DungeonLayoutIndex layoutIndex;

    public DungeonLayout(
            DungeonMap map,
            List<DungeonRoom> rooms,
            List<DungeonCorridor> corridors,
            List<DungeonRoomCluster> clusters
    ) {
        this.map = map;
        this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
        this.clusters = clusters == null ? List.of() : List.copyOf(clusters);
        this.corridors = corridors == null ? List.of() : List.copyOf(corridors);
        this.roomsById = indexRooms(this.rooms);
        this.corridorsById = indexCorridors(this.corridors);
        this.layoutIndex = DungeonLayoutIndex.build(this.clusters, this.rooms);
    }

    public DungeonLayoutIndex index() {
        return layoutIndex;
    }

    public DungeonMap map() {
        return map;
    }

    public List<DungeonRoom> rooms() {
        return rooms;
    }

    public List<DungeonCorridor> corridors() {
        return corridors;
    }

    public List<DungeonRoomCluster> clusters() {
        return clusters;
    }

    public DungeonRoom findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public DungeonCorridor findCorridor(Long corridorId) {
        return corridorId == null ? null : corridorsById.get(corridorId);
    }

    public DungeonRoomCluster findCluster(Long clusterId) {
        return index().findCluster(clusterId);
    }

    public ClusterAnchor clusterAnchor(Long clusterId) {
        DungeonRoomCluster cluster = findCluster(clusterId);
        return cluster == null ? null : new ClusterAnchor(cluster.clusterId(), cluster.center());
    }

    public Long clusterIdForRoom(Long roomId) {
        DungeonRoom room = findRoom(roomId);
        return room == null ? null : room.clusterId();
    }

    public List<Long> corridorIdsForRooms(Set<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return List.of();
        }
        return corridors.stream()
                .filter(c -> c != null && c.corridorId() != null)
                .filter(c -> c.roomIds().stream().anyMatch(roomIds::contains))
                .map(DungeonCorridor::corridorId)
                .toList();
    }

    public List<DungeonRoom> roomsForCluster(Long clusterId) {
        return index().roomsForCluster(clusterId);
    }

    public DungeonRoomCluster clusterForRoom(Long roomId) {
        return index().clusterForRoom(roomId);
    }

    public RoomShape roomShape(Long roomId) {
        return index().roomShape(roomId);
    }

    public Set<Point2i> roomCells(Long roomId) {
        return index().roomCells(roomId);
    }

    public DungeonRoom roomAtCell(Point2i cell) {
        return index().roomAtCell(cell);
    }

    public DungeonRoomCluster clusterAtCell(Point2i cell) {
        return index().clusterAtCell(cell);
    }

    public Set<Point2i> clusterCells(Long clusterId) {
        return index().clusterCells(clusterId);
    }

    public List<List<Point2i>> clusterLoops(Long clusterId) {
        return index().clusterLoops(clusterId);
    }

    private static Map<Long, DungeonRoom> indexRooms(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            if (room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonCorridor> indexCorridors(List<DungeonCorridor> corridors) {
        Map<Long, DungeonCorridor> result = new LinkedHashMap<>();
        for (DungeonCorridor corridor : corridors) {
            if (corridor.corridorId() != null) {
                result.put(corridor.corridorId(), corridor);
            }
        }
        return Map.copyOf(result);
    }
}

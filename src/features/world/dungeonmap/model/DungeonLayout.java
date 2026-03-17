package features.world.dungeonmap.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonLayout {

    private final DungeonMap map;
    private final List<DungeonRoom> rooms;
    private final List<DungeonCorridor> corridors;
    private final List<DungeonRoomCluster> clusters;
    private final Map<Long, DungeonRoom> roomsById;
    private final Map<Long, DungeonCorridor> corridorsById;
    private final Map<Long, ClusterState> clusterStatesById;
    private final Map<Long, ClusterState> clusterStateByRoomId;

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
        this.clusterStatesById = indexClusterStates(this.clusters, this.rooms);
        this.clusterStateByRoomId = indexClusterStatesByRoom(this.clusterStatesById);
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

    public DungeonRoom roomById(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public DungeonRoomCluster clusterById(Long clusterId) {
        ClusterState state = clusterId == null ? null : clusterStatesById.get(clusterId);
        return state == null ? null : state.cluster();
    }

    public DungeonCorridor corridorById(Long corridorId) {
        return corridorId == null ? null : corridorsById.get(corridorId);
    }

    public List<DungeonRoom> roomsForCluster(Long clusterId) {
        ClusterState state = clusterId == null ? null : clusterStatesById.get(clusterId);
        return state == null ? List.of() : state.rooms();
    }

    public DungeonRoomCluster clusterForRoom(Long roomId) {
        ClusterState state = roomId == null ? null : clusterStateByRoomId.get(roomId);
        return state == null ? null : state.cluster();
    }

    public RoomShape roomShape(Long roomId) {
        ClusterState state = roomId == null ? null : clusterStateByRoomId.get(roomId);
        return state == null ? null : state.roomShape(roomId);
    }

    public Set<Point2i> roomCells(Long roomId) {
        RoomShape shape = roomShape(roomId);
        return shape == null ? Set.of() : shape.cells();
    }

    public DungeonRoom roomAtCell(Point2i cell) {
        if (cell == null) {
            return null;
        }
        for (DungeonRoom room : rooms) {
            if (room != null && room.roomId() != null && roomCells(room.roomId()).contains(cell)) {
                return room;
            }
        }
        return null;
    }

    public Set<Point2i> clusterCells(Long clusterId) {
        ClusterState state = clusterId == null ? null : clusterStatesById.get(clusterId);
        return state == null ? Set.of() : state.cells();
    }

    public List<List<Point2i>> clusterLoops(Long clusterId) {
        ClusterState state = clusterId == null ? null : clusterStatesById.get(clusterId);
        return state == null ? List.of() : state.loops();
    }

    public List<Long> corridorIdsForCluster(Long clusterId) {
        if (clusterId == null) {
            return List.of();
        }
        LinkedHashSet<Long> roomIds = new LinkedHashSet<>();
        for (DungeonRoom room : roomsForCluster(clusterId)) {
            if (room.roomId() != null) {
                roomIds.add(room.roomId());
            }
        }
        if (roomIds.isEmpty()) {
            return List.of();
        }
        return corridors.stream()
                .filter(corridor -> corridor.roomIds().stream().anyMatch(roomIds::contains))
                .map(DungeonCorridor::corridorId)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    private static Map<Long, DungeonRoom> indexRooms(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonCorridor> indexCorridors(List<DungeonCorridor> corridors) {
        Map<Long, DungeonCorridor> result = new LinkedHashMap<>();
        if (corridors != null) {
            for (DungeonCorridor corridor : corridors) {
                if (corridor != null && corridor.corridorId() != null) {
                    result.put(corridor.corridorId(), corridor);
                }
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, ClusterState> indexClusterStates(List<DungeonRoomCluster> clusters, List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> roomsByClusterId = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            if (room != null) {
                roomsByClusterId.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
            }
        }

        Map<Long, ClusterState> result = new LinkedHashMap<>();
        if (clusters == null) {
            return Map.of();
        }
        for (DungeonRoomCluster cluster : clusters) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            List<DungeonRoom> clusterRooms = List.copyOf(roomsByClusterId.getOrDefault(cluster.clusterId(), List.of()));
            result.put(cluster.clusterId(), new ClusterState(cluster, clusterRooms));
        }
        for (DungeonRoom room : rooms) {
            if (room == null || room.roomId() == null || result.containsKey(room.clusterId())) {
                continue;
            }
            throw new IllegalStateException("Raum " + room.roomId() + " referenziert unbekannten Cluster " + room.clusterId());
        }
        return Map.copyOf(result);
    }

    private static Map<Long, ClusterState> indexClusterStatesByRoom(Map<Long, ClusterState> clusterStatesById) {
        Map<Long, ClusterState> result = new LinkedHashMap<>();
        for (ClusterState state : clusterStatesById.values()) {
            for (DungeonRoom room : state.rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                result.put(room.roomId(), state);
            }
        }
        return Map.copyOf(result);
    }

    private record ClusterState(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms,
            Set<Point2i> cells,
            List<List<Point2i>> loops,
            Map<Long, RoomShape> roomShapesById
    ) {
        private ClusterState(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
            this(
                    cluster,
                    rooms,
                    DungeonRoomGeometry.cells(cluster),
                    DungeonRoomGeometry.absoluteLoops(cluster),
                    deriveRoomShapes(cluster, rooms));
        }

        private static Map<Long, RoomShape> deriveRoomShapes(
                DungeonRoomCluster cluster,
                List<DungeonRoom> rooms
        ) {
            List<RoomShape> components = DungeonClusterGeometry.clusterComponentShapes(cluster);
            Map<Long, RoomShape> result = new LinkedHashMap<>();
            for (DungeonRoom room : rooms) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                RoomShape shape = DungeonRoomGeometry.findClusterComponentShape(components, room.componentAnchor());
                if (shape == null) {
                    throw new IllegalStateException("Raum " + room.roomId() + " hat keinen gueltigen Komponentenanker in Cluster " + cluster.clusterId());
                }
                result.put(room.roomId(), shape);
            }
            return Map.copyOf(result);
        }
        private RoomShape roomShape(Long roomId) {
            return roomId == null ? null : roomShapesById.get(roomId);
        }
    }
}

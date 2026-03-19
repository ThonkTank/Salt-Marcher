package features.world.quarantine.dungeonmap.layout.model;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.*;

import java.util.*;

class DungeonLayoutIndex {

    private final Map<Long, ClusterState> clusterStatesById;
    private final Map<Long, ClusterState> clusterStateByRoomId;
    private final Map<Point2i, DungeonRoom> cellIndex;
    private final Map<Point2i, DungeonRoomCluster> clustersByCell;

    private DungeonLayoutIndex(
            Map<Long, ClusterState> clusterStatesById,
            Map<Long, ClusterState> clusterStateByRoomId,
            Map<Point2i, DungeonRoom> cellIndex,
            Map<Point2i, DungeonRoomCluster> clustersByCell
    ) {
        this.clusterStatesById = clusterStatesById;
        this.clusterStateByRoomId = clusterStateByRoomId;
        this.cellIndex = cellIndex;
        this.clustersByCell = clustersByCell;
    }

    static DungeonLayoutIndex build(List<DungeonRoomCluster> clusters, List<DungeonRoom> rooms) {
        Map<Long, ClusterState> states = indexClusterStates(clusters, rooms);
        return new DungeonLayoutIndex(
                states,
                indexClusterStatesByRoom(states),
                indexCells(states),
                indexClustersByCell(states));
    }

    // --- Query methods ---

    DungeonRoomCluster findCluster(Long clusterId) {
        ClusterState state = clusterId == null ? null : clusterStatesById.get(clusterId);
        return state == null ? null : state.cluster();
    }

    List<DungeonRoom> roomsForCluster(Long clusterId) {
        ClusterState state = clusterId == null ? null : clusterStatesById.get(clusterId);
        return state == null ? List.of() : state.rooms();
    }

    DungeonRoomCluster clusterForRoom(Long roomId) {
        ClusterState state = roomId == null ? null : clusterStateByRoomId.get(roomId);
        return state == null ? null : state.cluster();
    }

    DungeonRoom roomAtCell(Point2i cell) {
        return cell == null ? null : cellIndex.get(cell);
    }

    DungeonRoomCluster clusterAtCell(Point2i cell) {
        return cell == null ? null : clustersByCell.get(cell);
    }

    Set<Point2i> clusterCells(Long clusterId) {
        ClusterState state = clusterId == null ? null : clusterStatesById.get(clusterId);
        return state == null ? Set.of() : state.cells();
    }

    List<List<Point2i>> clusterLoops(Long clusterId) {
        ClusterState state = clusterId == null ? null : clusterStatesById.get(clusterId);
        return state == null ? List.of() : state.loops();
    }

    Set<Point2i> roomCells(Long roomId) {
        RoomShape shape = roomShape(roomId);
        return shape == null ? Set.of() : shape.cells();
    }

    RoomShape roomShape(Long roomId) {
        ClusterState state = roomId == null ? null : clusterStateByRoomId.get(roomId);
        return state == null ? null : state.roomShape(roomId);
    }

    // --- Static index builders ---

    private static Map<Long, ClusterState> indexClusterStates(List<DungeonRoomCluster> clusters, List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> roomsByClusterId = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            roomsByClusterId.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
        }

        Map<Long, ClusterState> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : clusters) {
            if (cluster.clusterId() == null) {
                continue;
            }
            List<DungeonRoom> clusterRooms = List.copyOf(roomsByClusterId.getOrDefault(cluster.clusterId(), List.of()));
            result.put(cluster.clusterId(), new ClusterState(cluster, clusterRooms));
        }
        for (DungeonRoom room : rooms) {
            if (room.roomId() == null || result.containsKey(room.clusterId())) {
                continue;
            }
            throw new IllegalStateException("Raum " + room.roomId() + " referenziert unbekannten Cluster " + room.clusterId());
        }
        return Map.copyOf(result);
    }

    private static Map<Point2i, DungeonRoom> indexCells(Map<Long, ClusterState> clusterStatesById) {
        Map<Point2i, DungeonRoom> result = new LinkedHashMap<>();
        for (ClusterState state : clusterStatesById.values()) {
            for (DungeonRoom room : state.rooms()) {
                if (room.roomId() == null) {
                    continue;
                }
                RoomShape shape = state.roomShape(room.roomId());
                if (shape != null) {
                    for (Point2i cell : shape.cells()) {
                        result.put(cell, room);
                    }
                }
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Point2i, DungeonRoomCluster> indexClustersByCell(Map<Long, ClusterState> clusterStatesById) {
        Map<Point2i, DungeonRoomCluster> result = new LinkedHashMap<>();
        for (ClusterState state : clusterStatesById.values()) {
            for (Point2i cell : state.cells()) {
                result.put(cell, state.cluster());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, ClusterState> indexClusterStatesByRoom(Map<Long, ClusterState> clusterStatesById) {
        Map<Long, ClusterState> result = new LinkedHashMap<>();
        for (ClusterState state : clusterStatesById.values()) {
            for (DungeonRoom room : state.rooms()) {
                if (room.roomId() == null) {
                    continue;
                }
                result.put(room.roomId(), state);
            }
        }
        return Map.copyOf(result);
    }

    // --- ClusterState ---

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
                    DungeonCellPolygonMath.cells(cluster),
                    DungeonCellPolygonMath.absoluteLoops(cluster),
                    deriveRoomShapes(cluster, rooms));
        }

        private static Map<Long, RoomShape> deriveRoomShapes(
                DungeonRoomCluster cluster,
                List<DungeonRoom> rooms
        ) {
            List<RoomShape> components = DungeonClusterGeometry.clusterComponentShapes(cluster);
            Map<Long, RoomShape> result = new LinkedHashMap<>();
            for (DungeonRoom room : rooms) {
                if (room.roomId() == null) {
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

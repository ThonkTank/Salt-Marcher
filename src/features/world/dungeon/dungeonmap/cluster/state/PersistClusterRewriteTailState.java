package features.world.dungeon.dungeonmap.cluster.state;

import features.world.dungeon.dungeonmap.cluster.input.PersistClusterRewriteTailInput;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Passive cluster-owned rewrite-tail state. This slice carries the projected final room rows for one persisted
 * cluster rewrite tail without exposing raw rewrite models to later canonical repository work.
 */
@SuppressWarnings("unused")
public record PersistClusterRewriteTailState(
        Connection connection,
        long mapId,
        List<ClusterState> rewrittenClusters,
        List<Long> removedRoomIds
) {

    public PersistClusterRewriteTailState {
        rewrittenClusters = normalizedClusters(rewrittenClusters);
        removedRoomIds = normalizedRemovedRoomIds(removedRoomIds);
    }

    public static PersistClusterRewriteTailState persistClusterRewriteTail(
            PersistClusterRewriteTailInput input
    ) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        ArrayList<ClusterState> rewrittenClusters = new ArrayList<>();
        for (Map<String, Object> cluster : input.rewrittenClusters()) {
            ClusterState projectedCluster = projectedCluster(cluster);
            if (projectedCluster != null) {
                rewrittenClusters.add(projectedCluster);
            }
        }
        return new PersistClusterRewriteTailState(
                input.connection(),
                input.mapId(),
                rewrittenClusters,
                input.removedRoomIds());
    }

    public record ClusterState(
            long clusterId,
            List<RoomState> rooms
    ) {

        public ClusterState {
            if (clusterId <= 0) {
                throw new IllegalArgumentException("clusterId");
            }
            rooms = normalizedRooms(rooms);
        }
    }

    public record RoomState(
            Long roomId,
            String name,
            List<LevelAnchorState> levelAnchors,
            String visualDescription,
            List<ExitNarrationState> exitNarrations
    ) {

        public RoomState {
            name = name == null ? "" : name.trim();
            levelAnchors = normalizedAnchors(levelAnchors);
            visualDescription = visualDescription == null ? "" : visualDescription.trim();
            exitNarrations = normalizedExitNarrations(exitNarrations);
        }
    }

    public record LevelAnchorState(
            int levelZ,
            int anchorX2,
            int anchorY2
    ) {
    }

    public record ExitNarrationState(
            int levelZ,
            int roomCellX,
            int roomCellY,
            String direction,
            String description
    ) {

        public ExitNarrationState {
            direction = direction == null ? "NORTH" : direction.trim();
            description = description == null ? "" : description.trim();
        }
    }

    private static ClusterState projectedCluster(Map<String, Object> cluster) {
        if (cluster == null) {
            return null;
        }
        Long clusterId = longValue(cluster.get("clusterId"));
        if (clusterId == null || clusterId <= 0) {
            return null;
        }
        ArrayList<RoomState> rooms = new ArrayList<>();
        for (Object roomValue : listValue(cluster.get("rooms"))) {
            RoomState room = projectedRoom(mapValue(roomValue));
            if (room != null) {
                rooms.add(room);
            }
        }
        return new ClusterState(clusterId, rooms);
    }

    private static RoomState projectedRoom(Map<String, Object> room) {
        if (room == null) {
            return null;
        }
        ArrayList<LevelAnchorState> anchors = new ArrayList<>();
        for (Object anchorValue : listValue(room.get("levelAnchors"))) {
            Map<String, Object> anchor = mapValue(anchorValue);
            Integer levelZ = intValue(anchor.get("levelZ"));
            Integer anchorX2 = intValue(anchor.get("anchorX2"));
            Integer anchorY2 = intValue(anchor.get("anchorY2"));
            if (levelZ != null && anchorX2 != null && anchorY2 != null) {
                anchors.add(new LevelAnchorState(levelZ, anchorX2, anchorY2));
            }
        }
        ArrayList<ExitNarrationState> exitNarrations = new ArrayList<>();
        for (Object exitNarrationValue : listValue(room.get("exitNarrations"))) {
            Map<String, Object> exitNarration = mapValue(exitNarrationValue);
            Integer levelZ = intValue(exitNarration.get("levelZ"));
            Integer roomCellX = intValue(exitNarration.get("roomCellX"));
            Integer roomCellY = intValue(exitNarration.get("roomCellY"));
            if (levelZ != null && roomCellX != null && roomCellY != null) {
                exitNarrations.add(new ExitNarrationState(
                        levelZ,
                        roomCellX,
                        roomCellY,
                        stringValue(exitNarration.get("direction")),
                        stringValue(exitNarration.get("description"))));
            }
        }
        return new RoomState(
                longValue(room.get("roomId")),
                stringValue(room.get("name")),
                anchors,
                stringValue(room.get("visualDescription")),
                exitNarrations);
    }

    private static Map<String, Object> mapValue(Object value) {
        return value instanceof Map<?, ?> rawMap ? (Map<String, Object>) rawMap : Map.of();
    }

    private static List<?> listValue(Object value) {
        return value instanceof List<?> rawList ? rawList : List.of();
    }

    private static Long longValue(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static Integer intValue(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private static String stringValue(Object value) {
        return value == null ? "" : value.toString();
    }

    private static List<ClusterState> normalizedClusters(List<ClusterState> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        ArrayList<ClusterState> normalizedClusters = new ArrayList<>();
        for (ClusterState cluster : clusters) {
            if (cluster != null) {
                normalizedClusters.add(cluster);
            }
        }
        return normalizedClusters.isEmpty() ? List.of() : List.copyOf(normalizedClusters);
    }

    private static List<RoomState> normalizedRooms(List<RoomState> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        ArrayList<RoomState> normalizedRooms = new ArrayList<>();
        for (RoomState room : rooms) {
            if (room != null) {
                normalizedRooms.add(room);
            }
        }
        return normalizedRooms.isEmpty() ? List.of() : List.copyOf(normalizedRooms);
    }

    private static List<LevelAnchorState> normalizedAnchors(List<LevelAnchorState> anchors) {
        if (anchors == null || anchors.isEmpty()) {
            return List.of();
        }
        ArrayList<LevelAnchorState> normalizedAnchors = new ArrayList<>();
        for (LevelAnchorState anchor : anchors) {
            if (anchor != null) {
                normalizedAnchors.add(anchor);
            }
        }
        return normalizedAnchors.isEmpty() ? List.of() : List.copyOf(normalizedAnchors);
    }

    private static List<ExitNarrationState> normalizedExitNarrations(List<ExitNarrationState> exitNarrations) {
        if (exitNarrations == null || exitNarrations.isEmpty()) {
            return List.of();
        }
        ArrayList<ExitNarrationState> normalizedExitNarrations = new ArrayList<>();
        for (ExitNarrationState exitNarration : exitNarrations) {
            if (exitNarration != null) {
                normalizedExitNarrations.add(exitNarration);
            }
        }
        return normalizedExitNarrations.isEmpty() ? List.of() : List.copyOf(normalizedExitNarrations);
    }

    private static List<Long> normalizedRemovedRoomIds(List<Long> removedRoomIds) {
        if (removedRoomIds == null || removedRoomIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> normalizedRoomIds = new LinkedHashSet<>();
        for (Long roomId : removedRoomIds) {
            if (roomId != null && roomId > 0) {
                normalizedRoomIds.add(roomId);
            }
        }
        return normalizedRoomIds.isEmpty() ? List.of() : List.copyOf(normalizedRoomIds);
    }
}

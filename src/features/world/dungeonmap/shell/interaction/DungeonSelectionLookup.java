package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

public final class DungeonSelectionLookup {

    private static final String NODE_PREFIX = "node:";
    private static final String SEGMENT_PREFIX = "segment:";
    private static final String EDGE_PREFIX = "edge:";
    private static final String VERTEX_PREFIX = "vertex:";
    private static final String CELL_PREFIX = "cell:";

    private DungeonSelectionLookup() {
    }

    public static Long clusterId(DungeonLayout layout, DungeonSelectionKey key) {
        if (layout == null || key == null) {
            return null;
        }
        if (RoomCluster.isTargetKey(key.targetKey())) {
            return RoomCluster.clusterIdFromKey(key.targetKey());
        }
        Long roomId = Room.isTargetKey(key.targetKey()) ? Room.roomIdFromKey(key.targetKey()) : null;
        Room room = roomId == null ? null : layout.findRoom(roomId);
        return room == null ? null : room.clusterId();
    }

    public static RoomCluster clusterOnLevel(DungeonLayout layout, DungeonSelectionKey key, int levelZ) {
        if (layout == null) {
            return null;
        }
        Long clusterId = clusterId(layout, key);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null || layout.levelForCluster(clusterId) != levelZ) {
            return null;
        }
        return cluster;
    }

    public static Room room(DungeonLayout layout, DungeonSelectionKey key) {
        if (layout == null || key == null || !Room.isTargetKey(key.targetKey())) {
            return null;
        }
        return layout.findRoom(Room.roomIdFromKey(key.targetKey()));
    }

    public static Corridor corridor(DungeonLayout layout, DungeonSelectionKey key) {
        if (layout == null || key == null || !Corridor.isTargetKey(key.targetKey())) {
            return null;
        }
        return layout.findCorridor(Corridor.corridorIdFromKey(key.targetKey()));
    }

    public static DungeonStair stair(DungeonLayout layout, DungeonSelectionKey key) {
        if (layout == null || key == null || !DungeonStair.isTargetKey(key.targetKey())) {
            return null;
        }
        return layout.findStair(DungeonStair.stairIdFromKey(key.targetKey()));
    }

    public static DungeonTransition transition(DungeonLayout layout, DungeonSelectionKey key) {
        if (layout == null || key == null || !DungeonTransition.isTargetKey(key.targetKey())) {
            return null;
        }
        return layout.findTransition(DungeonTransition.transitionIdFromKey(key.targetKey()));
    }

    public static Long corridorNodeId(DungeonSelectionKey key) {
        if (key == null || key.kind() != DungeonHitKind.CORRIDOR_NODE) {
            return null;
        }
        return parseLongPart(key.partKey(), NODE_PREFIX);
    }

    public static Long corridorSegmentId(DungeonSelectionKey key) {
        if (key == null || key.kind() != DungeonHitKind.CORRIDOR_SEGMENT) {
            return null;
        }
        return parseLongPart(key.partKey(), SEGMENT_PREFIX);
    }

    public static VertexEdge edge(DungeonSelectionKey key) {
        if (key == null) {
            return null;
        }
        return switch (key.kind()) {
            case CLUSTER_BOUNDARY, ROOM_BOUNDARY, CONNECTION -> parseEdge(key.partKey());
            default -> null;
        };
    }

    public static Point2i vertex(DungeonSelectionKey key) {
        if (key == null || key.kind() != DungeonHitKind.VERTEX) {
            return null;
        }
        return parsePoint(key.partKey(), VERTEX_PREFIX);
    }

    public static CubePoint floorCell(DungeonSelectionKey key) {
        if (key == null || key.kind() != DungeonHitKind.FLOOR_CELL || !key.partKey().startsWith(CELL_PREFIX)) {
            return null;
        }
        String[] parts = key.partKey().substring(CELL_PREFIX.length()).split(":");
        if (parts.length != 3) {
            return null;
        }
        Integer x = parseInt(parts[0]);
        Integer y = parseInt(parts[1]);
        Integer z = parseInt(parts[2]);
        if (x == null || y == null || z == null) {
            return null;
        }
        return new CubePoint(x, y, z);
    }

    private static Long parseLongPart(String partKey, String prefix) {
        if (partKey == null || prefix == null || !partKey.startsWith(prefix)) {
            return null;
        }
        try {
            return Long.parseLong(partKey.substring(prefix.length()));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Point2i parsePoint(String partKey, String prefix) {
        if (partKey == null || prefix == null || !partKey.startsWith(prefix)) {
            return null;
        }
        String[] parts = partKey.substring(prefix.length()).split(":");
        if (parts.length != 2) {
            return null;
        }
        Integer x = parseInt(parts[0]);
        Integer y = parseInt(parts[1]);
        if (x == null || y == null) {
            return null;
        }
        return new Point2i(x, y);
    }

    private static VertexEdge parseEdge(String partKey) {
        if (partKey == null || !partKey.startsWith(EDGE_PREFIX)) {
            return null;
        }
        String[] parts = partKey.substring(EDGE_PREFIX.length()).split(":");
        if (parts.length != 4) {
            return null;
        }
        Integer x1 = parseInt(parts[0]);
        Integer y1 = parseInt(parts[1]);
        Integer x2 = parseInt(parts[2]);
        Integer y2 = parseInt(parts[3]);
        if (x1 == null || y1 == null || x2 == null || y2 == null) {
            return null;
        }
        return new VertexEdge(new Point2i(x1, y1), new Point2i(x2, y2));
    }

    private static Integer parseInt(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}

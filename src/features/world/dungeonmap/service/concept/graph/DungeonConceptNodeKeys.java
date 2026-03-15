package features.world.dungeonmap.service.concept.graph;

import features.world.dungeonmap.model.domain.DungeonRoomNodeKey;

public final class DungeonConceptNodeKeys {

    private static final String ENTRANCE_PREFIX = "entrance:";
    private static final String EXIT_PREFIX = "exit:";
    private static final String CONNECTION_PREFIX = "connection:";
    private DungeonConceptNodeKeys() {
        throw new AssertionError("No instances");
    }

    public static String entrance(int entranceIndex) {
        return ENTRANCE_PREFIX + entranceIndex;
    }

    public static String exit(int exitIndex) {
        return EXIT_PREFIX + exitIndex;
    }

    public static String connection(long connectionId) {
        return CONNECTION_PREFIX + connectionId;
    }

    public static String room(long roomId) {
        return DungeonRoomNodeKey.room(roomId);
    }

    public static boolean isEntrance(String nodeKey) {
        return hasPrefix(nodeKey, ENTRANCE_PREFIX);
    }

    public static boolean isExit(String nodeKey) {
        return hasPrefix(nodeKey, EXIT_PREFIX);
    }

    public static boolean isConnection(String nodeKey) {
        return hasPrefix(nodeKey, CONNECTION_PREFIX);
    }

    public static boolean isRoom(String nodeKey) {
        return DungeonRoomNodeKey.isRoom(nodeKey);
    }

    public static int entranceIndex(String nodeKey) {
        return parseInt(nodeKey, ENTRANCE_PREFIX);
    }

    public static int exitIndex(String nodeKey) {
        return parseInt(nodeKey, EXIT_PREFIX);
    }

    public static long connectionId(String nodeKey) {
        return parseLong(nodeKey, CONNECTION_PREFIX);
    }

    public static long roomId(String nodeKey) {
        return DungeonRoomNodeKey.roomId(nodeKey);
    }

    private static boolean hasPrefix(String nodeKey, String prefix) {
        return nodeKey != null && nodeKey.startsWith(prefix);
    }

    private static int parseInt(String nodeKey, String prefix) {
        if (!hasPrefix(nodeKey, prefix)) {
            throw new IllegalArgumentException("Invalid concept node key: " + nodeKey);
        }
        try {
            return Integer.parseInt(nodeKey.substring(prefix.length()));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Invalid concept node key: " + nodeKey, ex);
        }
    }

    private static long parseLong(String nodeKey, String prefix) {
        if (!hasPrefix(nodeKey, prefix)) {
            throw new IllegalArgumentException("Invalid concept node key: " + nodeKey);
        }
        try {
            return Long.parseLong(nodeKey.substring(prefix.length()));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Invalid concept node key: " + nodeKey, ex);
        }
    }
}

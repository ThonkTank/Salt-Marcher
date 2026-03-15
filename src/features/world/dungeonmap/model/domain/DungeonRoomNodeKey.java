package features.world.dungeonmap.model.domain;

public final class DungeonRoomNodeKey {

    private static final String ROOM_PREFIX = "room:";

    private DungeonRoomNodeKey() {
        throw new AssertionError("No instances");
    }

    public static String room(long roomId) {
        return ROOM_PREFIX + roomId;
    }

    public static boolean isRoom(String nodeKey) {
        return nodeKey != null && nodeKey.startsWith(ROOM_PREFIX);
    }

    public static long roomId(String nodeKey) {
        if (!isRoom(nodeKey)) {
            throw new IllegalArgumentException("Invalid room node key: " + nodeKey);
        }
        try {
            return Long.parseLong(nodeKey.substring(ROOM_PREFIX.length()));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Invalid room node key: " + nodeKey, ex);
        }
    }
}

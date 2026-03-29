package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;

import java.util.LinkedHashSet;
import java.util.List;

public final class Corridor {

    private static final String TARGET_KEY_PREFIX = "corridor:";

    private final Long corridorId;
    private final long mapId;
    private final List<Long> roomIds;
    private final CorridorPath path;
    private final List<CorridorConnection> connections;

    public static Corridor planned(
            long mapId,
            List<Long> roomIds,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        return new Corridor(null, mapId, roomIds, path, connections);
    }

    public static Corridor resolved(
            Long corridorId,
            long mapId,
            List<Long> roomIds,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        return new Corridor(corridorId, mapId, roomIds, path, connections);
    }

    private Corridor(
            Long corridorId,
            long mapId,
            List<Long> roomIds,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        this.corridorId = corridorId;
        this.mapId = mapId;
        this.roomIds = normalizeRoomIds(roomIds);
        this.path = path == null ? CorridorPath.empty() : path;
        this.connections = connections == null ? List.of() : List.copyOf(connections);
    }

    public Corridor withIdentity(Long corridorId, long mapId) {
        return new Corridor(corridorId, mapId, roomIds, path, connections);
    }

    public Long corridorId() {
        return corridorId;
    }

    public String targetKey() {
        return targetKey(corridorId);
    }

    public static String targetKey(Long corridorId) {
        return TargetKey.of(TARGET_KEY_PREFIX, corridorId).value();
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long corridorIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
    }

    public long mapId() {
        return mapId;
    }

    public List<Long> roomIds() {
        return roomIds;
    }

    public CorridorPath path() {
        return path;
    }

    public List<CorridorConnection> connections() {
        return connections;
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && roomIds.contains(roomId);
    }

    private static List<Long> normalizeRoomIds(List<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Long roomId : roomIds) {
            if (roomId != null) {
                result.add(roomId);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}

package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/**
 * Materialized horizontal traversal segment.
 *
 * <p>Corridor is a segment-level read model for rendering, hit testing, runtime, and labels. Traversal owns the
 * editable connection truth; corridor keeps only the projected room ids still needed by existing read surfaces.</p>
 */
public final class Corridor {

    private static final String TARGET_KEY_PREFIX = "corridor:";

    private final String segmentKey;
    private final Long corridorId;
    private final Long traversalId;
    private final long mapId;
    private final List<Long> roomIds;
    private final CorridorPath path;
    private final List<CorridorConnection> connections;

    public static Corridor resolved(
            String segmentKey,
            Long corridorId,
            Long traversalId,
            long mapId,
            List<Long> roomIds,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        return new Corridor(segmentKey, corridorId, traversalId, mapId, roomIds, path, connections);
    }

    public static Corridor fromTraversalSlice(
            CorridorTraversalSlice corridorSlice,
            Long traversalId,
            long mapId,
            List<Long> roomIds
    ) {
        if (corridorSlice == null) {
            return null;
        }
        return resolved(
                corridorSlice.segmentKey(),
                corridorSlice.corridorId(),
                traversalId,
                mapId,
                roomIds,
                corridorSlice.path(),
                corridorSlice.connections());
    }

    private Corridor(
            String segmentKey,
            Long corridorId,
            Long traversalId,
            long mapId,
            List<Long> roomIds,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        this.segmentKey = requireSegmentKey(segmentKey);
        this.corridorId = corridorId;
        this.traversalId = traversalId;
        this.mapId = mapId;
        this.roomIds = normalizeRoomIds(roomIds);
        this.path = path == null ? CorridorPath.empty() : path;
        this.connections = connections == null ? List.of() : List.copyOf(connections);
    }

    public Corridor withIdentity(Long corridorId, Long traversalId, long mapId) {
        return new Corridor(segmentKey, corridorId, traversalId, mapId, roomIds, path, connections);
    }

    public Long corridorId() {
        return corridorId;
    }

    public String segmentKey() {
        return segmentKey;
    }

    public Long traversalId() {
        return traversalId;
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

    private static String requireSegmentKey(String segmentKey) {
        String normalized = Objects.requireNonNull(segmentKey, "segmentKey").trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("segmentKey must not be blank");
        }
        return normalized;
    }
}

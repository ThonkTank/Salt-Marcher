package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Self-managed corridor structure.
 *
 * <p>The corridor owns ordered room membership plus canonical relative bindings. Absolute path geometry is runtime
 * state on {@link CorridorPath} so corridor bindings can survive room and cluster movement without becoming a
 * second persisted truth.</p>
 */
public final class Corridor {

    private final Long corridorId;
    private final long mapId;
    // Corridor owns ordered room relations plus canonical relative bindings; pairwise room links stay a derived view.
    private final List<Long> roomIds;
    private final CorridorBindings bindings;
    private final CorridorPath path;
    private final List<RoomLink> roomLinks;

    public Corridor(Long corridorId, long mapId, List<Long> roomIds) {
        this(corridorId, mapId, roomIds, CorridorBindings.empty(), CorridorPath.empty());
    }

    public Corridor(Long corridorId, long mapId, List<Long> roomIds, CorridorBindings bindings, CorridorPath path) {
        this.corridorId = corridorId;
        this.mapId = mapId;
        this.roomIds = normalizeRoomIds(roomIds);
        this.bindings = bindings == null ? CorridorBindings.empty() : bindings;
        this.path = path == null ? CorridorPath.empty() : path;
        this.roomLinks = deriveRoomLinks(this.roomIds);
    }

    public Long corridorId() {
        return corridorId;
    }

    public long mapId() {
        return mapId;
    }

    public List<Long> roomIds() {
        return roomIds;
    }

    public CorridorBindings bindings() {
        return bindings;
    }

    public CorridorPath path() {
        return path;
    }

    public List<RoomLink> roomLinks() {
        return roomLinks;
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && roomIds.contains(roomId);
    }

    public boolean dependsOnCluster(Long clusterId) {
        if (clusterId == null) {
            return false;
        }
        for (CorridorWaypointBinding waypoint : bindings.waypoints()) {
            if (clusterId.equals(waypoint.clusterId())) {
                return true;
            }
        }
        for (CorridorDoorBinding binding : bindings.doorBindings()) {
            if (clusterId.equals(binding.clusterId())) {
                return true;
            }
        }
        return false;
    }

    public boolean dependsOnAnyRoom(Set<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return false;
        }
        for (Long roomId : this.roomIds) {
            if (roomIds.contains(roomId)) {
                return true;
            }
        }
        return false;
    }

    public Corridor withRoomIds(List<Long> roomIds) {
        return new Corridor(corridorId, mapId, roomIds, bindings, path);
    }

    public Corridor withBindings(CorridorBindings bindings) {
        return new Corridor(corridorId, mapId, roomIds, bindings, path);
    }

    public Corridor withPath(CorridorPath path) {
        return new Corridor(corridorId, mapId, roomIds, bindings, path);
    }

    public Corridor replanned(CorridorPlanningInput input) {
        return withPath(CorridorPlanner.plan(this, input));
    }

    public List<Room> resolvedRooms(CorridorPlanningInput input) {
        List<Room> result = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();
        if (input == null) {
            return List.of();
        }
        for (Long roomId : roomIds) {
            if (roomId == null || !seen.add(roomId)) {
                continue;
            }
            Room room = input.room(roomId);
            if (room != null) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    public List<Point2i> resolvedWaypointCells(CorridorPlanningInput input) {
        if (input == null || bindings.waypoints().isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>();
        for (CorridorWaypointBinding waypoint : bindings.waypoints()) {
            Point2i clusterCenter = input.clusterCenter(waypoint.clusterId());
            if (clusterCenter != null) {
                result.add(waypoint.absoluteCell(clusterCenter));
            }
        }
        return List.copyOf(result);
    }

    public Map<Long, ResolvedCorridorDoorBinding> resolvedDoorBindings(CorridorPlanningInput input) {
        if (input == null || bindings.doorBindings().isEmpty()) {
            return Map.of();
        }
        Map<Long, ResolvedCorridorDoorBinding> result = new LinkedHashMap<>();
        for (CorridorDoorBinding binding : bindings.doorBindings()) {
            Point2i clusterCenter = input.clusterCenter(binding.clusterId());
            if (clusterCenter != null) {
                result.put(binding.roomId(), new ResolvedCorridorDoorBinding(
                        binding.absoluteCell(clusterCenter),
                        binding.direction()));
            }
        }
        return Map.copyOf(result);
    }

    private static List<RoomLink> deriveRoomLinks(List<Long> roomIds) {
        List<RoomLink> links = new ArrayList<>();
        for (int index = 1; index < roomIds.size(); index++) {
            Long fromRoomId = roomIds.get(index - 1);
            Long toRoomId = roomIds.get(index);
            if (fromRoomId == null || toRoomId == null || fromRoomId.equals(toRoomId)) {
                continue;
            }
            links.add(new RoomLink(fromRoomId, toRoomId));
        }
        return List.copyOf(links);
    }

    private static List<Long> normalizeRoomIds(List<Long> roomIds) {
        Set<Long> result = new LinkedHashSet<>();
        for (Long roomId : roomIds == null ? List.<Long>of() : roomIds) {
            if (roomId != null) {
                result.add(roomId);
            }
        }
        return List.copyOf(result);
    }

    public record RoomLink(long fromRoomId, long toRoomId) {
    }
}

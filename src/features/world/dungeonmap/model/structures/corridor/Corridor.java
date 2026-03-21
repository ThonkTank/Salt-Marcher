package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
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

    public static Corridor create(Long corridorId, long mapId, List<Long> roomIds) {
        return resolved(corridorId, mapId, roomIds, CorridorBindings.empty(), CorridorPath.empty());
    }

    public static Corridor resolved(
            Long corridorId,
            long mapId,
            List<Long> roomIds,
            CorridorBindings bindings,
            CorridorPath path
    ) {
        return new Corridor(corridorId, mapId, roomIds, bindings, path);
    }

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

    public boolean connectsAll(Set<Long> roomIds) {
        return roomIds != null && roomIds.size() >= 2 && this.roomIds.containsAll(roomIds);
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

    public boolean isAffectedByClusterRewrite(Set<Long> clusterIds) {
        if (clusterIds == null || clusterIds.isEmpty()) {
            return false;
        }
        for (Long clusterId : clusterIds) {
            if (dependsOnCluster(clusterId)) {
                return true;
            }
        }
        return false;
    }

    public boolean isAffectedByRoomRewrite(Set<Long> roomIds) {
        return dependsOnAnyRoom(roomIds);
    }

    public boolean isDegenerate() {
        return roomIds.size() < 2;
    }

    public boolean isPersistable() {
        return !isDegenerate();
    }

    public Corridor withAddedRoom(Long roomId) {
        if (roomId == null || roomIds.contains(roomId)) {
            return this;
        }
        List<Long> updated = new ArrayList<>(roomIds);
        updated.add(roomId);
        return resolved(corridorId, mapId, updated, bindings, path);
    }

    public Corridor withRemovedRoom(Long roomId) {
        if (roomId == null || !roomIds.contains(roomId)) {
            return this;
        }
        List<Long> updated = roomIds.stream()
                .filter(existing -> !Objects.equals(existing, roomId))
                .toList();
        Corridor updatedCorridor = resolved(corridorId, mapId, updated, bindings.withoutDoorBinding(roomId), path);
        return updatedCorridor.isPersistable() ? updatedCorridor : updatedCorridor.withPath(CorridorPath.empty());
    }

    public Corridor withMergedRooms(Set<Long> mergedRoomIds, Long replacementRoomId) {
        if (replacementRoomId == null || mergedRoomIds == null || mergedRoomIds.isEmpty()) {
            return this;
        }
        List<Long> updated = roomIds.stream()
                .map(roomId -> mergedRoomIds.contains(roomId) ? replacementRoomId : roomId)
                .distinct()
                .toList();
        CorridorBindings updatedBindings = bindings;
        for (Long mergedRoomId : mergedRoomIds) {
            if (!Objects.equals(mergedRoomId, replacementRoomId)) {
                updatedBindings = updatedBindings.withoutDoorBinding(mergedRoomId);
            }
        }
        return resolved(corridorId, mapId, updated, updatedBindings, path);
    }

    public Corridor withReplacedRoom(Long oldRoomId, Long newRoomId) {
        if (oldRoomId == null || newRoomId == null || Objects.equals(oldRoomId, newRoomId) || !roomIds.contains(oldRoomId)) {
            return this;
        }
        List<Long> updated = roomIds.stream()
                .map(roomId -> Objects.equals(roomId, oldRoomId) ? newRoomId : roomId)
                .distinct()
                .toList();
        CorridorBindings updatedBindings = bindings.withoutDoorBinding(oldRoomId);
        return resolved(corridorId, mapId, updated, updatedBindings, path);
    }

    public Corridor withInsertedWaypoint(int index, CorridorWaypointBinding waypoint) {
        return withBindings(bindings.withInsertedWaypoint(index, waypoint));
    }

    public Corridor withMovedWaypoint(int index, CorridorWaypointBinding waypoint) {
        return withBindings(bindings.withMovedWaypoint(index, waypoint));
    }

    public Corridor withRemovedWaypoint(int index) {
        return withBindings(bindings.withRemovedWaypoint(index));
    }

    public Corridor withDoorBinding(CorridorDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        Corridor updated = connectsRoom(binding.roomId()) ? this : withAddedRoom(binding.roomId());
        return updated.withBindings(updated.bindings.withDoorBinding(binding));
    }

    public Corridor withoutDoorBinding(Long roomId) {
        return withBindings(bindings.withoutDoorBinding(roomId));
    }

    public Corridor withReanchoredBindings(
            CorridorPlanningInput input,
            Map<Long, Point2i> replacementClusterCenters,
            Set<Long> deletedClusterIds
    ) {
        return withRoomClusterReassignment(input, Map.of(), replacementClusterCenters, deletedClusterIds);
    }

    public Corridor withRoomClusterReassignment(
            CorridorPlanningInput input,
            Map<Long, Long> roomClusterIds,
            Map<Long, Point2i> replacementClusterCenters,
            Set<Long> deletedClusterIds
    ) {
        if (input == null) {
            return this;
        }
        Map<Long, Long> reassignedRoomClusterIds = roomClusterIds == null ? Map.of() : Map.copyOf(roomClusterIds);
        Map<Long, Point2i> replacements = replacementClusterCenters == null ? Map.of() : Map.copyOf(replacementClusterCenters);
        Set<Long> deleted = deletedClusterIds == null ? Set.of() : Set.copyOf(deletedClusterIds);
        Long fallbackClusterId = fallbackWaypointClusterId(input, reassignedRoomClusterIds);
        List<CorridorWaypointBinding> updatedWaypoints = new ArrayList<>();
        for (CorridorWaypointBinding waypoint : bindings.waypoints()) {
            Long targetClusterId = targetClusterId(
                    waypoint.clusterId(),
                    replacements,
                    deleted,
                    input,
                    fallbackClusterId,
                    reassignedRoomClusterIds);
            Point2i targetCenter = targetClusterId == null ? null : replacements.getOrDefault(targetClusterId, input.clusterCenter(targetClusterId));
            Point2i previousCenter = input.clusterCenter(waypoint.clusterId());
            if (targetClusterId == null || targetCenter == null || previousCenter == null) {
                continue;
            }
            Point2i absoluteCell = waypoint.absoluteCell(previousCenter);
            updatedWaypoints.add(CorridorWaypointBinding.atAbsoluteCell(targetClusterId, absoluteCell, targetCenter));
        }
        CorridorBindings updatedBindings = new CorridorBindings(updatedWaypoints, bindings.doorBindings());
        for (CorridorDoorBinding binding : bindings.doorBindings()) {
            Room room = input.room(binding.roomId());
            if (room == null) {
                updatedBindings = updatedBindings.withoutDoorBinding(binding.roomId());
                continue;
            }
            Long targetClusterId = reassignedRoomClusterIds.getOrDefault(binding.roomId(), room.clusterId());
            Point2i targetCenter = targetClusterId == null ? null : replacements.getOrDefault(targetClusterId, input.clusterCenter(targetClusterId));
            if (targetCenter == null || deleted.contains(targetClusterId)) {
                updatedBindings = updatedBindings.withoutDoorBinding(binding.roomId());
                continue;
            }
            Point2i previousCenter = input.clusterCenter(binding.clusterId());
            Point2i absoluteCell = binding.absoluteCell(previousCenter);
            updatedBindings = updatedBindings.withDoorBinding(
                    CorridorDoorBinding.atAbsoluteCell(binding.roomId(), targetClusterId, absoluteCell, targetCenter, binding.direction()));
        }
        return withBindings(updatedBindings);
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

    private Corridor withBindings(CorridorBindings bindings) {
        return resolved(corridorId, mapId, roomIds, bindings, path);
    }

    private Corridor withPath(CorridorPath path) {
        return resolved(corridorId, mapId, roomIds, bindings, path);
    }

    private Long fallbackWaypointClusterId(CorridorPlanningInput input, Map<Long, Long> roomClusterIds) {
        for (Long roomId : roomIds) {
            Long reassignedClusterId = roomClusterIds.get(roomId);
            if (reassignedClusterId != null) {
                return reassignedClusterId;
            }
        }
        for (Long roomId : roomIds) {
            Room room = input.room(roomId);
            if (room != null) {
                return room.clusterId();
            }
        }
        return null;
    }

    private static Point2i reanchoredCenter(
            long clusterId,
            Map<Long, Point2i> replacements,
            Set<Long> deletedClusterIds,
            CorridorPlanningInput input,
            Long fallbackClusterId,
            Map<Long, Long> roomClusterIds
    ) {
        Long targetClusterId = targetClusterId(clusterId, replacements, deletedClusterIds, input, fallbackClusterId, roomClusterIds);
        return targetClusterId == null ? null : replacements.getOrDefault(targetClusterId, input.clusterCenter(targetClusterId));
    }

    private static Long targetClusterId(
            long clusterId,
            Map<Long, Point2i> replacements,
            Set<Long> deletedClusterIds,
            CorridorPlanningInput input,
            Long fallbackClusterId,
            Map<Long, Long> roomClusterIds
    ) {
        if (replacements.containsKey(clusterId) || input.clusterCenter(clusterId) != null && !deletedClusterIds.contains(clusterId)) {
            return clusterId;
        }
        for (Long reassignedClusterId : roomClusterIds.values()) {
            if (reassignedClusterId != null && replacements.containsKey(reassignedClusterId)) {
                return reassignedClusterId;
            }
        }
        if (deletedClusterIds.contains(clusterId)) {
            return fallbackClusterId;
        }
        return input.clusterCenter(clusterId) == null ? null : clusterId;
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

package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.CorridorPath;
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

    private static final String TARGET_KEY_PREFIX = "corridor:";

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

    public String targetKey() {
        return targetKey(corridorId);
    }

    public static String targetKey(Long corridorId) {
        return corridorId == null ? TARGET_KEY_PREFIX + "unassigned" : TARGET_KEY_PREFIX + corridorId;
    }

    public static boolean isTargetKey(String targetKey) {
        return targetKey != null && targetKey.startsWith(TARGET_KEY_PREFIX);
    }

    public static String targetKeyPrefix() {
        return TARGET_KEY_PREFIX;
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

    /**
     * Applies a room-delete membership rewrite for a single removed room.
     *
     * <p>This is the corridor-owned rewrite rule for delete orchestration. The caller decides whether the corridor
     * is affected and in which sequence deletes are applied; the corridor decides how its membership and bindings
     * change once that removal is in scope.</p>
     */
    public Corridor rewrittenForDeletedRoom(Long deletedRoomId) {
        // Corridor owns corridor-local rewrite truth; services only decide whether this rewrite step applies.
        return withRemovedRoom(deletedRoomId);
    }

    /**
     * Applies a room-merge membership rewrite for a merged room set.
     *
     * <p>This is the corridor-owned rewrite rule for merge orchestration. The caller supplies the already-resolved
     * replacement room id; the corridor owns membership deduplication and door-binding cleanup.</p>
     */
    public Corridor rewrittenForMergedRooms(Set<Long> mergedRoomIds, Long replacementRoomId) {
        // Corridor owns corridor-local rewrite truth; services only supply the already-resolved merge scope.
        return withMergedRooms(mergedRoomIds, replacementRoomId);
    }

    /**
     * Rewrites a split source room using corridor-local decision facts only.
     *
     * <p>The caller prepares a {@link CorridorSplitRewriteInput} with the split source room, candidate fragments,
     * and the relevant centers of the corridor's remaining connected rooms. The corridor then owns the fragment
     * choice without reaching back into broader application or layout state.</p>
     */
    public Corridor rewrittenForSplit(CorridorSplitRewriteInput input) {
        if (input == null || !input.isUsableFor(this)) {
            return this;
        }
        // Corridor owns the fragment choice once the external world facts have been projected into corridor-local input.
        Room replacement = chooseBestSplitFragment(input);
        if (replacement == null || replacement.roomId() == null) {
            return this;
        }
        return withReplacedRoom(input.originalRoomId(), replacement.roomId());
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

    public Corridor mergeWith(Corridor other) {
        if (other == null || other == this) {
            return this;
        }
        if (mapId != other.mapId()) {
            throw new IllegalArgumentException("Korridore aus unterschiedlichen Karten koennen nicht zusammengefuehrt werden");
        }
        List<Long> mergedRoomIds = mergedRoomIds(other);
        // Merging is intentionally asymmetric: the kept corridor stays the editable route owner, so its
        // waypoint and door choices survive while the merged-away corridor contributes only room membership.
        Corridor mergedCorridor = resolved(
                corridorId,
                mapId,
                mergedRoomIds,
                sanitizedBindings(mergedRoomIds, bindings),
                path);
        return mergedCorridor.isPersistable() ? mergedCorridor : mergedCorridor.withPath(CorridorPath.empty());
    }

    public Corridor withoutDoorBinding(Long roomId) {
        return withBindings(bindings.withoutDoorBinding(roomId));
    }

    public Corridor reanchoredFor(CorridorRewriteContext context) {
        if (context == null || !context.affects(corridorId)) {
            return this;
        }
        CorridorPlanningInput previousInput = context.previousPlanningInput();
        CorridorPlanningInput rewrittenInput = context.rewrittenPlanningInput();
        Set<Long> deletedClusterIds = context.deletedClusterIds();
        Long fallbackClusterId = fallbackWaypointClusterId(rewrittenInput);
        List<CorridorWaypointBinding> updatedWaypoints = new ArrayList<>();
        for (CorridorWaypointBinding waypoint : bindings.waypoints()) {
            Long targetClusterId = targetClusterId(
                    waypoint.clusterId(),
                    previousInput,
                    rewrittenInput,
                    deletedClusterIds,
                    fallbackClusterId);
            Point2i targetCenter = rewrittenInput.clusterCenter(targetClusterId);
            Point2i previousCenter = previousInput.clusterCenter(waypoint.clusterId());
            if (targetClusterId == null || targetCenter == null || previousCenter == null) {
                continue;
            }
            Point2i absoluteCell = waypoint.absoluteCell(previousCenter);
            updatedWaypoints.add(CorridorWaypointBinding.atAbsoluteCell(targetClusterId, absoluteCell, targetCenter));
        }
        CorridorBindings updatedBindings = new CorridorBindings(updatedWaypoints, bindings.doorBindings());
        for (CorridorDoorBinding binding : bindings.doorBindings()) {
            Room room = previousInput.room(binding.roomId());
            if (room == null) {
                updatedBindings = updatedBindings.withoutDoorBinding(binding.roomId());
                continue;
            }
            Room rewrittenRoom = rewrittenInput.room(binding.roomId());
            Long targetClusterId = rewrittenRoom == null ? null : rewrittenRoom.clusterId();
            Point2i targetCenter = rewrittenInput.clusterCenter(targetClusterId);
            if (targetCenter == null || deletedClusterIds.contains(targetClusterId)) {
                updatedBindings = updatedBindings.withoutDoorBinding(binding.roomId());
                continue;
            }
            Point2i previousCenter = previousInput.clusterCenter(binding.clusterId());
            if (previousCenter == null) {
                updatedBindings = updatedBindings.withoutDoorBinding(binding.roomId());
                continue;
            }
            Point2i absoluteCell = binding.absoluteCell(previousCenter);
            updatedBindings = updatedBindings.withDoorBinding(
                    CorridorDoorBinding.atAbsoluteCell(binding.roomId(), targetClusterId, absoluteCell, targetCenter, binding.direction()));
        }
        return withBindings(updatedBindings);
    }

    public Corridor replannedFor(CorridorRewriteContext context) {
        if (context == null || !context.affects(corridorId) || !isPersistable()) {
            return this;
        }
        return replanned(context.rewrittenPlanningInput());
    }

    public Corridor replanned(CorridorPlanningInput input) {
        // Preview drags call into this through DungeonLayout.withTranslatedClusterPreview() on repeated pointer updates.
        // Planner quality fixes are only acceptable here when they preserve the current preview budget.
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

    private Long fallbackWaypointClusterId(CorridorPlanningInput input) {
        for (Long roomId : roomIds) {
            Room room = input.room(roomId);
            if (room != null) {
                return room.clusterId();
            }
        }
        return null;
    }

    private static Long targetClusterId(
            long clusterId,
            CorridorPlanningInput previousInput,
            CorridorPlanningInput rewrittenInput,
            Set<Long> deletedClusterIds,
            Long fallbackClusterId
    ) {
        if (rewrittenInput.clusterCenter(clusterId) != null && !deletedClusterIds.contains(clusterId)) {
            return clusterId;
        }
        for (Room room : previousInput.roomsById().values()) {
            if (room == null || room.clusterId() != clusterId) {
                continue;
            }
            Room rewrittenRoom = rewrittenInput.room(room.roomId());
            if (rewrittenRoom != null && rewrittenInput.clusterCenter(rewrittenRoom.clusterId()) != null) {
                return rewrittenRoom.clusterId();
            }
        }
        if (deletedClusterIds.contains(clusterId)) {
            return fallbackClusterId;
        }
        return previousInput.clusterCenter(clusterId) == null ? null : clusterId;
    }

    private Room chooseBestSplitFragment(CorridorSplitRewriteInput input) {
        Room bestFragment = null;
        SplitFragmentScore bestScore = null;
        for (Room fragment : input.fragments()) {
            if (fragment == null || fragment.roomId() == null) {
                continue;
            }
            SplitFragmentScore score = splitFragmentScore(fragment, input.connectedRoomCenters());
            if (bestScore == null || score.compareTo(bestScore) < 0) {
                bestFragment = fragment;
                bestScore = score;
            }
        }
        return bestFragment;
    }

    private SplitFragmentScore splitFragmentScore(Room fragment, List<Point2i> connectedRoomCenters) {
        Point2i fragmentCenter = fragment.floor().shape().centerCell();
        int nearestRoomDistance = connectedRoomCenters.stream()
                .filter(Objects::nonNull)
                .mapToInt(fragmentCenter::distanceTo)
                .min()
                .orElse(Integer.MAX_VALUE);
        int groupDistance = connectedRoomCenters.stream()
                .filter(Objects::nonNull)
                .mapToInt(fragmentCenter::distanceTo)
                .sum();
        return new SplitFragmentScore(nearestRoomDistance, groupDistance);
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

    private List<Long> mergedRoomIds(Corridor other) {
        List<Long> mergedRoomIds = new ArrayList<>(roomIds);
        for (Long roomId : other.roomIds()) {
            if (roomId != null && !mergedRoomIds.contains(roomId)) {
                mergedRoomIds.add(roomId);
            }
        }
        return List.copyOf(mergedRoomIds);
    }

    private static CorridorBindings sanitizedBindings(List<Long> roomIds, CorridorBindings bindings) {
        if (bindings == null) {
            return CorridorBindings.empty();
        }
        Set<Long> connectedRoomIds = new LinkedHashSet<>(normalizeRoomIds(roomIds));
        List<CorridorWaypointBinding> sanitizedWaypoints = bindings.waypoints().stream()
                .filter(Objects::nonNull)
                .toList();
        Set<Long> seenDoorBindingRoomIds = new LinkedHashSet<>();
        List<CorridorDoorBinding> sanitizedDoorBindings = bindings.doorBindings().stream()
                .filter(Objects::nonNull)
                .filter(binding -> connectedRoomIds.contains(binding.roomId()))
                .filter(binding -> seenDoorBindingRoomIds.add(binding.roomId()))
                .toList();
        return new CorridorBindings(sanitizedWaypoints, sanitizedDoorBindings);
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

    private record SplitFragmentScore(int nearestRoomDistance, int groupDistance) implements Comparable<SplitFragmentScore> {
        @Override
        public int compareTo(SplitFragmentScore other) {
            int nearest = Integer.compare(nearestRoomDistance, other.nearestRoomDistance);
            if (nearest != 0) {
                return nearest;
            }
            return Integer.compare(groupDistance, other.groupDistance);
        }
    }

    public record RoomLink(long fromRoomId, long toRoomId) {
    }
}

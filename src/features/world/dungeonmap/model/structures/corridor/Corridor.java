package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanningEngine;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
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

    private final String segmentKey;
    private final Long corridorId;
    private final Long traversalId;
    private final long mapId;
    private final List<Long> roomIds;
    private final CorridorBindings bindings;
    private final CorridorPath path;
    private final List<CorridorConnection> connections;

    public static Corridor resolved(
            String segmentKey,
            Long corridorId,
            long mapId,
            List<Long> roomIds,
            CorridorBindings bindings,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        return resolved(segmentKey, corridorId, null, mapId, roomIds, bindings, path, connections);
    }

    public static Corridor resolved(
            String segmentKey,
            Long corridorId,
            Long traversalId,
            long mapId,
            List<Long> roomIds,
            CorridorBindings bindings,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        return new Corridor(segmentKey, corridorId, traversalId, mapId, roomIds, bindings, path, connections);
    }

    public static Corridor resolved(
            Long corridorId,
            long mapId,
            List<Long> roomIds,
            CorridorBindings bindings,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        return resolved("legacy-corridor", corridorId, null, mapId, roomIds, bindings, path, connections);
    }

    private Corridor(
            String segmentKey,
            Long corridorId,
            Long traversalId,
            long mapId,
            List<Long> roomIds,
            CorridorBindings bindings,
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
        this.segmentKey = segmentKey == null || segmentKey.isBlank() ? "legacy-corridor" : segmentKey;
        this.corridorId = corridorId;
        this.traversalId = traversalId;
        this.mapId = mapId;
        this.roomIds = normalizeRoomIds(roomIds);
        this.bindings = bindings == null ? CorridorBindings.empty() : bindings;
        this.path = path == null ? CorridorPath.empty() : path;
        this.connections = connections == null ? List.of() : List.copyOf(connections);
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

    public CorridorBindings bindings() {
        return bindings;
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


    public boolean isDegenerate() {
        return roomIds.size() < 2;
    }

    public boolean isPersistable() {
        return !isDegenerate();
    }

    public record RewriteResult(
            Map<Long, Corridor> corridorsById,
            Set<Long> affectedCorridorIds,
            Map<Long, List<StairPlacement>> stairPlacementsByCorridorId
    ) {
        public RewriteResult {
            corridorsById = corridorsById == null ? Map.of() : Map.copyOf(corridorsById);
            affectedCorridorIds = affectedCorridorIds == null ? Set.of() : Set.copyOf(affectedCorridorIds);
            stairPlacementsByCorridorId = stairPlacementsByCorridorId == null ? Map.of() : Map.copyOf(stairPlacementsByCorridorId);
        }
    }

    public static RewriteResult rewriteAll(
            Map<Long, Corridor> corridorsById,
            CorridorRewriteContext context
    ) {
        if (corridorsById == null || corridorsById.isEmpty()) {
            return new RewriteResult(Map.of(), Set.of(), Map.of());
        }
        if (context == null || context.affectedCorridorIds().isEmpty()) {
            return new RewriteResult(Map.copyOf(corridorsById), Set.of(), Map.of());
        }
        Map<Long, Corridor> result = new LinkedHashMap<>();
        Map<Long, List<StairPlacement>> stairPlacementsByCorridorId = new LinkedHashMap<>();
        for (Map.Entry<Long, Corridor> entry : corridorsById.entrySet()) {
            Corridor corridor = entry.getValue();
            if (corridor == null) {
                result.put(entry.getKey(), null);
                continue;
            }
            Corridor reanchored = corridor.reanchoredFor(context);
            if (context.affects(corridor.corridorId()) && reanchored.isPersistable()) {
                TraversalPlan traversalPlan = TraversalPlanningEngine.plan(
                        reanchored,
                        context.rewrittenPlanningInput());
                List<StairPlacement> stairPlacements = traversalPlan.stairPlacements();
                Corridor updated = reanchored.applyTraversalSlice(
                        traversalPlan.corridorSlice(reanchored.corridorId()));
                result.put(entry.getKey(), updated);
                if (!stairPlacements.isEmpty() && reanchored.corridorId() != null) {
                    stairPlacementsByCorridorId.put(reanchored.corridorId(), stairPlacements);
                }
            } else {
                result.put(entry.getKey(), reanchored.replannedFor(context));
            }
        }
        return new RewriteResult(
                Map.copyOf(result),
                context.affectedCorridorIds(),
                Map.copyOf(stairPlacementsByCorridorId));
    }

    public Corridor withAddedRoom(Long roomId) {
        if (roomId == null || roomIds.contains(roomId)) {
            return this;
        }
        List<Long> updated = new ArrayList<>(roomIds);
        updated.add(roomId);
        return resolved(segmentKey, corridorId, traversalId, mapId, updated, bindings, path, connections);
    }

    public Corridor withRemovedRoom(Long roomId) {
        if (roomId == null || !roomIds.contains(roomId)) {
            return this;
        }
        List<Long> updated = roomIds.stream()
                .filter(existing -> !Objects.equals(existing, roomId))
                .toList();
        Corridor updatedCorridor = resolved(segmentKey, corridorId, traversalId, mapId, updated, bindings.withoutDoorBinding(roomId), path, connections);
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
        return resolved(segmentKey, corridorId, traversalId, mapId, updated, updatedBindings, path, connections);
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
        return resolved(segmentKey, corridorId, traversalId, mapId, updated, updatedBindings, path, connections);
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
                segmentKey,
                corridorId,
                traversalId,
                mapId,
                mergedRoomIds,
                sanitizedBindings(mergedRoomIds, bindings),
                path,
                connections);
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
            updatedWaypoints.add(CorridorWaypointBinding.atAbsoluteCell(
                    targetClusterId,
                    absoluteCell,
                    targetCenter,
                    waypoint.levelZ()));
        }
        List<CorridorDoorBinding> updatedDoorBindings = new ArrayList<>();
        for (CorridorDoorBinding binding : bindings.doorBindings()) {
            Room room = previousInput.room(binding.roomId());
            if (room == null) {
                continue;
            }
            Room rewrittenRoom = rewrittenInput.room(binding.roomId());
            Long targetClusterId = rewrittenRoom == null ? null : rewrittenRoom.clusterId();
            Point2i targetCenter = rewrittenInput.clusterCenter(targetClusterId);
            if (targetCenter == null || deletedClusterIds.contains(targetClusterId)) {
                continue;
            }
            Point2i previousCenter = previousInput.clusterCenter(binding.clusterId());
            if (previousCenter == null) {
                continue;
            }
            Point2i absoluteCell = binding.absoluteCell(previousCenter);
            updatedDoorBindings.add(
                    CorridorDoorBinding.atAbsoluteCell(binding.roomId(), targetClusterId, absoluteCell, targetCenter, binding.direction()));
        }
        return withBindings(new CorridorBindings(updatedWaypoints, updatedDoorBindings));
    }

    public Corridor replannedFor(CorridorRewriteContext context) {
        if (context == null || !context.affects(corridorId) || !isPersistable()) {
            return this;
        }
        TraversalPlan traversalPlan = TraversalPlanningEngine.plan(this, context.rewrittenPlanningInput());
        Corridor updated = applyTraversalSlice(traversalPlan.corridorSlice(corridorId));
        return updated;
    }

    public Corridor applyTraversalSlice(CorridorTraversalSlice slice) {
        if (slice == null || !acceptsTraversalSlice(slice)) {
            return this;
        }
        return withPath(slice.path()).withConnections(rebindConnections(slice.connections(), corridorId));
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

    public List<CubePoint> resolvedWaypointCells(CorridorPlanningInput input) {
        if (input == null || bindings.waypoints().isEmpty()) {
            return List.of();
        }
        List<CubePoint> result = new ArrayList<>();
        for (CorridorWaypointBinding waypoint : bindings.waypoints()) {
            Point2i clusterCenter = input.clusterCenter(waypoint.clusterId());
            if (clusterCenter != null) {
                result.add(CubePoint.at(waypoint.absoluteCell(clusterCenter), waypoint.levelZ()));
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
        return resolved(segmentKey, corridorId, traversalId, mapId, roomIds, bindings, path, connections);
    }

    private Corridor withPath(CorridorPath path) {
        return resolved(segmentKey, corridorId, traversalId, mapId, roomIds, bindings, path, connections);
    }

    private Corridor withConnections(List<CorridorConnection> connections) {
        return resolved(segmentKey, corridorId, traversalId, mapId, roomIds, bindings, path, connections);
    }

    private boolean acceptsTraversalSlice(CorridorTraversalSlice slice) {
        if (slice == null) {
            return false;
        }
        Long sliceCorridorId = slice.corridorId();
        return Objects.equals(segmentKey, slice.segmentKey())
                || corridorId == null
                || sliceCorridorId == null
                || Objects.equals(corridorId, sliceCorridorId);
    }

    private static List<CorridorConnection> rebindConnections(List<CorridorConnection> connections, Long corridorId) {
        if (connections == null || connections.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorConnection> rebound = new ArrayList<>();
        for (CorridorConnection connection : connections) {
            if (connection == null) {
                continue;
            }
            rebound.add(new CorridorConnection(
                    corridorId,
                    connection.mapId(),
                    connection.door(),
                    connection.endpoints().stream()
                            .map(endpoint -> endpoint != null
                                    && endpoint.type() == features.world.dungeonmap.model.structures.connection.ConnectionEndpointType.CORRIDOR
                                    ? features.world.dungeonmap.model.structures.connection.ConnectionEndpoint.corridor(corridorId)
                                    : endpoint)
                            .toList(),
                    connection.levelZ()));
        }
        return rebound.isEmpty() ? List.of() : List.copyOf(rebound);
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
        List<CorridorDoorBinding> sanitizedDoorBindings = new ArrayList<>();
        for (CorridorDoorBinding binding : bindings.doorBindings()) {
            if (binding != null
                    && connectedRoomIds.contains(binding.roomId())
                    && seenDoorBindingRoomIds.add(binding.roomId())) {
                sanitizedDoorBindings.add(binding);
            }
        }
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

}

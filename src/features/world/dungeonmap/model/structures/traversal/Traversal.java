package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanningEngine;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class Traversal {

    private final Long traversalId;
    private final long mapId;
    private final List<Long> roomIds;
    private final TraversalBindings bindings;

    public static Traversal resolved(
            Long traversalId,
            long mapId,
            List<Long> roomIds,
            TraversalBindings bindings
    ) {
        return new Traversal(traversalId, mapId, roomIds, bindings);
    }

    private Traversal(
            Long traversalId,
            long mapId,
            List<Long> roomIds,
            TraversalBindings bindings
    ) {
        this.traversalId = traversalId;
        this.mapId = mapId;
        this.roomIds = normalizeRoomIds(roomIds);
        this.bindings = bindings == null ? TraversalBindings.empty() : bindings;
    }

    public Long traversalId() {
        return traversalId;
    }

    public long mapId() {
        return mapId;
    }

    public List<Long> roomIds() {
        return roomIds;
    }

    public TraversalBindings bindings() {
        return bindings;
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && roomIds.contains(roomId);
    }

    public boolean dependsOnCluster(Long clusterId) {
        if (clusterId == null) {
            return false;
        }
        for (TraversalWaypointBinding waypoint : bindings.waypoints()) {
            if (clusterId.equals(waypoint.clusterId())) {
                return true;
            }
        }
        for (TraversalDoorBinding binding : bindings.doorBindings()) {
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
            Map<Long, Traversal> traversalsById,
            Set<Long> affectedTraversalIds,
            Map<Long, TraversalPlan> traversalPlansByTraversalId
    ) {
        public RewriteResult {
            traversalsById = traversalsById == null ? Map.of() : Map.copyOf(traversalsById);
            affectedTraversalIds = affectedTraversalIds == null ? Set.of() : Set.copyOf(affectedTraversalIds);
            traversalPlansByTraversalId = traversalPlansByTraversalId == null ? Map.of() : Map.copyOf(traversalPlansByTraversalId);
        }
    }

    public static RewriteResult rewriteAll(
            Map<Long, Traversal> traversalsById,
            TraversalRewriteContext context
    ) {
        if (traversalsById == null || traversalsById.isEmpty()) {
            return new RewriteResult(Map.of(), Set.of(), Map.of());
        }
        if (context == null || context.affectedTraversalIds().isEmpty()) {
            return new RewriteResult(Map.copyOf(traversalsById), Set.of(), Map.of());
        }
        Map<Long, Traversal> result = new LinkedHashMap<>();
        Map<Long, TraversalPlan> traversalPlansByTraversalId = new LinkedHashMap<>();
        for (Map.Entry<Long, Traversal> entry : traversalsById.entrySet()) {
            Traversal traversal = entry.getValue();
            if (traversal == null) {
                result.put(entry.getKey(), null);
                continue;
            }
            Traversal reanchored = traversal.reanchoredFor(context);
            if (context.affects(traversal.traversalId()) && reanchored.isPersistable()) {
                TraversalPlan traversalPlan = TraversalPlanningEngine.plan(reanchored, context.rewrittenPlanningInput());
                if (reanchored.traversalId() != null) {
                    traversalPlansByTraversalId.put(reanchored.traversalId(), traversalPlan);
                }
            }
            result.put(entry.getKey(), reanchored);
        }
        return new RewriteResult(
                Map.copyOf(result),
                context.affectedTraversalIds(),
                Map.copyOf(traversalPlansByTraversalId));
    }

    public Traversal withAddedRoom(Long roomId) {
        if (roomId == null || roomIds.contains(roomId)) {
            return this;
        }
        List<Long> updated = new ArrayList<>(roomIds);
        updated.add(roomId);
        return resolved(traversalId, mapId, updated, bindings);
    }

    public Traversal withRemovedRoom(Long roomId) {
        if (roomId == null || !roomIds.contains(roomId)) {
            return this;
        }
        List<Long> updated = roomIds.stream()
                .filter(existing -> !Objects.equals(existing, roomId))
                .toList();
        return resolved(traversalId, mapId, updated, bindings.withoutDoorBinding(roomId));
    }

    public Traversal withMergedRooms(Set<Long> mergedRoomIds, Long replacementRoomId) {
        if (replacementRoomId == null || mergedRoomIds == null || mergedRoomIds.isEmpty()) {
            return this;
        }
        List<Long> updated = roomIds.stream()
                .map(roomId -> mergedRoomIds.contains(roomId) ? replacementRoomId : roomId)
                .distinct()
                .toList();
        TraversalBindings updatedBindings = bindings;
        for (Long mergedRoomId : mergedRoomIds) {
            if (!Objects.equals(mergedRoomId, replacementRoomId)) {
                updatedBindings = updatedBindings.withoutDoorBinding(mergedRoomId);
            }
        }
        return resolved(traversalId, mapId, updated, updatedBindings);
    }

    public Traversal withReplacedRoom(Long oldRoomId, Long newRoomId) {
        if (oldRoomId == null || newRoomId == null || Objects.equals(oldRoomId, newRoomId) || !roomIds.contains(oldRoomId)) {
            return this;
        }
        List<Long> updated = roomIds.stream()
                .map(roomId -> Objects.equals(roomId, oldRoomId) ? newRoomId : roomId)
                .distinct()
                .toList();
        TraversalBindings updatedBindings = bindings.withoutDoorBinding(oldRoomId);
        return resolved(traversalId, mapId, updated, updatedBindings);
    }

    public Traversal withInsertedWaypoint(int index, TraversalWaypointBinding waypoint) {
        return withBindings(bindings.withInsertedWaypoint(index, waypoint));
    }

    public Traversal withMovedWaypoint(int index, TraversalWaypointBinding waypoint) {
        return withBindings(bindings.withMovedWaypoint(index, waypoint));
    }

    public Traversal withRemovedWaypoint(int index) {
        return withBindings(bindings.withRemovedWaypoint(index));
    }

    public Traversal withDoorBinding(TraversalDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        Traversal updated = connectsRoom(binding.roomId()) ? this : withAddedRoom(binding.roomId());
        return updated.withBindings(updated.bindings.withDoorBinding(binding));
    }

    public Traversal withoutDoorBinding(Long roomId) {
        return withBindings(bindings.withoutDoorBinding(roomId));
    }

    public Traversal mergedWith(Traversal other) {
        if (other == null || other == this) {
            return this;
        }
        if (mapId != other.mapId()) {
            throw new IllegalArgumentException("Traversals aus unterschiedlichen Karten koennen nicht zusammengefuehrt werden");
        }
        List<Long> mergedRoomIds = mergedRoomIds(other);
        return resolved(
                traversalId,
                mapId,
                mergedRoomIds,
                sanitizedBindings(mergedRoomIds, bindings));
    }

    public Traversal reanchoredFor(TraversalRewriteContext context) {
        if (context == null || !context.affects(traversalId)) {
            return this;
        }
        TraversalPlanningInput previousInput = context.previousPlanningInput();
        TraversalPlanningInput rewrittenInput = context.rewrittenPlanningInput();
        Set<Long> deletedClusterIds = context.deletedClusterIds();
        Long fallbackClusterId = fallbackWaypointClusterId(rewrittenInput);
        List<TraversalWaypointBinding> updatedWaypoints = new ArrayList<>();
        for (TraversalWaypointBinding waypoint : bindings.waypoints()) {
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
            updatedWaypoints.add(TraversalWaypointBinding.atAbsoluteCell(
                    targetClusterId,
                    absoluteCell,
                    targetCenter,
                    waypoint.levelZ()));
        }
        List<TraversalDoorBinding> updatedDoorBindings = new ArrayList<>();
        for (TraversalDoorBinding binding : bindings.doorBindings()) {
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
                    TraversalDoorBinding.atAbsoluteCell(binding.roomId(), targetClusterId, absoluteCell, targetCenter, binding.direction()));
        }
        return withBindings(new TraversalBindings(updatedWaypoints, updatedDoorBindings));
    }

    public Traversal rewrittenForSplit(TraversalSplitRewriteInput input) {
        if (input == null || !input.isUsableFor(this)) {
            return this;
        }
        Room replacement = chooseBestSplitFragment(input);
        if (replacement == null || replacement.roomId() == null) {
            return this;
        }
        return withReplacedRoom(input.originalRoomId(), replacement.roomId());
    }

    public List<Room> resolvedRooms(TraversalPlanningInput input) {
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

    public List<CubePoint> resolvedWaypointCells(TraversalPlanningInput input) {
        if (input == null || bindings.waypoints().isEmpty()) {
            return List.of();
        }
        List<CubePoint> result = new ArrayList<>();
        for (TraversalWaypointBinding waypoint : bindings.waypoints()) {
            Point2i clusterCenter = input.clusterCenter(waypoint.clusterId());
            if (clusterCenter != null) {
                result.add(CubePoint.at(waypoint.absoluteCell(clusterCenter), waypoint.levelZ()));
            }
        }
        return List.copyOf(result);
    }

    public Map<Long, ResolvedTraversalDoorBinding> resolvedDoorBindings(TraversalPlanningInput input) {
        if (input == null || bindings.doorBindings().isEmpty()) {
            return Map.of();
        }
        Map<Long, ResolvedTraversalDoorBinding> result = new LinkedHashMap<>();
        for (TraversalDoorBinding binding : bindings.doorBindings()) {
            Point2i clusterCenter = input.clusterCenter(binding.clusterId());
            if (clusterCenter != null) {
                result.put(binding.roomId(), new ResolvedTraversalDoorBinding(
                        binding.absoluteCell(clusterCenter),
                        binding.direction()));
            }
        }
        return Map.copyOf(result);
    }

    private Traversal withBindings(TraversalBindings bindings) {
        return resolved(traversalId, mapId, roomIds, bindings);
    }

    private Long fallbackWaypointClusterId(TraversalPlanningInput input) {
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
            TraversalPlanningInput previousInput,
            TraversalPlanningInput rewrittenInput,
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

    private Room chooseBestSplitFragment(TraversalSplitRewriteInput input) {
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

    private List<Long> mergedRoomIds(Traversal other) {
        LinkedHashSet<Long> merged = new LinkedHashSet<>(roomIds);
        for (Long roomId : other.roomIds()) {
            if (roomId != null) {
                merged.add(roomId);
            }
        }
        return List.copyOf(merged);
    }

    private static TraversalBindings sanitizedBindings(List<Long> roomIds, TraversalBindings bindings) {
        if (bindings == null) {
            return TraversalBindings.empty();
        }
        Set<Long> connectedRoomIds = roomIds == null ? Set.of() : Set.copyOf(roomIds);
        List<TraversalDoorBinding> sanitizedDoorBindings = bindings.doorBindings().stream()
                .filter(Objects::nonNull)
                .filter(binding -> connectedRoomIds.contains(binding.roomId()))
                .toList();
        return new TraversalBindings(bindings.waypoints(), sanitizedDoorBindings);
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

    private record SplitFragmentScore(int nearestRoomDistance, int groupDistance) implements Comparable<SplitFragmentScore> {
        @Override
        public int compareTo(SplitFragmentScore other) {
            int nearestCompare = Integer.compare(nearestRoomDistance, other.nearestRoomDistance);
            if (nearestCompare != 0) {
                return nearestCompare;
            }
            return Integer.compare(groupDistance, other.groupDistance);
        }
    }
}

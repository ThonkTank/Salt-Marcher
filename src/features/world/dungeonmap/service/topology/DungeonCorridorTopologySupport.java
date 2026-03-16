package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.CorridorDoorOverride;
import features.world.dungeonmap.model.CorridorWaypoint;
import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonLayoutEditResult;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.repository.DungeonRepository;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonCorridorTopologySupport {

    private DungeonCorridorTopologySupport() {
    }

    public static DungeonLayoutEditResult createCorridor(Connection conn, long mapId, List<Long> roomIds) throws Exception {
        DungeonLayout layout = requireLayout(conn, mapId);
        List<Long> normalizedRoomIds = roomIds == null ? List.of() : roomIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (normalizedRoomIds.size() == 2) {
            Long existingCorridorId = findCorridorContainingAllRooms(layout, normalizedRoomIds);
            if (existingCorridorId != null) {
        return loadEditResult(conn, mapId, existingCorridorId);
            }
        }
        long corridorId = DungeonRepository.insertCorridor(conn, mapId, roomIds);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult addRoomToCorridor(Connection conn, long mapId, long corridorId, long roomId) throws Exception {
        DungeonRepository.addRoomToCorridor(conn, mapId, corridorId, roomId);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult mergeCorridors(Connection conn, long mapId, long keptCorridorId, long mergedCorridorId) throws Exception {
        if (keptCorridorId == mergedCorridorId) {
            return loadEditResult(conn, mapId, keptCorridorId);
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonCorridor keptCorridor = layout.corridorById(keptCorridorId);
        if (keptCorridor == null) {
            throw new IllegalArgumentException("Unbekannter Korridor: " + keptCorridorId);
        }
        DungeonCorridor mergedCorridor = layout.corridorById(mergedCorridorId);
        if (mergedCorridor == null) {
            throw new IllegalArgumentException("Unbekannter Korridor: " + mergedCorridorId);
        }
        LinkedHashSet<Long> mergedRoomIds = new LinkedHashSet<>(keptCorridor.roomIds());
        mergedRoomIds.addAll(mergedCorridor.roomIds());
        DungeonRepository.replaceCorridorRooms(conn, mapId, keptCorridorId, List.copyOf(mergedRoomIds));
        DungeonRepository.deleteCorridor(conn, mapId, mergedCorridorId);
        return loadEditResult(conn, mapId, keptCorridorId);
    }

    public static DungeonLayoutEditResult removeRoomFromCorridor(Connection conn, long mapId, long corridorId, long roomId) throws Exception {
        DungeonRepository.removeRoomFromCorridor(conn, mapId, corridorId, roomId);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult removeRoomFromCorridors(Connection conn, long mapId, List<Long> corridorIds, long roomId) throws Exception {
        Long focusCorridorId = corridorIds == null || corridorIds.isEmpty() ? null : corridorIds.get(0);
        if (corridorIds != null) {
            for (Long corridorId : corridorIds) {
                if (corridorId != null) {
                    DungeonRepository.removeRoomFromCorridor(conn, mapId, corridorId, roomId);
                }
            }
        }
        return loadEditResult(conn, mapId, focusCorridorId);
    }

    public static DungeonLayoutEditResult deleteCorridor(Connection conn, long mapId, long corridorId) throws Exception {
        DungeonRepository.deleteCorridor(conn, mapId, corridorId);
        return loadEditResult(conn, mapId, null);
    }

    static void reanchorCorridorClusterBindings(
            Connection conn,
            DungeonLayout layout,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId,
            Set<Long> deletedClusterIds
    ) throws SQLException {
        boolean hasReplacementAnchors = replacementAnchorsByClusterId != null && !replacementAnchorsByClusterId.isEmpty();
        boolean hasDeletedClusters = deletedClusterIds != null && !deletedClusterIds.isEmpty();
        if (layout == null || (!hasReplacementAnchors && !hasDeletedClusters)) {
            return;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            List<CorridorWaypoint> updatedWaypoints = new ArrayList<>();
            List<CorridorDoorOverride> updatedDoorOverrides = new ArrayList<>();
            boolean waypointsChanged = false;
            boolean doorOverridesChanged = false;
            for (CorridorWaypoint waypoint : corridor.waypoints()) {
                if (waypoint == null) {
                    continue;
                }
                ClusterAnchor targetAnchor = targetAnchorForClusterBinding(
                        layout,
                        corridor,
                        waypoint.clusterId(),
                        deletedClusterIds,
                        replacementAnchorsByClusterId);
                if (targetAnchor == null) {
                    if (clusterBindingAffected(waypoint.clusterId(), deletedClusterIds, replacementAnchorsByClusterId)) {
                        waypointsChanged = true;
                    } else {
                        updatedWaypoints.add(waypoint);
                    }
                    continue;
                }
                if (targetAnchor.clusterId() == waypoint.clusterId()
                        && !hasCenterChanged(waypoint.clusterId(), layout, targetAnchor, replacementAnchorsByClusterId)) {
                    updatedWaypoints.add(waypoint);
                    continue;
                }
                DungeonRoomCluster previousCluster = layout.clusterById(waypoint.clusterId());
                if (previousCluster == null) {
                    waypointsChanged = true;
                    continue;
                }
                Point2i absoluteCell = waypoint.absoluteCell(previousCluster.center());
                updatedWaypoints.add(new CorridorWaypoint(
                        targetAnchor.clusterId(),
                        absoluteCell.subtract(targetAnchor.center())));
                waypointsChanged = true;
            }
            for (CorridorDoorOverride override : corridor.doorOverrides()) {
                if (override == null) {
                    continue;
                }
                ClusterAnchor targetAnchor = targetAnchorForDoorOverride(
                        layout,
                        override,
                        deletedClusterIds,
                        replacementAnchorsByClusterId);
                if (targetAnchor == null) {
                    if (clusterBindingAffected(override.clusterId(), deletedClusterIds, replacementAnchorsByClusterId)) {
                        doorOverridesChanged = true;
                    } else {
                        updatedDoorOverrides.add(override);
                    }
                    continue;
                }
                if (targetAnchor.clusterId() == override.clusterId()
                        && !hasCenterChanged(override.clusterId(), layout, targetAnchor, replacementAnchorsByClusterId)) {
                    updatedDoorOverrides.add(override);
                    continue;
                }
                DungeonRoomCluster previousCluster = layout.clusterById(override.clusterId());
                if (previousCluster == null) {
                    doorOverridesChanged = true;
                    continue;
                }
                Point2i absoluteCell = override.absoluteCell(previousCluster.center());
                updatedDoorOverrides.add(new CorridorDoorOverride(
                        override.roomId(),
                        targetAnchor.clusterId(),
                        absoluteCell.subtract(targetAnchor.center()),
                        override.edgeDirection()));
                doorOverridesChanged = true;
            }
            if (waypointsChanged) {
                DungeonRepository.replaceCorridorWaypoints(conn, layout.map().mapId(), corridor.corridorId(), updatedWaypoints);
            }
            if (doorOverridesChanged) {
                DungeonRepository.replaceCorridorDoorOverrides(conn, layout.map().mapId(), corridor.corridorId(), updatedDoorOverrides);
            }
        }
    }

    public static DungeonLayoutEditResult moveCorridorDoor(
            Connection conn,
            long mapId,
            long corridorId,
            long roomId,
            Point2i cell,
            DungeonRoomCluster.EdgeDirection direction
    ) throws Exception {
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonCorridor corridor = requireCorridor(layout, corridorId);
        DungeonRoom room = requireRoom(layout, roomId);
        if (!corridor.roomIds().contains(roomId)) {
            throw new IllegalArgumentException("Raum " + roomId + " gehört nicht zu Korridor " + corridorId);
        }
        if (cell == null || direction == null || !layout.roomCells(roomId).contains(cell)) {
            throw new IllegalArgumentException("Tür-Override muss auf einer gültigen Raumkante liegen");
        }
        if (layout.roomCells(roomId).contains(cell.add(direction.delta()))) {
            throw new IllegalArgumentException("Tür-Override muss auf einer exponierten Raumkante liegen");
        }
        CorridorDoorOverride override = new CorridorDoorOverride(
                roomId,
                room.clusterId(),
                cell.subtract(layout.clusterById(room.clusterId()).center()),
                direction);
        List<CorridorDoorOverride> overrides = new ArrayList<>(corridor.doorOverrides().stream()
                .filter(existing -> existing.roomId() != roomId)
                .toList());
        overrides.add(override);
        DungeonRepository.replaceCorridorDoorOverrides(conn, mapId, corridorId, overrides);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult resetCorridorDoor(Connection conn, long mapId, long corridorId, long roomId) throws Exception {
        DungeonRepository.deleteCorridorDoorOverride(conn, corridorId, roomId);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult addCorridorWaypoint(
            Connection conn,
            long mapId,
            long corridorId,
            int insertIndex,
            Point2i cell
    ) throws Exception {
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonCorridor corridor = requireCorridor(layout, corridorId);
        CorridorWaypoint waypoint = waypointForCell(layout, corridor, cell);
        List<CorridorWaypoint> waypoints = new ArrayList<>(corridor.waypoints());
        int clampedIndex = Math.max(0, Math.min(insertIndex, waypoints.size()));
        waypoints.add(clampedIndex, waypoint);
        DungeonRepository.replaceCorridorWaypoints(conn, mapId, corridorId, waypoints);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult moveCorridorWaypoint(
            Connection conn,
            long mapId,
            long corridorId,
            int waypointIndex,
            Point2i cell
    ) throws Exception {
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonCorridor corridor = requireCorridor(layout, corridorId);
        List<CorridorWaypoint> waypoints = new ArrayList<>(corridor.waypoints());
        if (waypointIndex < 0 || waypointIndex >= waypoints.size()) {
            throw new IllegalArgumentException("Ungültiger Korridor-Zwischenpunkt: " + waypointIndex);
        }
        CorridorWaypoint previous = waypoints.get(waypointIndex);
        DungeonRoomCluster cluster = layout.clusterById(previous.clusterId());
        if (cluster == null) {
            throw new IllegalArgumentException("Referenz-Cluster für Zwischenpunkt fehlt: " + previous.clusterId());
        }
        waypoints.set(waypointIndex, new CorridorWaypoint(previous.clusterId(), cell.subtract(cluster.center())));
        DungeonRepository.replaceCorridorWaypoints(conn, mapId, corridorId, waypoints);
        return loadEditResult(conn, mapId, corridorId);
    }

    public static DungeonLayoutEditResult deleteCorridorWaypoint(Connection conn, long mapId, long corridorId, int waypointIndex) throws Exception {
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonCorridor corridor = requireCorridor(layout, corridorId);
        List<CorridorWaypoint> waypoints = new ArrayList<>(corridor.waypoints());
        if (waypointIndex < 0 || waypointIndex >= waypoints.size()) {
            throw new IllegalArgumentException("Ungültiger Korridor-Zwischenpunkt: " + waypointIndex);
        }
        waypoints.remove(waypointIndex);
        DungeonRepository.replaceCorridorWaypoints(conn, mapId, corridorId, waypoints);
        return loadEditResult(conn, mapId, corridorId);
    }

    static void reassignMergedRoomCorridors(Connection conn, DungeonLayout layout, Long primaryRoomId, List<DungeonRoom> mergedRooms) throws SQLException {
        if (primaryRoomId == null) {
            return;
        }
        Set<Long> mergedRoomIds = mergedRooms.stream()
                .map(DungeonRoom::roomId)
                .filter(id -> id != null)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        for (DungeonCorridor corridor : layout.corridors()) {
            if (corridor.corridorId() == null) {
                continue;
            }
            if (corridor.roomIds().stream().noneMatch(mergedRoomIds::contains)) {
                continue;
            }
            List<Long> replacedRoomIds = corridor.roomIds().stream()
                    .map(roomId -> mergedRoomIds.contains(roomId) ? primaryRoomId : roomId)
                    .distinct()
                    .toList();
            DungeonRepository.replaceCorridorRooms(conn, layout.map().mapId(), corridor.corridorId(), replacedRoomIds);
        }
    }

    static void reconcileRoomCorridors(Connection conn, long mapId, long originalRoomId, List<DungeonRoom> fragments) throws SQLException {
        if (fragments.isEmpty()) {
            return;
        }
        DungeonLayout currentLayout = requireLayout(conn, mapId);
        for (DungeonCorridor corridor : currentLayout.corridors()) {
            if (corridor.corridorId() == null) {
                continue;
            }
            if (!corridor.roomIds().contains(originalRoomId)) {
                continue;
            }
            DungeonRoom targetFragment = chooseBestCorridorFragment(currentLayout, corridor, originalRoomId, fragments);
            List<Long> replacedRoomIds = corridor.roomIds().stream()
                    .map(roomId -> roomId == originalRoomId ? targetFragment.roomId() : roomId)
                    .distinct()
                    .toList();
            DungeonRepository.replaceCorridorRooms(conn, mapId, corridor.corridorId(), replacedRoomIds);
        }
    }

    private static Long findCorridorContainingAllRooms(DungeonLayout layout, List<Long> roomIds) {
        if (layout == null || roomIds == null || roomIds.size() < 2) {
            return null;
        }
        return layout.corridors().stream()
                .filter(corridor -> corridor.corridorId() != null)
                .filter(corridor -> corridor.roomIds().containsAll(roomIds))
                .map(DungeonCorridor::corridorId)
                .findFirst()
                .orElse(null);
    }

    private static DungeonRoom chooseBestCorridorFragment(DungeonLayout layout, DungeonCorridor corridor, long originalRoomId, List<DungeonRoom> fragments) {
        Map<Long, DungeonRoom> roomsById = new HashMap<>();
        for (DungeonRoom fragment : fragments) {
            if (fragment.roomId() != null) {
                roomsById.put(fragment.roomId(), fragment);
            }
        }
        DungeonRoom bestFragment = fragments.get(0);
        FragmentScore bestScore = null;
        for (DungeonRoom fragment : fragments) {
            int nearestRoomDistance = corridor.roomIds().stream()
                    .filter(roomId -> roomId != originalRoomId)
                    .map(layout::roomById)
                    .filter(java.util.Objects::nonNull)
                    .mapToInt(room -> DungeonRoomTopologySupport.componentDistance(fragment, room))
                    .min()
                    .orElse(Integer.MAX_VALUE);
            int groupDistance = corridor.roomIds().stream()
                    .filter(roomId -> roomId != originalRoomId)
                    .map(layout::roomById)
                    .filter(java.util.Objects::nonNull)
                    .mapToInt(room -> DungeonRoomTopologySupport.componentDistance(fragment, room))
                    .sum();
            FragmentScore score = new FragmentScore(nearestRoomDistance, groupDistance);
            if (bestScore == null || score.compareTo(bestScore) < 0) {
                bestFragment = fragment;
                bestScore = score;
            }
        }
        return bestFragment;
    }

    private record FragmentScore(int nearestRoomDistance, int groupDistance) implements Comparable<FragmentScore> {
        @Override
        public int compareTo(FragmentScore other) {
            int nearest = Integer.compare(nearestRoomDistance, other.nearestRoomDistance);
            if (nearest != 0) {
                return nearest;
            }
            return Integer.compare(groupDistance, other.groupDistance);
        }
    }

    private static DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        return DungeonRepository.loadLayout(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
    }

    private static DungeonCorridor requireCorridor(DungeonLayout layout, long corridorId) {
        DungeonCorridor corridor = layout == null ? null : layout.corridorById(corridorId);
        if (corridor == null) {
            throw new IllegalArgumentException("Unbekannter Korridor: " + corridorId);
        }
        return corridor;
    }

    private static DungeonRoom requireRoom(DungeonLayout layout, long roomId) {
        DungeonRoom room = layout == null ? null : layout.roomById(roomId);
        if (room == null) {
            throw new IllegalArgumentException("Unbekannter Raum: " + roomId);
        }
        return room;
    }

    private static CorridorWaypoint waypointForCell(DungeonLayout layout, DungeonCorridor corridor, Point2i cell) {
        if (layout == null || corridor == null || cell == null) {
            throw new IllegalArgumentException("Waypoint braucht Layout, Korridor und Zielzelle");
        }
        DungeonRoom bestRoom = corridor.roomIds().stream()
                .map(layout::roomById)
                .filter(java.util.Objects::nonNull)
                .min(java.util.Comparator.comparingInt(room -> manhattan(room.componentAnchor(), cell)))
                .orElseThrow(() -> new IllegalArgumentException("Korridor braucht mindestens einen Raum"));
        DungeonRoomCluster cluster = layout.clusterById(bestRoom.clusterId());
        if (cluster == null) {
            throw new IllegalArgumentException("Cluster für Raum " + bestRoom.roomId() + " fehlt");
        }
        return new CorridorWaypoint(cluster.clusterId(), cell.subtract(cluster.center()));
    }

    private static int manhattan(Point2i left, Point2i right) {
        return Math.abs(left.x() - right.x()) + Math.abs(left.y() - right.y());
    }

    private static ClusterAnchor fallbackWaypointAnchor(
            DungeonLayout layout,
            DungeonCorridor corridor,
            Set<Long> deletedClusterIds,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId
    ) {
        if (layout == null || corridor == null) {
            return null;
        }
        return corridor.roomIds().stream()
                .map(layout::roomById)
                .filter(java.util.Objects::nonNull)
                .map(room -> anchorForCluster(layout, room.clusterId(), deletedClusterIds, replacementAnchorsByClusterId))
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private static ClusterAnchor anchorForCluster(
            DungeonLayout layout,
            long clusterId,
            Set<Long> deletedClusterIds,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId
    ) {
        if (replacementAnchorsByClusterId != null && replacementAnchorsByClusterId.containsKey(clusterId)) {
            return replacementAnchorsByClusterId.get(clusterId);
        }
        if (deletedClusterIds != null && deletedClusterIds.contains(clusterId)) {
            return null;
        }
        DungeonRoomCluster cluster = layout == null ? null : layout.clusterById(clusterId);
        return cluster == null ? null : new ClusterAnchor(cluster.clusterId(), cluster.center());
    }

    private static ClusterAnchor targetAnchorForClusterBinding(
            DungeonLayout layout,
            DungeonCorridor corridor,
            long clusterId,
            Set<Long> deletedClusterIds,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId
    ) {
        ClusterAnchor directAnchor = replacementAnchorsByClusterId == null ? null : replacementAnchorsByClusterId.get(clusterId);
        if (directAnchor != null) {
            return directAnchor;
        }
        if (deletedClusterIds != null && deletedClusterIds.contains(clusterId)) {
            return fallbackWaypointAnchor(layout, corridor, deletedClusterIds, replacementAnchorsByClusterId);
        }
        return anchorForCluster(layout, clusterId, deletedClusterIds, replacementAnchorsByClusterId);
    }

    private static ClusterAnchor targetAnchorForDoorOverride(
            DungeonLayout layout,
            CorridorDoorOverride override,
            Set<Long> deletedClusterIds,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId
    ) {
        if (layout == null || override == null) {
            return null;
        }
        DungeonRoom room = layout.roomById(override.roomId());
        if (room == null) {
            return null;
        }
        return anchorForCluster(layout, room.clusterId(), deletedClusterIds, replacementAnchorsByClusterId);
    }

    private static boolean clusterBindingAffected(
            long clusterId,
            Set<Long> deletedClusterIds,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId
    ) {
        return (deletedClusterIds != null && deletedClusterIds.contains(clusterId))
                || (replacementAnchorsByClusterId != null && replacementAnchorsByClusterId.containsKey(clusterId));
    }

    private static boolean hasCenterChanged(
            long clusterId,
            DungeonLayout layout,
            ClusterAnchor targetAnchor,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId
    ) {
        if (layout == null || targetAnchor == null || replacementAnchorsByClusterId == null || !replacementAnchorsByClusterId.containsKey(clusterId)) {
            return false;
        }
        DungeonRoomCluster cluster = layout.clusterById(clusterId);
        return cluster == null || !cluster.center().equals(targetAnchor.center());
    }

    record ClusterAnchor(long clusterId, Point2i center) {
    }

    private static DungeonLayoutEditResult loadEditResult(Connection conn, long mapId, Long focusCorridorId) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        DungeonSelection focusSelection = focusCorridorId == null ? null : DungeonSelection.corridor(focusCorridorId);
        return new DungeonLayoutEditResult(layout, focusSelection);
    }
}

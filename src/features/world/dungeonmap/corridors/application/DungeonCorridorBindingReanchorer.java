package features.world.dungeonmap.corridors.application;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorDoorOverride;
import features.world.dungeonmap.corridors.model.CorridorWaypoint;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.corridors.persistence.DungeonCorridorPersistenceRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

public final class DungeonCorridorBindingReanchorer {

    public void reanchorCorridorClusterBindings(
            Connection conn,
            DungeonLayout layout,
            Map<Long, DungeonCorridorClusterAnchor> replacementAnchorsByClusterId,
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
            boolean waypointsChanged = reanchorBindings(
                    corridor.waypoints(),
                    wp -> new ClusterBindingItem<>() {
                        public long clusterId() { return wp.clusterId(); }
                        public Point2i absoluteCell(Point2i c) { return wp.absoluteCell(c); }
                        public CorridorWaypoint rebuild(long id, Point2i rel) { return new CorridorWaypoint(id, rel); }
                    },
                    wp -> targetAnchorForClusterBinding(layout, corridor, wp.clusterId(), deletedClusterIds, replacementAnchorsByClusterId),
                    updatedWaypoints, layout, deletedClusterIds, replacementAnchorsByClusterId);
            boolean doorOverridesChanged = reanchorBindings(
                    corridor.doorOverrides(),
                    o -> new ClusterBindingItem<>() {
                        public long clusterId() { return o.clusterId(); }
                        public Point2i absoluteCell(Point2i c) { return o.absoluteCell(c); }
                        public CorridorDoorOverride rebuild(long id, Point2i rel) {
                            return new CorridorDoorOverride(o.roomId(), id, rel, o.edgeDirection());
                        }
                    },
                    o -> targetAnchorForDoorOverride(layout, o, deletedClusterIds, replacementAnchorsByClusterId),
                    updatedDoorOverrides, layout, deletedClusterIds, replacementAnchorsByClusterId);
            if (waypointsChanged) {
                DungeonCorridorPersistenceRepository.replaceCorridorWaypoints(conn, layout.map().mapId(), corridor.corridorId(), updatedWaypoints);
            }
            if (doorOverridesChanged) {
                DungeonCorridorPersistenceRepository.replaceCorridorDoorOverrides(conn, layout.map().mapId(), corridor.corridorId(), updatedDoorOverrides);
            }
        }
    }

    private static DungeonCorridorClusterAnchor fallbackWaypointAnchor(
            DungeonLayout layout,
            DungeonCorridor corridor,
            Set<Long> deletedClusterIds,
            Map<Long, DungeonCorridorClusterAnchor> replacementAnchorsByClusterId
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

    private static DungeonCorridorClusterAnchor anchorForCluster(
            DungeonLayout layout,
            long clusterId,
            Set<Long> deletedClusterIds,
            Map<Long, DungeonCorridorClusterAnchor> replacementAnchorsByClusterId
    ) {
        if (replacementAnchorsByClusterId != null && replacementAnchorsByClusterId.containsKey(clusterId)) {
            return replacementAnchorsByClusterId.get(clusterId);
        }
        if (deletedClusterIds != null && deletedClusterIds.contains(clusterId)) {
            return null;
        }
        DungeonRoomCluster cluster = layout == null ? null : layout.clusterById(clusterId);
        return cluster == null ? null : new DungeonCorridorClusterAnchor(cluster.clusterId(), cluster.center());
    }

    private static DungeonCorridorClusterAnchor targetAnchorForClusterBinding(
            DungeonLayout layout,
            DungeonCorridor corridor,
            long clusterId,
            Set<Long> deletedClusterIds,
            Map<Long, DungeonCorridorClusterAnchor> replacementAnchorsByClusterId
    ) {
        DungeonCorridorClusterAnchor directAnchor = replacementAnchorsByClusterId == null ? null : replacementAnchorsByClusterId.get(clusterId);
        if (directAnchor != null) {
            return directAnchor;
        }
        if (deletedClusterIds != null && deletedClusterIds.contains(clusterId)) {
            return fallbackWaypointAnchor(layout, corridor, deletedClusterIds, replacementAnchorsByClusterId);
        }
        return anchorForCluster(layout, clusterId, deletedClusterIds, replacementAnchorsByClusterId);
    }

    private static DungeonCorridorClusterAnchor targetAnchorForDoorOverride(
            DungeonLayout layout,
            CorridorDoorOverride override,
            Set<Long> deletedClusterIds,
            Map<Long, DungeonCorridorClusterAnchor> replacementAnchorsByClusterId
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
            Map<Long, DungeonCorridorClusterAnchor> replacementAnchorsByClusterId
    ) {
        return (deletedClusterIds != null && deletedClusterIds.contains(clusterId))
                || (replacementAnchorsByClusterId != null && replacementAnchorsByClusterId.containsKey(clusterId));
    }

    private static boolean hasCenterChanged(
            long clusterId,
            DungeonLayout layout,
            DungeonCorridorClusterAnchor targetAnchor,
            Map<Long, DungeonCorridorClusterAnchor> replacementAnchorsByClusterId
    ) {
        if (layout == null || targetAnchor == null || replacementAnchorsByClusterId == null || !replacementAnchorsByClusterId.containsKey(clusterId)) {
            return false;
        }
        DungeonRoomCluster cluster = layout.clusterById(clusterId);
        return cluster == null || !cluster.center().equals(targetAnchor.center());
    }

    private interface ClusterBindingItem<T> {
        long clusterId();
        Point2i absoluteCell(Point2i center);
        T rebuild(long clusterId, Point2i relativeCell);
    }

    private <T> boolean reanchorBindings(
            Collection<T> items,
            Function<T, ClusterBindingItem<T>> adapter,
            Function<T, DungeonCorridorClusterAnchor> targetAnchorResolver,
            List<T> result,
            DungeonLayout layout,
            Set<Long> deletedClusterIds,
            Map<Long, DungeonCorridorClusterAnchor> replacementAnchorsByClusterId
    ) {
        boolean changed = false;
        for (T item : items) {
            if (item == null) {
                continue;
            }
            ClusterBindingItem<T> binding = adapter.apply(item);
            DungeonCorridorClusterAnchor targetAnchor = targetAnchorResolver.apply(item);
            if (targetAnchor == null) {
                if (clusterBindingAffected(binding.clusterId(), deletedClusterIds, replacementAnchorsByClusterId)) {
                    changed = true;
                } else {
                    result.add(item);
                }
                continue;
            }
            if (targetAnchor.clusterId() == binding.clusterId()
                    && !hasCenterChanged(binding.clusterId(), layout, targetAnchor, replacementAnchorsByClusterId)) {
                result.add(item);
                continue;
            }
            DungeonRoomCluster previousCluster = layout.clusterById(binding.clusterId());
            if (previousCluster == null) {
                changed = true;
                continue;
            }
            Point2i absoluteCell = binding.absoluteCell(previousCluster.center());
            result.add(binding.rebuild(targetAnchor.clusterId(), absoluteCell.subtract(targetAnchor.center())));
            changed = true;
        }
        return changed;
    }
}

package features.world.quarantine.dungeonmap.corridors.application;

import features.world.quarantine.dungeonmap.rooms.application.spi.ClusterAnchor;
import features.world.quarantine.dungeonmap.rooms.application.spi.CorridorBindingReanchorer;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.binding.ClusterBoundBinding;
import features.world.quarantine.dungeonmap.corridors.model.binding.CorridorDoorOverride;
import features.world.quarantine.dungeonmap.corridors.model.binding.CorridorWaypoint;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.corridors.persistence.DungeonCorridorPersistenceRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

public final class DungeonCorridorBindingReanchorer implements CorridorBindingReanchorer {

    private record ReanchorContext(
            DungeonLayout layout,
            Set<Long> deletedClusterIds,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId
    ) {}

    public void reanchorCorridorClusterBindings(
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
        ReanchorContext ctx = new ReanchorContext(layout, deletedClusterIds, replacementAnchorsByClusterId);
        for (DungeonCorridor corridor : layout.corridors()) {
            List<CorridorWaypoint> updatedWaypoints = new ArrayList<>();
            List<CorridorDoorOverride> updatedDoorOverrides = new ArrayList<>();
            boolean waypointsChanged = reanchorBindings(
                    corridor.waypoints(),
                    wp -> targetAnchorForClusterBinding(corridor, wp.clusterId(), ctx),
                    updatedWaypoints, ctx);
            boolean doorOverridesChanged = reanchorBindings(
                    corridor.doorOverrides(),
                    o -> targetAnchorForDoorOverride(o, ctx),
                    updatedDoorOverrides, ctx);
            if (waypointsChanged) {
                DungeonCorridorPersistenceRepository.replaceCorridorWaypoints(conn, layout.map().mapId(), corridor.corridorId(), updatedWaypoints);
            }
            if (doorOverridesChanged) {
                DungeonCorridorPersistenceRepository.replaceCorridorDoorOverrides(conn, layout.map().mapId(), corridor.corridorId(), updatedDoorOverrides);
            }
        }
    }

    private static ClusterAnchor fallbackWaypointAnchor(
            DungeonCorridor corridor,
            ReanchorContext ctx
    ) {
        return corridor.roomIds().stream()
                .map(ctx.layout()::clusterIdForRoom)
                .filter(java.util.Objects::nonNull)
                .map(clusterId -> anchorForCluster(clusterId, ctx))
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private static ClusterAnchor anchorForCluster(long clusterId, ReanchorContext ctx) {
        if (ctx.replacementAnchorsByClusterId() != null && ctx.replacementAnchorsByClusterId().containsKey(clusterId)) {
            return ctx.replacementAnchorsByClusterId().get(clusterId);
        }
        if (ctx.deletedClusterIds() != null && ctx.deletedClusterIds().contains(clusterId)) {
            return null;
        }
        return ctx.layout().clusterAnchor(clusterId);
    }

    private static ClusterAnchor targetAnchorForClusterBinding(
            DungeonCorridor corridor,
            long clusterId,
            ReanchorContext ctx
    ) {
        ClusterAnchor directAnchor = ctx.replacementAnchorsByClusterId() == null ? null : ctx.replacementAnchorsByClusterId().get(clusterId);
        if (directAnchor != null) {
            return directAnchor;
        }
        if (ctx.deletedClusterIds() != null && ctx.deletedClusterIds().contains(clusterId)) {
            return fallbackWaypointAnchor(corridor, ctx);
        }
        return anchorForCluster(clusterId, ctx);
    }

    private static ClusterAnchor targetAnchorForDoorOverride(
            CorridorDoorOverride override,
            ReanchorContext ctx
    ) {
        Long clusterId = ctx.layout().clusterIdForRoom(override.roomId());
        if (clusterId == null) {
            return null;
        }
        return anchorForCluster(clusterId, ctx);
    }

    private static boolean clusterBindingAffected(long clusterId, ReanchorContext ctx) {
        return (ctx.deletedClusterIds() != null && ctx.deletedClusterIds().contains(clusterId))
                || (ctx.replacementAnchorsByClusterId() != null && ctx.replacementAnchorsByClusterId().containsKey(clusterId));
    }

    private static boolean hasCenterChanged(long clusterId, ClusterAnchor targetAnchor, ReanchorContext ctx) {
        if (targetAnchor == null || ctx.replacementAnchorsByClusterId() == null
                || !ctx.replacementAnchorsByClusterId().containsKey(clusterId)) {
            return false;
        }
        ClusterAnchor anchor = ctx.layout().clusterAnchor(clusterId);
        return anchor == null || !anchor.center().equals(targetAnchor.center());
    }

    private <T extends ClusterBoundBinding<T>> boolean reanchorBindings(
            Collection<T> items,
            Function<T, ClusterAnchor> targetAnchorResolver,
            List<T> result,
            ReanchorContext ctx
    ) {
        boolean changed = false;
        for (T item : items) {
            ClusterAnchor targetAnchor = targetAnchorResolver.apply(item);
            if (targetAnchor == null) {
                if (clusterBindingAffected(item.clusterId(), ctx)) {
                    changed = true;
                } else {
                    result.add(item);
                }
                continue;
            }
            if (targetAnchor.clusterId() == item.clusterId()
                    && !hasCenterChanged(item.clusterId(), targetAnchor, ctx)) {
                result.add(item);
                continue;
            }
            ClusterAnchor previousAnchor = ctx.layout().clusterAnchor(item.clusterId());
            if (previousAnchor == null) {
                changed = true;
                continue;
            }
            Point2i absoluteCell = item.absoluteCell(previousAnchor.center());
            result.add(item.rebuild(targetAnchor.clusterId(), absoluteCell.subtract(targetAnchor.center())));
            changed = true;
        }
        return changed;
    }
}

package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.geometry.GridArea;

import java.util.List;

/**
 * Public cluster-owned paint rewrite request.
 */
public record ClusterPaintRequest(
        GridArea paintArea,
        List<Cluster> overlappingClusters,
        int paintLevel
) {
    public ClusterPaintRequest {
        paintArea = paintArea == null ? GridArea.empty() : paintArea.onLevel(paintLevel);
        overlappingClusters = overlappingClusters == null ? List.of() : List.copyOf(overlappingClusters);
    }
}

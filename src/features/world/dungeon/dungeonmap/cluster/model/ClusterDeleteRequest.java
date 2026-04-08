package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.geometry.GridArea;

import java.util.function.Supplier;

/**
 * Public cluster-owned delete rewrite request.
 */
public record ClusterDeleteRequest(
        GridArea deletedArea,
        int deleteLevel,
        Supplier<String> roomNameSupplier
) {
    public ClusterDeleteRequest {
        deletedArea = deletedArea == null ? GridArea.empty() : deletedArea.onLevel(deleteLevel);
    }
}

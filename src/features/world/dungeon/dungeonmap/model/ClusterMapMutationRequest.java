package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest;

import java.util.Objects;

/**
 * Map-owned preview and apply seam for one cluster-targeted mutation request.
 */
public record ClusterMapMutationRequest(
        Long clusterId,
        ClusterMutationRequest mutation
) {
    public ClusterMapMutationRequest {
        mutation = Objects.requireNonNull(mutation, "mutation");
    }
}

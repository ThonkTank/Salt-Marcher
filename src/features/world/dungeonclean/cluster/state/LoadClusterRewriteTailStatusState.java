package features.world.dungeonclean.cluster.state;

import features.world.dungeonclean.cluster.input.LoadClusterRewriteTailStatusInput;

/**
 * Clean cluster-owned room-table status snapshot.
 */
@SuppressWarnings("unused")
public record LoadClusterRewriteTailStatusState(
        long roomCount,
        long roomLevelCount,
        long roomNarrationCount
) {

    public static LoadClusterRewriteTailStatusState loadClusterRewriteTailStatus(
            LoadClusterRewriteTailStatusInput input
    ) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new LoadClusterRewriteTailStatusState(0L, 0L, 0L);
    }
}

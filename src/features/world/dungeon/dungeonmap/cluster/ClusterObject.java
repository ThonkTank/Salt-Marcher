package features.world.dungeon.dungeonmap.cluster;

import features.world.dungeon.dungeonmap.cluster.input.PersistClusterRewriteTailInput;

import java.sql.SQLException;

/**
 * Public root owner object for cluster-owned dungeon structures.
 */
@SuppressWarnings("unused")
public final class ClusterObject {

    public void persistClusterRewriteTail(PersistClusterRewriteTailInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        PersistClusterRewriteTailInput resolvedInput = input;
        features.world.dungeon.dungeonmap.input.PersistClusterRewriteReboundsInput reboundInput =
                resolvedInput.reboundInput();
        if (reboundInput == null) {
            return;
        }
    }
}

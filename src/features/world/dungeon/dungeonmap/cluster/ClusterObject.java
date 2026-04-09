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
        java.sql.Connection connection = resolvedInput.connection();
        if (connection == null) {
            return;
        }
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap = resolvedInput.originalMap();
        if (originalMap == null) {
            return;
        }
        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest = resolvedInput.rewriteRequest();
        if (rewriteRequest == null) {
            return;
        }
    }
}

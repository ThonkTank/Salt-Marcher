package features.world.dungeon.dungeonmap.cluster;

import features.world.dungeon.dungeonmap.cluster.input.PersistClusterRewriteTailInput;
import features.world.dungeon.dungeonmap.cluster.state.PersistClusterRewriteTailState;

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
        if (input.connection() == null) {
            return;
        }
        if (input.mapId() <= 0) {
            return;
        }
        PersistClusterRewriteTailState.persistClusterRewriteTail(input);
    }
}

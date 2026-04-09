package features.world.dungeonclean.cluster;

import features.world.dungeonclean.cluster.input.LoadClusterRewriteTailStatusInput;
import features.world.dungeonclean.cluster.input.PersistClusterRewriteTailInput;
import features.world.dungeonclean.cluster.repository.LoadClusterRewriteTailStatusRepository;
import features.world.dungeonclean.cluster.repository.PersistClusterRewriteTailRepository;
import features.world.dungeonclean.cluster.state.LoadClusterRewriteTailStatusState;
import features.world.dungeonclean.cluster.state.PersistClusterRewriteTailState;

import java.sql.SQLException;

/**
 * Public clean cluster owner seam for persisted rewrite fallout.
 */
@SuppressWarnings("unused")
public final class ClusterObject {

    public void persistClusterRewriteTail(PersistClusterRewriteTailInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            return;
        }
        PersistClusterRewriteTailRepository.persistClusterRewriteTail(
                PersistClusterRewriteTailState.persistClusterRewriteTail(input));
    }

    public LoadClusterRewriteTailStatusInput.StatusInput loadClusterRewriteTailStatus(
            LoadClusterRewriteTailStatusInput input
    ) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        LoadClusterRewriteTailStatusState state = LoadClusterRewriteTailStatusRepository.loadClusterRewriteTailStatus(
                LoadClusterRewriteTailStatusState.loadClusterRewriteTailStatus(input));
        return new LoadClusterRewriteTailStatusInput.StatusInput(state);
    }
}

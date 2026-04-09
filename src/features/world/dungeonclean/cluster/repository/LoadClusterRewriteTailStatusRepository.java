package features.world.dungeonclean.cluster.repository;

import features.world.dungeonclean.cluster.state.LoadClusterRewriteTailStatusState;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Clean cluster-owned room-table status repository.
 */
@SuppressWarnings("unused")
public final class LoadClusterRewriteTailStatusRepository {

    private LoadClusterRewriteTailStatusRepository() {
    }

    public static LoadClusterRewriteTailStatusState loadClusterRewriteTailStatus(
            LoadClusterRewriteTailStatusState state
    ) throws SQLException {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        try (Connection connection = database.DatabaseManager.getConnection();
             Statement statement = connection.createStatement()) {
            return new LoadClusterRewriteTailStatusState(
                    readCount(statement, "SELECT COUNT(*) FROM dungeon_rooms"),
                    readCount(statement, "SELECT COUNT(*) FROM dungeon_room_levels"),
                    readCount(statement, "SELECT COUNT(*) FROM dungeon_room_exit_descriptions"));
        }
    }

    private static long readCount(Statement statement, String sql) throws SQLException {
        try (ResultSet resultSet = statement.executeQuery(sql)) {
            return resultSet.next() ? resultSet.getLong(1) : 0L;
        }
    }
}

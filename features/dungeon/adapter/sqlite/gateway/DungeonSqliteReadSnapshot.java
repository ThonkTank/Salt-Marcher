package features.dungeon.adapter.sqlite.gateway;

import java.sql.Connection;
import java.sql.SQLException;

/** Owns a coherent SQLite read snapshot only when the caller has not supplied a transaction. */
final class DungeonSqliteReadSnapshot {

    private DungeonSqliteReadSnapshot() {
    }

    static <T> T read(Connection connection, SqlRead<T> read) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        if (!previousAutoCommit) {
            return read.execute();
        }
        connection.setAutoCommit(false);
        Throwable failure = null;
        try {
            return read.execute();
        } catch (SQLException | RuntimeException | Error exception) {
            failure = exception;
            throw exception;
        } finally {
            try {
                connection.rollback();
            } catch (SQLException rollbackFailure) {
                if (failure != null) {
                    failure.addSuppressed(rollbackFailure);
                } else {
                    throw rollbackFailure;
                }
            } finally {
                try {
                    connection.setAutoCommit(previousAutoCommit);
                } catch (SQLException restoreFailure) {
                    if (failure != null) {
                        failure.addSuppressed(restoreFailure);
                    } else {
                        throw restoreFailure;
                    }
                }
            }
        }
    }

    @FunctionalInterface
    interface SqlRead<T> {
        T execute() throws SQLException;
    }
}

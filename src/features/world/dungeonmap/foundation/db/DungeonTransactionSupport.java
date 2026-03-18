package features.world.dungeonmap.foundation.db;

import java.sql.Connection;
import java.sql.SQLException;

public final class DungeonTransactionSupport {

    private DungeonTransactionSupport() {
    }

    @FunctionalInterface
    public interface SqlCallable<T> {
        T call() throws SQLException;
    }

    public static <T> T inTransaction(Connection conn, SqlCallable<T> work) throws SQLException {
        boolean previousAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);
        try {
            T result = work.call();
            conn.commit();
            return result;
        } catch (Exception exception) {
            conn.rollback();
            if (exception instanceof RuntimeException re) throw re;
            throw (SQLException) exception;
        } finally {
            conn.setAutoCommit(previousAutoCommit);
        }
    }
}

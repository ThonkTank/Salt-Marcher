package features.world.dungeonmap.infrastructure.persistence;

import java.sql.Connection;
import java.util.concurrent.Callable;

public final class DungeonTransactionSupport {

    private DungeonTransactionSupport() {
    }

    public static <T> T inTransaction(Connection conn, Callable<T> work) throws Exception {
        boolean previousAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);
        try {
            T result = work.call();
            conn.commit();
            return result;
        } catch (Exception exception) {
            conn.rollback();
            throw exception;
        } finally {
            conn.setAutoCommit(previousAutoCommit);
        }
    }
}

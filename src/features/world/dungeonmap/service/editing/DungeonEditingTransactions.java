package features.world.dungeonmap.service.editing;

import database.DatabaseManager;

import java.sql.Connection;
import java.sql.SQLException;

public final class DungeonEditingTransactions {

    private DungeonEditingTransactions() {
        throw new AssertionError("No instances");
    }

    public static <T> T withConnection(ConnectionWork<T> work) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return work.run(conn);
        }
    }

    public static void withConnectionVoid(VoidConnectionWork work) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            work.run(conn);
        }
    }

    public static <T> T inTransactionRollbackOnSql(TransactionWork<T> work) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                T result = work.run(conn);
                conn.commit();
                return result;
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static void inTransactionRollbackOnSqlVoid(VoidTransactionWork work) throws Exception {
        inTransactionRollbackOnSql(conn -> {
            work.run(conn);
            return null;
        });
    }

    public static <T> T inTransactionRollbackOnSqlOrRuntime(TransactionWork<T> work) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                T result = work.run(conn);
                conn.commit();
                return result;
            } catch (SQLException | RuntimeException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static void inTransactionRollbackOnSqlOrRuntimeVoid(VoidTransactionWork work) throws Exception {
        inTransactionRollbackOnSqlOrRuntime(conn -> {
            work.run(conn);
            return null;
        });
    }

    @FunctionalInterface
    public interface ConnectionWork<T> {
        T run(Connection conn) throws Exception;
    }

    @FunctionalInterface
    public interface VoidConnectionWork {
        void run(Connection conn) throws Exception;
    }

    @FunctionalInterface
    public interface TransactionWork<T> {
        T run(Connection conn) throws Exception;
    }

    @FunctionalInterface
    public interface VoidTransactionWork {
        void run(Connection conn) throws Exception;
    }
}

package features.world.dungeonmap.service.editing;

import database.DatabaseManager;

import java.sql.Connection;
import java.sql.SQLException;

final class DungeonEditingTransactions {

    private DungeonEditingTransactions() {
        throw new AssertionError("No instances");
    }

    static <T> T withConnection(ConnectionWork<T> work) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return work.run(conn);
        }
    }

    static void withConnectionVoid(VoidConnectionWork work) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            work.run(conn);
        }
    }

    static <T> T inTransactionRollbackOnSql(TransactionWork<T> work) throws Exception {
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

    static void inTransactionRollbackOnSqlVoid(VoidTransactionWork work) throws Exception {
        inTransactionRollbackOnSql(conn -> {
            work.run(conn);
            return null;
        });
    }

    static <T> T inTransactionRollbackOnSqlOrRuntime(TransactionWork<T> work) throws Exception {
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

    static void inTransactionRollbackOnSqlOrRuntimeVoid(VoidTransactionWork work) throws Exception {
        inTransactionRollbackOnSqlOrRuntime(conn -> {
            work.run(conn);
            return null;
        });
    }

    @FunctionalInterface
    interface ConnectionWork<T> {
        T run(Connection conn) throws Exception;
    }

    @FunctionalInterface
    interface VoidConnectionWork {
        void run(Connection conn) throws Exception;
    }

    @FunctionalInterface
    interface TransactionWork<T> {
        T run(Connection conn) throws Exception;
    }

    @FunctionalInterface
    interface VoidTransactionWork {
        void run(Connection conn) throws Exception;
    }
}

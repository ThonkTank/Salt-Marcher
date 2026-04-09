package database;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Shared JDBC transaction helper for repositories that already own their connection.
 */
public final class DatabaseTransactionRunner {

    private DatabaseTransactionRunner() {
        throw new AssertionError("No instances");
    }

    public static <T> T inTransaction(Connection conn, SqlSupplier<T> work) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        if (work == null) {
            throw new IllegalArgumentException("work darf nicht null sein");
        }
        boolean previousAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);
        try {
            T result = work.get();
            conn.commit();
            return result;
        } catch (SQLException ex) {
            rollbackQuietly(conn);
            throw ex;
        } catch (RuntimeException ex) {
            rollbackQuietly(conn);
            throw ex;
        } finally {
            conn.setAutoCommit(previousAutoCommit);
        }
    }

    public static void inTransaction(Connection conn, SqlWork work) throws SQLException {
        inTransaction(conn, () -> {
            work.run();
            return null;
        });
    }

    private static void rollbackQuietly(Connection conn) throws SQLException {
        conn.rollback();
    }

    @FunctionalInterface
    public interface SqlSupplier<T> {
        T get() throws SQLException;
    }

    @FunctionalInterface
    public interface SqlWork {
        void run() throws SQLException;
    }
}

package importer;

import database.DatabaseManager;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.function.Function;

/**
 * Utility class that owns the bulk-import transaction lifecycle:
 * PRAGMA setup/reset, autoCommit management, commit-every-100, per-item
 * error counting, progress reporting, and final summary.
 *
 * <p>Only intended for CLI import scripts — never call from within the JavaFX app,
 * as {@link DatabaseManager#applyBulkImportPragmas} permanently degrades the shared
 * connection's durability settings for its lifetime.
 *
 * <p>Usage:
 * <pre>
 *   BulkImporter.run(files, "monsters", path -> path.getFileName().toString(),
 *       (path, conn) -> {
 *           Creature c = parse(path);
 *           CreatureRepository.save(c, conn);
 *       });
 * </pre>
 */
public class BulkImporter {

    @FunctionalInterface
    public interface Processor<T> {
        /**
         * Processes one item using the given open connection.
         * Throw {@link SQLException} to abort the entire batch.
         * Throw any other exception to log this item as failed and continue.
         */
        void process(T item, Connection conn) throws Exception;
    }

    private BulkImporter() {}

    /**
     * Runs a bulk import pipeline with transaction management and progress reporting.
     *
     * @param items     ordered list of items to import
     * @param label     noun used in progress output (e.g. {@code "monsters"}, {@code "items"})
     * @param nameOf    extracts a display name from each item for error messages
     * @param processor called once per item; see {@link Processor} for exception semantics
     */
    public static <T> void run(List<T> items, String label,
                               Function<T, String> nameOf,
                               Processor<T> processor) {
        int total   = items.size();
        int success = 0;
        int failed  = 0;

        System.out.println("Initializing database...");
        try {
            DatabaseManager.setupDatabase();
        } catch (Exception e) {
            System.err.println("BulkImporter.run(): database setup failed: " + e.getMessage());
            return;
        }

        System.out.println("Importing " + total + " " + label + "...");
        System.out.println();

        try (Connection conn = DatabaseManager.getConnection()) {
            DatabaseManager.applyBulkImportPragmas(conn);
            System.out.println("Bulk-import PRAGMAs set: synchronous=NORMAL, cache_size=64MB");

            conn.setAutoCommit(false);

            try {
                for (int i = 0; i < total; i++) {
                    T item = items.get(i);
                    try {
                        processor.process(item, conn);
                        success++;

                        if ((i + 1) % 100 == 0) {
                            conn.commit();
                            System.out.printf("[%d/%d] %d OK, %d failed%n",
                                    i + 1, total, success, failed);
                        }

                    } catch (SQLException e) {
                        // Systemic connection/schema error — abort rather than counting thousands
                        // of files as individually failed.
                        throw e;
                    } catch (Exception e) {
                        failed++;
                        System.err.printf("ERROR [%s] %s: %s%n",
                                nameOf.apply(item), e.getClass().getSimpleName(), e.getMessage());
                    }
                }

                conn.commit();
            } finally {
                try { conn.setAutoCommit(true); } catch (SQLException ignored) {}
                DatabaseManager.resetBulkImportPragmas(conn);
            }

        } catch (SQLException e) {
            System.err.println("BulkImporter.run(): " + e.getMessage());
        }

        System.out.println();
        System.out.println("=== Import complete ===");
        System.out.println("Success: " + success);
        System.out.println("Failed:  " + failed);
        System.out.println("Total:   " + total);
    }
}

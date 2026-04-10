package importer.pipeline;

import database.DatabaseManager;
import features.items.importer.ItemImportApplicationService;
import features.spells.importer.SpellImportApplicationService;
import importer.MonsterImportApplicationService;
import importer.pipeline.input.RunItemImportInput;
import importer.pipeline.input.RunMonsterImportInput;
import importer.pipeline.input.RunSpellImportInput;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

/**
 * Canonical shared CLI import-pipeline root.
 * It owns file collection plus the common bulk-import transaction lifecycle so
 * importer mains no longer duplicate database setup, batching, and progress
 * semantics.
 */
@SuppressWarnings("unused")
public final class PipelineObject {

    public MonsterImportApplicationService.ImportSummary runMonsterImport(RunMonsterImportInput input) throws Exception {
        if (!Files.exists(input.dataDir())) {
            throw new IOException("Directory not found: " + input.dataDir().toAbsolutePath());
        }

        List<Path> files = collectHtmlFiles(input.dataDir());
        EncounterContext encounterContext = new EncounterContext(
                MonsterImportApplicationService.beginRecoverySession(),
                new HashSet<>(),
                new ArrayList<>()
        );

        runBulkImport(files, "monsters",
                path -> path.getFileName().toString(),
                (path, conn) -> MonsterImportApplicationService.importFile(
                        path,
                        conn,
                        encounterContext.reservedIds(),
                        encounterContext.driftEvents()));

        return MonsterImportApplicationService.completeImport(
                files.size(),
                encounterContext.recoverySession(),
                encounterContext.driftEvents());
    }

    public void runItemImport(RunItemImportInput input) throws Exception {
        if (!Files.exists(input.equipmentDir()) && !Files.exists(input.magicItemsDir())) {
            Path rootDir = input.equipmentDir().getParent() != null
                    ? input.equipmentDir().getParent()
                    : input.equipmentDir();
            throw new IOException("Directory not found: " + rootDir.toAbsolutePath());
        }

        List<ItemEntry> entries = new ArrayList<>();
        collectItemFiles(input.equipmentDir(), false, entries);
        collectItemFiles(input.magicItemsDir(), true, entries);

        runBulkImport(entries, "items",
                entry -> entry.path().getFileName().toString(),
                (entry, conn) -> ItemImportApplicationService.importFile(entry.path(), entry.isMagic(), conn));
    }

    public void runSpellImport(RunSpellImportInput input) throws Exception {
        if (!Files.exists(input.spellDir())) {
            throw new IOException("Directory not found: " + input.spellDir().toAbsolutePath());
        }

        List<Path> files = collectHtmlFiles(input.spellDir());
        runBulkImport(files, "spells",
                path -> path.getFileName().toString(),
                SpellImportApplicationService::importFile);
        SpellImportApplicationService.completeImport();
    }

    private static List<Path> collectHtmlFiles(Path dir) throws IOException {
        try (Stream<Path> paths = Files.walk(dir, 1)) {
            return paths
                    .filter(path -> path.toString().endsWith(".html"))
                    .sorted()
                    .toList();
        }
    }

    private static void collectItemFiles(Path dir, boolean isMagic, List<ItemEntry> entries) throws IOException {
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(dir, 1)) {
            paths.filter(path -> path.toString().endsWith(".html"))
                    .sorted()
                    .forEach(path -> entries.add(new ItemEntry(path, isMagic)));
        }
    }

    private static <T> void runBulkImport(
            List<T> items,
            String label,
            Function<T, String> nameOf,
            Processor<T> processor) {
        int total = items.size();
        int success = 0;
        int failed = 0;

        System.out.println("Initializing database...");
        try {
            DatabaseManager.setupDatabase();
        } catch (Exception e) {
            throw new IllegalStateException("PipelineObject.runBulkImport(): database setup failed", e);
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
                        throw e;
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new SQLException("Import interrupted", e);
                    } catch (Exception e) {
                        failed++;
                        System.err.printf("ERROR [%s] %s: %s%n",
                                nameOf.apply(item), e.getClass().getSimpleName(), e.getMessage());
                    }
                }
                conn.commit();
            } finally {
                try {
                    conn.setAutoCommit(true);
                } catch (SQLException ignored) {
                }
                DatabaseManager.resetBulkImportPragmas(conn);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("PipelineObject.runBulkImport(): " + e.getMessage(), e);
        }

        System.out.println();
        System.out.println("=== Import complete ===");
        System.out.println("Success: " + success);
        System.out.println("Failed:  " + failed);
        System.out.println("Total:   " + total);
    }

    @FunctionalInterface
    private interface Processor<T> {
        void process(T item, Connection conn) throws Exception;
    }

    private record ItemEntry(Path path, boolean isMagic) {
    }

    private record EncounterContext(
            features.encountertable.api.EncounterTableRecoveryService.RecoverySession recoverySession,
            Set<Long> reservedIds,
            List<MonsterImportApplicationService.DriftEvent> driftEvents
    ) {
    }
}

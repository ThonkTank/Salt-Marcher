package importer;

import database.DatabaseManager;
import features.encountertable.recovery.service.EncounterTableRecoveryService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.Locale;
import java.util.stream.Stream;

/**
 * CLI tool to restore encounter table entries from a persisted backup JSON file.
 */
public final class EncounterTableRecoveryTool {
    private static final Path BACKUP_DIR = Paths.get("data", "backups");

    private EncounterTableRecoveryTool() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        Path backupPath = resolveBackupPath(args);

        if (!Files.exists(backupPath)) {
            System.err.println("Backup file not found: " + backupPath.toAbsolutePath());
            System.exit(1);
            return;
        }

        DatabaseManager.setupDatabase();
        EncounterTableRecoveryService.RecoverySummary result =
                EncounterTableRecoveryService.recover(backupPath);

        System.out.printf(Locale.ROOT,
                "Encounter recovery complete: restored=%d unresolved=%d report=%s backup=%s%n",
                result.restoredCount(),
                result.unresolvedCount(),
                result.reportPath() != null ? result.reportPath().toAbsolutePath() : "none",
                backupPath.toAbsolutePath());
    }

    private static Path resolveBackupPath(String[] args) throws IOException {
        if (args == null || args.length == 0 || "--latest".equals(args[0])) {
            return latestBackupPath();
        }
        return Paths.get(args[0]);
    }

    private static Path latestBackupPath() throws IOException {
        if (!Files.isDirectory(BACKUP_DIR)) {
            throw new IllegalStateException("Backup directory not found: " + BACKUP_DIR.toAbsolutePath());
        }
        try (Stream<Path> paths = Files.list(BACKUP_DIR)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().startsWith("encounter-tables-"))
                    .filter(path -> path.getFileName().toString().endsWith(".json"))
                    .max(Comparator.comparing(Path::getFileName))
                    .orElseThrow(() -> new IllegalStateException(
                            "No encounter backup files found in: " + BACKUP_DIR.toAbsolutePath()));
        }
    }
}

package database.maintenance.repository;

import database.DatabaseManager;
import database.maintenance.state.BackupDatabaseState;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@SuppressWarnings("unused")
public final class BackupDatabaseRepository {

    private BackupDatabaseRepository() {
    }

    public static BackupDatabaseState backupDatabase(BackupDatabaseState state) throws IOException {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        Path sourcePath = resolveSourcePath(state.sourcePath());
        if (!Files.exists(sourcePath)) {
            throw new IOException("Database file does not exist: " + sourcePath);
        }
        Path backupPath = resolveBackupPath(state.backupPath());
        if (state.createParentDirectories()) {
            Files.createDirectories(backupPath.getParent());
        }
        Files.copy(sourcePath, backupPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.COPY_ATTRIBUTES);
        return new BackupDatabaseState(
                sourcePath.toString(),
                backupPath.toString(),
                state.createParentDirectories(),
                Files.size(backupPath));
    }

    private static Path resolveSourcePath(String sourcePath) {
        if (sourcePath == null || sourcePath.isBlank()) {
            return DatabaseManager.databasePath();
        }
        return Path.of(sourcePath).toAbsolutePath().normalize();
    }

    private static Path resolveBackupPath(String backupPath) {
        if (backupPath != null && !backupPath.isBlank()) {
            return Path.of(backupPath).toAbsolutePath().normalize();
        }
        return Path.of("data", "backups", "db", "game-db-backup-" + timestamp() + ".sqlite")
                .toAbsolutePath()
                .normalize();
    }

    private static String timestamp() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmmss"));
    }
}

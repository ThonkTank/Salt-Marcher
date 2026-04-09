package database.maintenance.state;

import database.maintenance.input.BackupDatabaseInput;

@SuppressWarnings("unused")
public record BackupDatabaseState(
        String sourcePath,
        String backupPath,
        boolean createParentDirectories,
        long byteCount
) {

    public BackupDatabaseState {
        sourcePath = sourcePath == null ? "" : sourcePath.trim();
        backupPath = backupPath == null ? "" : backupPath.trim();
        if (byteCount < 0L) {
            throw new IllegalArgumentException("byteCount");
        }
    }

    public static BackupDatabaseState backupDatabase(BackupDatabaseInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new BackupDatabaseState(
                input.sourcePath(),
                input.backupPath(),
                input.createParentDirectories(),
                0L);
    }
}

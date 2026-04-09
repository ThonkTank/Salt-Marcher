package database.maintenance.input;

@SuppressWarnings("unused")
public record BackupDatabaseInput(
        String sourcePath,
        String backupPath,
        boolean createParentDirectories
) {

    public record BackupResultInput(
            String sourcePath,
            String backupPath,
            long byteCount
    ) {

        public BackupResultInput(
                database.maintenance.state.BackupDatabaseState state
        ) {
            this(
                    state == null ? "" : state.sourcePath(),
                    state == null ? "" : state.backupPath(),
                    state == null ? 0L : state.byteCount());
        }
    }
}

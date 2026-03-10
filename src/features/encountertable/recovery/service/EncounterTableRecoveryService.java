package features.encountertable.recovery.service;

import database.DatabaseManager;
import features.creatures.api.CreatureRecoveryIdentityService;
import features.encountertable.recovery.model.RecoveryRestoreResult;
import features.encountertable.recovery.model.TableSnapshot;
import features.encountertable.recovery.repository.RecoveryRepository;

import java.io.IOException;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Snapshot + recovery for encounter table entries around bulk creature imports.
 */
public final class EncounterTableRecoveryService {

    private EncounterTableRecoveryService() {
        throw new AssertionError("No instances");
    }

    /**
     * Captures current encounter table state and writes a mandatory backup artifact.
     */
    public static RecoverySession beginRecoverySession() throws SQLException, IOException {
        List<TableSnapshot> snapshot;
        try (Connection conn = DatabaseManager.getConnection()) {
            snapshot = RecoveryRepository.loadEncounterSnapshot(conn);
        }
        Path backupPath = EncounterRecoveryBackupStore.writeEncounterBackup(snapshot);
        return new RecoverySession(backupPath);
    }

    /**
     * Restores encounter table entries from a prior snapshot after import changes.
     */
    public static RecoverySummary recover(RecoverySession session) throws SQLException, IOException {
        return recover(session.backupPath());
    }

    /**
     * Restores encounter table entries from a persisted backup artifact.
     */
    public static RecoverySummary recover(Path backupPath) throws SQLException, IOException {
        List<TableSnapshot> snapshot = EncounterRecoveryBackupStore.readEncounterBackup(backupPath);
        RecoveryRestoreResult restore;
        try (Connection conn = DatabaseManager.getConnection()) {
            conn.setAutoCommit(false);
            try {
                restore = RecoveryRepository.recoverEncounterEntries(
                        conn,
                        snapshot,
                        (connection, entry) -> CreatureRecoveryIdentityService.resolveEncounterRecoveryId(
                                connection,
                                entry.creatureId(),
                                entry.sourceSlug(),
                                entry.slugKey(),
                                entry.creatureName()));
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }
        }

        Path reportPath = restore.unresolvedEntries().isEmpty()
                ? null
                : EncounterRecoveryReportWriter.writeRecoveryReport(restore.unresolvedEntries());
        return new RecoverySummary(restore.restoredCount(), restore.unresolvedEntries().size(), reportPath);
    }

    public record RecoverySummary(int restoredCount, int unresolvedCount, Path reportPath) {}

    public static final class RecoverySession {
        private final Path backupPath;

        private RecoverySession(Path backupPath) {
            this.backupPath = backupPath;
        }

        public Path backupPath() {
            return backupPath;
        }
    }
}

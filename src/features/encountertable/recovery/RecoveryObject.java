package features.encountertable.recovery;

import database.DatabaseManager;
import features.creatures.identity.IdentityObject;
import features.creatures.identity.input.ResolveRecoveryIdInput;
import features.encountertable.recovery.input.BeginRecoverySessionInput;
import features.encountertable.recovery.input.RecoverInput;
import features.encountertable.recovery.model.RecoveryRestoreResult;
import features.encountertable.recovery.model.TableSnapshot;
import features.encountertable.recovery.repository.RecoveryRepository;
import features.encountertable.recovery.service.EncounterRecoveryBackupStore;
import features.encountertable.recovery.service.EncounterRecoveryReportWriter;

import java.io.IOException;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Canonical root seam for encounter-table backup and recovery workflows used by
 * importer and maintenance entrypoints.
 */
@SuppressWarnings("unused")
public final class RecoveryObject {
    private static final IdentityObject IDENTITY_OBJECT = new IdentityObject();

    public BeginRecoverySessionInput.RecoverySessionInput beginRecoverySession(BeginRecoverySessionInput input)
            throws SQLException, IOException {
        List<TableSnapshot> snapshot;
        try (Connection conn = DatabaseManager.getConnection()) {
            snapshot = RecoveryRepository.loadEncounterSnapshot(conn);
        }
        Path backupPath = EncounterRecoveryBackupStore.writeEncounterBackup(snapshot);
        return new BeginRecoverySessionInput.RecoverySessionInput(backupPath);
    }

    public RecoverInput.RecoveredInput recover(RecoverInput input) throws SQLException, IOException {
        List<TableSnapshot> snapshot = EncounterRecoveryBackupStore.readEncounterBackup(input.backupPath());
        RecoveryRestoreResult restore;
        try (Connection conn = DatabaseManager.getConnection()) {
            conn.setAutoCommit(false);
            try {
                restore = RecoveryRepository.recoverEncounterEntries(
                        conn,
                        snapshot,
                        (connection, entry) -> IDENTITY_OBJECT.resolveRecoveryId(
                                new ResolveRecoveryIdInput(
                                        connection,
                                        entry.creatureId(),
                                        entry.sourceSlug(),
                                        entry.slugKey(),
                                        entry.creatureName())).localId());
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
        return new RecoverInput.RecoveredInput(
                restore.restoredCount(),
                restore.unresolvedEntries().size(),
                reportPath);
    }
}

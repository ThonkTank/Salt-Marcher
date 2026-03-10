package features.encountertable.api;

import java.io.IOException;
import java.nio.file.Path;
import java.sql.SQLException;

/**
 * Public maintenance-facing facade for encounter-table backup and recovery workflows.
 */
public final class EncounterTableRecoveryService {

    private EncounterTableRecoveryService() {
        throw new AssertionError("No instances");
    }

    public static RecoverySession beginRecoverySession() throws SQLException, IOException {
        features.encountertable.recovery.service.EncounterTableRecoveryService.RecoverySession session =
                features.encountertable.recovery.service.EncounterTableRecoveryService.beginRecoverySession();
        return new RecoverySession(session.backupPath());
    }

    public static RecoverySummary recover(RecoverySession session) throws SQLException, IOException {
        return recover(session.backupPath());
    }

    public static RecoverySummary recover(Path backupPath) throws SQLException, IOException {
        features.encountertable.recovery.service.EncounterTableRecoveryService.RecoverySummary summary =
                features.encountertable.recovery.service.EncounterTableRecoveryService.recover(backupPath);
        return new RecoverySummary(summary.restoredCount(), summary.unresolvedCount(), summary.reportPath());
    }

    public record RecoverySummary(int restoredCount, int unresolvedCount, Path reportPath) {}

    public record RecoverySession(Path backupPath) {}
}

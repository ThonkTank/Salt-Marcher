package features.encountertable.api;

import features.encountertable.recovery.RecoveryObject;
import features.encountertable.recovery.input.BeginRecoverySessionInput;
import features.encountertable.recovery.input.RecoverInput;

import java.io.IOException;
import java.nio.file.Path;
import java.sql.SQLException;

/**
 * Public maintenance-facing facade for encounter-table backup and recovery workflows.
 */
@SuppressWarnings("unused")
public final class EncounterTableRecoveryService {
    private static final RecoveryObject RECOVERY_OBJECT = new RecoveryObject();

    private EncounterTableRecoveryService() {
        throw new AssertionError("No instances");
    }

    public static RecoverySession beginRecoverySession() throws SQLException, IOException {
        BeginRecoverySessionInput.RecoverySessionInput session =
                RECOVERY_OBJECT.beginRecoverySession(new BeginRecoverySessionInput());
        return new RecoverySession(session.backupPath());
    }

    public static RecoverySummary recover(RecoverySession session) throws SQLException, IOException {
        return recover(session.backupPath());
    }

    public static RecoverySummary recover(Path backupPath) throws SQLException, IOException {
        RecoverInput.RecoveredInput recovered = RECOVERY_OBJECT.recover(new RecoverInput(backupPath));
        return new RecoverySummary(recovered.restoredCount(), recovered.unresolvedCount(), recovered.reportPath());
    }

    public record RecoverySummary(int restoredCount, int unresolvedCount, Path reportPath) {}

    public record RecoverySession(Path backupPath) {}
}

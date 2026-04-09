package database.maintenance;

import database.maintenance.input.BackupDatabaseInput;
import database.maintenance.input.InspectDatabaseInput;
import database.maintenance.input.ResetDatabaseInput;
import database.maintenance.repository.BackupDatabaseRepository;
import database.maintenance.repository.InspectDatabaseRepository;
import database.maintenance.repository.ResetDatabaseRepository;
import database.maintenance.state.BackupDatabaseState;
import database.maintenance.state.InspectDatabaseState;
import database.maintenance.state.ResetDatabaseState;

import java.io.IOException;
import java.sql.SQLException;

/**
 * Shared database maintenance seam for explicit inspection, backup, and reset tooling outside normal startup.
 */
@SuppressWarnings("unused")
public final class MaintenanceObject {

    public InspectDatabaseInput.InspectResultInput inspectDatabase(InspectDatabaseInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new InspectDatabaseInput.InspectResultInput(
                InspectDatabaseRepository.inspectDatabase(
                        InspectDatabaseState.inspectDatabase(input)));
    }

    public BackupDatabaseInput.BackupResultInput backupDatabase(BackupDatabaseInput input) throws IOException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new BackupDatabaseInput.BackupResultInput(
                BackupDatabaseRepository.backupDatabase(
                        BackupDatabaseState.backupDatabase(input)));
    }

    public ResetDatabaseInput.ResetResultInput resetDatabase(ResetDatabaseInput input) throws SQLException, IOException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new ResetDatabaseInput.ResetResultInput(
                ResetDatabaseRepository.resetDatabase(
                        ResetDatabaseState.resetDatabase(input)));
    }
}

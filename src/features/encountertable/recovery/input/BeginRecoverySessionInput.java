package features.encountertable.recovery.input;

import java.nio.file.Path;

@SuppressWarnings("unused")
public record BeginRecoverySessionInput() {

    public record RecoverySessionInput(Path backupPath) {
    }
}

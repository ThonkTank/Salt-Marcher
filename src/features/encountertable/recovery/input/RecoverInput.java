package features.encountertable.recovery.input;

import java.nio.file.Path;

@SuppressWarnings("unused")
public record RecoverInput(Path backupPath) {

    public record RecoveredInput(
            int restoredCount,
            int unresolvedCount,
            Path reportPath
    ) {
    }
}

package features.encountertable.recovery.model;

import java.util.List;

public record RecoveryRestoreResult(int restoredCount, List<UnresolvedEntry> unresolvedEntries) {}

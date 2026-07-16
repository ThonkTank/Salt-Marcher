package features.dungeon.adapter.sqlite.mapper;

import org.jspecify.annotations.Nullable;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;

final class DungeonTransitionRecordMalformed {
    private DungeonTransitionRecordMalformed() {
    }

    static IllegalStateException record(DungeonTransitionRecord record, String reason) {
        return record(record, reason, null);
    }

    static IllegalStateException record(
            DungeonTransitionRecord record,
            String reason,
            @Nullable RuntimeException cause
    ) {
        IllegalStateException exception = new IllegalStateException(
                "Malformed dungeon transition record " + record.transitionId() + ": " + reason);
        if (cause != null) {
            exception.initCause(cause);
        }
        return exception;
    }
}

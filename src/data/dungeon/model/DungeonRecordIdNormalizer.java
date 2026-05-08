package src.data.dungeon.model;

import org.jspecify.annotations.Nullable;

final class DungeonRecordIdNormalizer {

    private DungeonRecordIdNormalizer() {
    }

    static @Nullable Long positiveLongOrNull(@Nullable Long value) {
        if (value == null || value <= 0L) {
            return null;
        }
        return value;
    }
}

package src.features.dungeon.runtime;

record DungeonEditorStoreVersion(long value) {
    private static final long INITIAL_VALUE = 0L;

    DungeonEditorStoreVersion {
        if (value < INITIAL_VALUE) {
            throw new IllegalArgumentException("value must be non-negative");
        }
    }

    static DungeonEditorStoreVersion initial() {
        return new DungeonEditorStoreVersion(INITIAL_VALUE);
    }

    DungeonEditorStoreVersion next() {
        return new DungeonEditorStoreVersion(value + 1L);
    }

    static DungeonEditorStoreVersion orInitial(DungeonEditorStoreVersion version) {
        return version == null ? initial() : version;
    }
}

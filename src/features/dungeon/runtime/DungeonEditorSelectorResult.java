package src.features.dungeon.runtime;

record DungeonEditorSelectorResult<T>(
        T value,
        DungeonEditorStoreVersion stateVersion
) {
    DungeonEditorSelectorResult {
        stateVersion = DungeonEditorStoreVersion.orInitial(stateVersion);
    }

    boolean isStaleAgainst(DungeonEditorStoreState currentState) {
        DungeonEditorStoreState safeState = currentState == null ? DungeonEditorStoreState.empty() : currentState;
        return !stateVersion.equals(safeState.version());
    }

    T requireFreshAgainst(DungeonEditorStoreState currentState, String staleMessage) {
        if (isStaleAgainst(currentState)) {
            throw new IllegalStateException(staleMessage);
        }
        return value;
    }

    static <T> DungeonEditorSelectorResult<T> from(T value, DungeonEditorStoreState state) {
        DungeonEditorStoreState safeState = state == null ? DungeonEditorStoreState.empty() : state;
        return new DungeonEditorSelectorResult<>(value, safeState.version());
    }
}

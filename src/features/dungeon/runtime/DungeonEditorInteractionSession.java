package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionState;

final class DungeonEditorInteractionSession {
    private final DungeonEditorMainViewInteractionState state = new DungeonEditorMainViewInteractionState();

    DungeonEditorMainViewInteractionState state() {
        return state;
    }

    void clear() {
        state.clear();
    }
}

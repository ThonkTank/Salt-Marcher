package src.domain.dungeon.model.runtime.editor.interaction;

import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.InteractionState;

public final class DungeonEditorMainViewInteractionState {
    private final CurrentInteractionState current = new CurrentInteractionState();

    public InteractionState interactionState() {
        return current.value();
    }

    public void replace(InteractionState next) {
        current.replace(next);
    }

    public void clear() {
        replace(interactionState().clear());
    }

    private static final class CurrentInteractionState {
        private InteractionState value = InteractionState.empty();

        private InteractionState value() {
            return value;
        }

        private void replace(InteractionState next) {
            value = next == null ? InteractionState.empty() : next;
        }
    }
}

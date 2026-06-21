package src.features.dungeon.runtime;

import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;

final class DungeonEditorMainViewInteractionState {
    private final CurrentInteractionState current = new CurrentInteractionState();

    InteractionState interactionState() {
        return current.value();
    }

    void replace(InteractionState next) {
        current.replace(next);
    }

    void clear() {
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

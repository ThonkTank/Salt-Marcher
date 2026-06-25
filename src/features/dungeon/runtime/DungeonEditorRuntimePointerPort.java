package src.features.dungeon.runtime;

import java.util.Objects;

final class DungeonEditorRuntimePointerPort implements DungeonEditorPointerInteractionOperations {
    private final DungeonEditorPointerInteractionOperations interactionOperations;

    DungeonEditorRuntimePointerPort(DungeonEditorPointerInteractionOperations interactionOperations) {
        this.interactionOperations = Objects.requireNonNull(interactionOperations, "interactionOperations");
    }

    @Override
    public PointerInteractionResult applyPointerInteraction(PointerInteractionRequest request) {
        return interactionOperations.applyPointerInteraction(request);
    }

    @Override
    public void clearPointerSession() {
        interactionOperations.clearPointerSession();
    }
}

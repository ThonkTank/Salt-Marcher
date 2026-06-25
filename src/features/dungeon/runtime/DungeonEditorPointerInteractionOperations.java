package src.features.dungeon.runtime;

public interface DungeonEditorPointerInteractionOperations {
    PointerInteractionResult applyPointerInteraction(PointerInteractionRequest request);

    void clearPointerSession();
}

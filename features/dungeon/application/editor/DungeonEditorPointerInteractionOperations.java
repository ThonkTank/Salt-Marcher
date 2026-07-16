package features.dungeon.application.editor;

public interface DungeonEditorPointerInteractionOperations {
    PointerInteractionResult applyPointerInteraction(PointerInteractionRequest request);

    void clearPointerSession();
}

package features.dungeon.application.editor;

public record PointerInteractionResult(
        boolean workflowAccepted,
        features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget
) {
    public PointerInteractionResult {
        hoverTarget = hoverTarget == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : hoverTarget;
    }

    public static PointerInteractionResult ignored() {
        return new PointerInteractionResult(false, features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty());
    }
}

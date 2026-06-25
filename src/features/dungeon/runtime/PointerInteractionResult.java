package src.features.dungeon.runtime;

public record PointerInteractionResult(
        boolean workflowAccepted,
        DungeonEditorRuntimePointerTarget hoverTarget
) {
    public PointerInteractionResult {
        hoverTarget = hoverTarget == null ? DungeonEditorRuntimePointerTarget.empty() : hoverTarget;
    }

    public static PointerInteractionResult ignored() {
        return new PointerInteractionResult(false, DungeonEditorRuntimePointerTarget.empty());
    }
}

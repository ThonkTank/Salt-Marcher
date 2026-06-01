package src.domain.dungeon.published;

public record SaveDungeonEditorTransitionLinkCommand(
        long sourceTransitionId,
        long targetMapId,
        long targetTransitionId,
        boolean bidirectional
) {
    public SaveDungeonEditorTransitionLinkCommand {
        sourceTransitionId = Math.max(0L, sourceTransitionId);
        targetMapId = Math.max(0L, targetMapId);
        targetTransitionId = Math.max(0L, targetTransitionId);
    }
}

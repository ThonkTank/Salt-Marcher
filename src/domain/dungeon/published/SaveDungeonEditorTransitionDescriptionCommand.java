package src.domain.dungeon.published;

public record SaveDungeonEditorTransitionDescriptionCommand(
        long transitionId,
        String description
) {
    public SaveDungeonEditorTransitionDescriptionCommand {
        transitionId = Math.max(0L, transitionId);
        description = description == null ? "" : description;
    }
}

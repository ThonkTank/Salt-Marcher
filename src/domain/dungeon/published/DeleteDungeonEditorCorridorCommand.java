package src.domain.dungeon.published;

public record DeleteDungeonEditorCorridorCommand(DungeonEditorPointerSample pointer) {
    public DeleteDungeonEditorCorridorCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

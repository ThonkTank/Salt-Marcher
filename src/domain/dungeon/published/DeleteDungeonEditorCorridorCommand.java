package src.domain.dungeon.published;

public record DeleteDungeonEditorCorridorCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public DeleteDungeonEditorCorridorCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

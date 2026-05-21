package src.domain.dungeon.published;

public record CreateDungeonEditorCorridorCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public CreateDungeonEditorCorridorCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

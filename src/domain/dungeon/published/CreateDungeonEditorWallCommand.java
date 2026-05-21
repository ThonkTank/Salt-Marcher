package src.domain.dungeon.published;

public record CreateDungeonEditorWallCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public CreateDungeonEditorWallCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

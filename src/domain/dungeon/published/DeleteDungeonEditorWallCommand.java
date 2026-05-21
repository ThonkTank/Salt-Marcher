package src.domain.dungeon.published;

public record DeleteDungeonEditorWallCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public DeleteDungeonEditorWallCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

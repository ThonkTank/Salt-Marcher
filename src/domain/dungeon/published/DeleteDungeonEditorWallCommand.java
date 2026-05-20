package src.domain.dungeon.published;

public record DeleteDungeonEditorWallCommand(DungeonEditorPointerSample pointer) {
    public DeleteDungeonEditorWallCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

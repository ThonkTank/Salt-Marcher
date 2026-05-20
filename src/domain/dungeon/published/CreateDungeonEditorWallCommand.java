package src.domain.dungeon.published;

public record CreateDungeonEditorWallCommand(DungeonEditorPointerSample pointer) {
    public CreateDungeonEditorWallCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

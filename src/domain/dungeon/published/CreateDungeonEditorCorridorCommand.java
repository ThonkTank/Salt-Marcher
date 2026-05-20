package src.domain.dungeon.published;

public record CreateDungeonEditorCorridorCommand(DungeonEditorPointerSample pointer) {
    public CreateDungeonEditorCorridorCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

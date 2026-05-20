package src.domain.dungeon.published;

public record CreateDungeonEditorDoorCommand(DungeonEditorPointerSample pointer) {
    public CreateDungeonEditorDoorCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

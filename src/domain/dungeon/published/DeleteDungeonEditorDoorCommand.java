package src.domain.dungeon.published;

public record DeleteDungeonEditorDoorCommand(DungeonEditorPointerSample pointer) {
    public DeleteDungeonEditorDoorCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

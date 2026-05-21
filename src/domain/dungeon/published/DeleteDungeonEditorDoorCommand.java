package src.domain.dungeon.published;

public record DeleteDungeonEditorDoorCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public DeleteDungeonEditorDoorCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

package src.domain.dungeon.published;

public record CreateDungeonEditorDoorCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public CreateDungeonEditorDoorCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

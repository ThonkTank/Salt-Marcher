package src.domain.dungeon.published;

public record DeleteDungeonEditorRoomCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public DeleteDungeonEditorRoomCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

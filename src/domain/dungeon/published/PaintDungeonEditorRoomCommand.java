package src.domain.dungeon.published;

public record PaintDungeonEditorRoomCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public PaintDungeonEditorRoomCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

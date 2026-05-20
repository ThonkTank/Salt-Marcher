package src.domain.dungeon.published;

public record PaintDungeonEditorRoomCommand(DungeonEditorPointerSample pointer) {
    public PaintDungeonEditorRoomCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

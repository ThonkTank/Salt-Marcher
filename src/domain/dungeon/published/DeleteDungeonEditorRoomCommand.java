package src.domain.dungeon.published;

public record DeleteDungeonEditorRoomCommand(DungeonEditorPointerSample pointer) {
    public DeleteDungeonEditorRoomCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

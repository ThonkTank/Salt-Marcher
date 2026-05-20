package src.domain.dungeon.published;

public record DungeonEditorSelectionCommand(DungeonEditorPointerSample pointer) {
    public DungeonEditorSelectionCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

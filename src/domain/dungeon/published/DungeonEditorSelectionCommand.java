package src.domain.dungeon.published;

public record DungeonEditorSelectionCommand(DungeonEditorPointerSample pointer)
        implements DungeonEditorPointerCommand {
    public DungeonEditorSelectionCommand {
        pointer = pointer == null ? DungeonEditorPointerSample.empty() : pointer;
    }
}

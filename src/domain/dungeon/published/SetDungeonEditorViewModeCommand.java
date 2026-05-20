package src.domain.dungeon.published;

public record SetDungeonEditorViewModeCommand(DungeonEditorViewMode viewMode) {
    public SetDungeonEditorViewModeCommand {
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
    }
}

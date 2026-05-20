package src.domain.dungeon.published;

public record SetDungeonEditorToolCommand(DungeonEditorTool tool) {
    public SetDungeonEditorToolCommand {
        tool = tool == null ? DungeonEditorTool.SELECT : tool;
    }
}

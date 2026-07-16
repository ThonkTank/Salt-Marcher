package features.hex.api;

public record SetHexEditorToolCommand(HexEditorMode tool, HexTerrain terrain) {

    public SetHexEditorToolCommand {
        tool = tool == null ? HexEditorMode.defaultMode() : tool;
        terrain = terrain == null ? HexTerrain.defaultTerrain() : terrain;
    }
}

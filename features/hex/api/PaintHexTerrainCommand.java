package features.hex.api;

public record PaintHexTerrainCommand(long mapId, int q, int r, HexTerrain terrain) {

    public PaintHexTerrainCommand {
        terrain = terrain == null ? HexTerrain.defaultTerrain() : terrain;
    }
}

package features.hex.api;

public record PaintHexTerrainCommand(long mapId, int q, int r, String terrain) {
}

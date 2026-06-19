package src.domain.hex.published;

public record PaintHexTerrainCommand(long mapId, int q, int r, String terrain) {
}

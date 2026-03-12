package features.world.hexmap.api;

public record HexTileSummary(
        Long tileId,
        int q,
        int r,
        String terrainName,
        int elevation,
        String biomeName,
        boolean explored,
        String notes
) {}

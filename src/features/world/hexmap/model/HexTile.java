package features.world.hexmap.model;

import java.util.Objects;

public record HexTile(
        Long tileId,
        Long mapId,
        int q,
        int r,
        HexTerrainType terrainType,
        int elevation,
        HexBiome biome,
        boolean explored,
        Long dominantFactionId,
        String notes
) {
    public HexTile {
        Objects.requireNonNull(terrainType, "terrainType must not be null");
    }
}

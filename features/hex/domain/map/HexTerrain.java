package features.hex.domain.map;

public enum HexTerrain {
    GRASSLAND,
    FOREST,
    MOUNTAINS,
    WATER,
    DESERT,
    SWAMP;

    public static HexTerrain defaultTerrain() {
        return GRASSLAND;
    }
}

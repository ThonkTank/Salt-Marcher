package features.hex.api;

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

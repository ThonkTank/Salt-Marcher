package src.domain.hex.model.map;

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

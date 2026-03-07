package features.world.hexmap.model;

import java.util.Map;
import java.util.Optional;

public enum HexTerrainType {
    GRASSLAND("grassland"),
    FOREST("forest"),
    MOUNTAIN("mountain"),
    WATER("water"),
    DESERT("desert"),
    SWAMP("swamp");

    private final String dbValue;
    private static final Map<String, HexTerrainType> LOOKUP = DbValueEnumLookup.index(values(), HexTerrainType::dbValue);

    HexTerrainType(String dbValue) {
        this.dbValue = dbValue;
    }

    public String dbValue() {
        return dbValue;
    }

    public static Optional<HexTerrainType> fromKey(String key) {
        return DbValueEnumLookup.fromKey(LOOKUP, key);
    }
}

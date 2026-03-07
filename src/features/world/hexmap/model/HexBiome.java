package features.world.hexmap.model;

import java.util.Map;
import java.util.Optional;

public enum HexBiome {
    ARCTIC("arctic"),
    COASTAL("coastal"),
    DESERT("desert"),
    FOREST("forest"),
    GRASSLAND("grassland"),
    MOUNTAIN("mountain"),
    SWAMP("swamp"),
    UNDERDARK("underdark");

    private final String dbValue;
    private static final Map<String, HexBiome> LOOKUP = DbValueEnumLookup.index(values(), HexBiome::dbValue);

    HexBiome(String dbValue) {
        this.dbValue = dbValue;
    }

    public String dbValue() {
        return dbValue;
    }

    public static Optional<HexBiome> fromKey(String key) {
        return DbValueEnumLookup.fromKey(LOOKUP, key);
    }
}

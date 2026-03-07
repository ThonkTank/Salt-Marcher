package features.world.hexmap.model;

import java.util.Map;
import java.util.Optional;

public enum TileControlType {
    PRESENCE("presence"),
    MILITARY("military"),
    TRADE("trade");

    private final String dbValue;
    private static final Map<String, TileControlType> LOOKUP = DbValueEnumLookup.index(values(), TileControlType::dbValue);

    TileControlType(String dbValue) {
        this.dbValue = dbValue;
    }

    public String dbValue() {
        return dbValue;
    }

    public static Optional<TileControlType> fromKey(String key) {
        return DbValueEnumLookup.fromKey(LOOKUP, key);
    }
}

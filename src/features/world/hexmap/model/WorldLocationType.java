package features.world.hexmap.model;

import java.util.Map;
import java.util.Optional;

public enum WorldLocationType {
    CITY("city"),
    DUNGEON("dungeon"),
    RUINS("ruins"),
    SHRINE("shrine"),
    WAYPOINT("waypoint");

    private final String dbValue;
    private static final Map<String, WorldLocationType> LOOKUP = DbValueEnumLookup.index(values(), WorldLocationType::dbValue);

    WorldLocationType(String dbValue) {
        this.dbValue = dbValue;
    }

    public String dbValue() {
        return dbValue;
    }

    public static Optional<WorldLocationType> fromKey(String key) {
        return DbValueEnumLookup.fromKey(LOOKUP, key);
    }
}

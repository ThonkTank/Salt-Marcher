package features.world.dungeonmap.model;

import java.util.Locale;

public enum DungeonEndpointRole {
    ENTRY,
    EXIT,
    BOTH;

    public boolean allowsEntry() {
        return this == ENTRY || this == BOTH;
    }

    public boolean allowsExit() {
        return this == EXIT || this == BOTH;
    }

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static DungeonEndpointRole fromDbValue(String value) {
        if (value == null || value.isBlank()) {
            return BOTH;
        }
        for (DungeonEndpointRole role : values()) {
            if (role.dbValue().equalsIgnoreCase(value)) {
                return role;
            }
        }
        return BOTH;
    }
}

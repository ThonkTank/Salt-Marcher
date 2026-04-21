package src.domain.dungeon.map.value;

import java.util.Locale;

public enum DungeonStairShape {
    LADDER,
    STRAIGHT,
    SQUARE,
    RECTANGULAR,
    CIRCULAR;

    public static DungeonStairShape parse(String value) {
        if (value == null || value.isBlank()) {
            return LADDER;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return LADDER;
        }
    }
}
